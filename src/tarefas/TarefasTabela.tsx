import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SlidersHorizontal, GripVertical, UserRound, ChevronDown, Plus,
  Check, X, Trash2, Maximize2, Layers,
} from 'lucide-react';
import type { Tarefa } from './types';
import { prazoBR, tarefaConcluida, prazoLimite } from './format';
import { StatusOpcaoChip } from './StatusOpcaoChip';
import { atualizarTarefa, removerTarefa } from './tarefasService';
import { addComentario } from '@/atividade/atividadeService';
import {
  useStatusGlobal, opcoesEmOrdemDeColuna, resolverOpcao,
  espelhoStatus, getGrupos, opcoesDoGrupo, opcaoIdPorNome,
} from './status';
import { AvatarMembro } from '@/dashboard/AvatarMembro';
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { logoUrl } from '@/clientes/clientesService';
import { corAvatar, inicial } from '@/clientes/format';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const filtroCls =
  'h-9 rounded-md border border-input bg-background/40 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

/* --------------------------------- Colunas -------------------------------- */

export type ColKey =
  | 'cliente' | 'projeto' | 'tarefa' | 'status' | 'prazo' | 'prioridade' | 'responsaveis'
  | 'etiquetas' | 'descricao' | 'comentario';

export interface ColDef { key: ColKey; label: string; visivel: boolean }

const COLS_PADRAO: ColDef[] = [
  { key: 'cliente', label: 'Cliente', visivel: true },
  { key: 'projeto', label: 'Projeto', visivel: true },
  { key: 'tarefa', label: 'Tarefa', visivel: true },
  { key: 'status', label: 'Status', visivel: true },
  { key: 'prazo', label: 'Prazo', visivel: true },
  { key: 'prioridade', label: 'Prioridade', visivel: true },
  { key: 'responsaveis', label: 'Responsáveis', visivel: true },
  { key: 'etiquetas', label: 'Etiquetas', visivel: false },
  { key: 'descricao', label: 'Descrição', visivel: false },
  { key: 'comentario', label: 'Comentário', visivel: false },
];

/** Colunas que editam inline ao clicar na célula (stopPropagation — não abre o sheet). */
const EDITAVEIS = new Set<ColKey>(['tarefa', 'status', 'prazo', 'prioridade', 'responsaveis', 'etiquetas', 'descricao', 'comentario']);

/** Monta uma lista de ColDef com as `visiveis` em frente, demais ocultas atrás. */
export function colunasComVisiveis(visiveis: ColKey[]): ColDef[] {
  const mapa = new Map(COLS_PADRAO.map((c) => [c.key, c]));
  const ord: ColDef[] = [];
  for (const k of visiveis) { const c = mapa.get(k); if (c) ord.push({ ...c, visivel: true }); }
  for (const c of COLS_PADRAO) if (!ord.some((o) => o.key === c.key)) ord.push({ ...c, visivel: false });
  return ord;
}

function carregarColunas(prefix: string, padrao: ColDef[] = COLS_PADRAO): ColDef[] {
  try {
    const s = localStorage.getItem(`${prefix}-colunas-v2`);
    if (!s) return padrao;
    const salvo = JSON.parse(s) as ColDef[];
    const conhecidas = new Map(COLS_PADRAO.map((c) => [c.key, c]));
    const ord: ColDef[] = salvo
      .filter((c) => conhecidas.has(c.key))
      .map((c) => ({ ...conhecidas.get(c.key)!, visivel: !!c.visivel }));
    for (const c of COLS_PADRAO) if (!ord.some((o) => o.key === c.key)) ord.push(c);
    return ord;
  } catch { return padrao; }
}
function salvarColunas(prefix: string, cols: ColDef[]) {
  try { localStorage.setItem(`${prefix}-colunas-v2`, JSON.stringify(cols)); } catch { /* */ }
}

type Larguras = Partial<Record<ColKey, number>>;
function carregarLarguras(prefix: string): Larguras {
  try { const s = localStorage.getItem(`${prefix}-larguras-v1`); return s ? JSON.parse(s) : {}; } catch { return {}; }
}
function salvarLarguras(prefix: string, l: Larguras) {
  try { localStorage.setItem(`${prefix}-larguras-v1`, JSON.stringify(l)); } catch { /* */ }
}

/** Arrasto genérico de redimensionamento de coluna. */
export function dragResize(thEl: HTMLElement, e: React.MouseEvent, aplicar: (largura: number) => void) {
  e.preventDefault(); e.stopPropagation();
  const base = thEl.getBoundingClientRect().width;
  const startX = e.clientX; const MIN = 80;
  document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
  function onMove(ev: MouseEvent) { aplicar(Math.max(MIN, Math.round(base + (ev.clientX - startX)))); }
  function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; }
  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
}

type Ordem = 'prazo' | 'prioridade' | 'nome';
const ORDENS: { v: Ordem; label: string }[] = [
  { v: 'prazo', label: 'Prazo (mais próximo)' },
  { v: 'prioridade', label: 'Prioridade (alta → baixa)' },
  { v: 'nome', label: 'Nome (A→Z)' },
];
function carregarOrdem(prefix: string): Ordem {
  try { const s = localStorage.getItem(`${prefix}-ordem-v1`); if (s === 'prazo' || s === 'prioridade' || s === 'nome') return s; } catch { /* */ }
  return 'prazo';
}

/* ------------------------------ Agrupamento ------------------------------- */

type GroupBy = 'none' | 'status' | 'cliente' | 'responsavel' | 'prioridade' | 'projeto';
const GROUPS: { v: GroupBy; label: string }[] = [
  { v: 'none', label: 'Sem agrupar' },
  { v: 'status', label: 'Status' },
  { v: 'cliente', label: 'Cliente' },
  { v: 'responsavel', label: 'Responsável' },
  { v: 'prioridade', label: 'Prioridade' },
  { v: 'projeto', label: 'Projeto' },
];
function carregarGroupBy(prefix: string): GroupBy {
  try {
    const s = localStorage.getItem(`${prefix}-group-v1`);
    if (GROUPS.some((g) => g.v === s)) return s as GroupBy;
  } catch { /* */ }
  return 'none';
}

/* ------------------------------ Mês / competência ------------------------- */

const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function mesAtualStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function rotuloMes(ym: string): string {
  const [a, m] = ym.split('-').map(Number);
  return `${MESES_PT[(m || 1) - 1]} ${a}`;
}
function competencia(t: Tarefa): string { return (t.prazo ?? '').slice(0, 7); }
function carregarMes(prefix: string): string {
  try { return localStorage.getItem(`${prefix}-mes-v1`) ?? ''; } catch { return ''; }
}

/* --------------------------------- Helpers -------------------------------- */

function pesoPrioridade(p?: string) { return p === 'alta' ? 0 : p === 'baixa' ? 2 : 1; }
function rotuloPrioridade(p?: string) { return p === 'alta' ? 'Alta' : p === 'baixa' ? 'Baixa' : 'Média'; }

/**
 * Valida uma data vinda de <input type="date"> antes de gravar. O input dispara
 * onChange/onBlur com valores PARCIAIS enquanto o ano é digitado (ex.: 0002-08-20
 * antes de completar 2026) — gravar isso corrompe o prazo. Aceita vazio (limpar)
 * ou uma data ISO com ano de 4 dígitos plausível. (Corrige F-013.)
 */
function dataValida(v: string): boolean {
  if (v === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  return Number(v.slice(0, 4)) >= 1000;
}

export type CatPrazo = '' | 'vencida' | 'hoje' | 'amanha' | 'futuro';
export function catPrazoData(prazo?: string, feito?: boolean): CatPrazo {
  if (!prazo) return '';
  const lim = prazoLimite(prazo);
  if (!lim) return '';
  if (!feito && lim.getTime() < Date.now()) return 'vencida';
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const d = new Date(lim); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - hoje.getTime()) / 86400000);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanha';
  return 'futuro';
}
function catPrazo(t: Tarefa): CatPrazo {
  return catPrazoData(t.prazo, tarefaConcluida(t.status));
}
export function corPrazo(cat: CatPrazo): string {
  if (cat === 'vencida') return 'font-medium text-destructive';
  if (cat === 'hoje') return 'font-medium text-yellow-500';
  if (cat === 'amanha') return 'font-medium text-orange-500';
  return 'text-muted-foreground';
}
export function nomeCliente(t: Tarefa) {
  return t.expand?.cliente?.nome_fantasia ?? t.expand?.cliente?.nome ?? '—';
}

/* --------------------------------- Sub-componentes ------------------------ */

function MenuColunas({ colDefs, onToggle, onMover }: {
  colDefs: ColDef[]; onToggle: (k: ColKey) => void; onMover: (de: number, para: number) => void;
}) {
  const dragIdx = useRef<number | null>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><SlidersHorizontal /> Colunas</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Colunas — arraste para reordenar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {colDefs.map((c, idx) => (
          <div
            key={c.key}
            draggable
            onDragStart={() => { dragIdx.current = idx; }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (dragIdx.current !== null) onMover(dragIdx.current, idx); dragIdx.current = null; }}
            onClick={() => onToggle(c.key)}
            className="flex cursor-grab items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-secondary active:cursor-grabbing"
          >
            <GripVertical className="size-4 shrink-0 text-muted-foreground" />
            <span className={cn('grid size-4 shrink-0 place-items-center rounded border text-[10px]',
              c.visivel ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
              {c.visivel ? '✓' : ''}
            </span>
            <span className="flex-1">{c.label}</span>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PrioridadeBadge({ p }: { p?: string }) {
  if (p === 'alta') return <Badge className="border border-red-500/50 bg-red-500/15 text-[10px] text-red-500">Alta</Badge>;
  if (p === 'baixa') return <Badge className="border border-sky-500/50 bg-sky-500/15 text-[10px] text-sky-400">Baixa</Badge>;
  return <Badge className="border border-amber-500/50 bg-amber-500/15 text-[10px] text-amber-400">Média</Badge>;
}

/** Textarea inline para descrição ou comentário. */
function CellEditor({ valorInicial, placeholder, onSalvar, onCancelar }: {
  valorInicial: string;
  placeholder: string;
  onSalvar: (v: string) => void;
  onCancelar: () => void;
}) {
  const [v, setV] = useState(valorInicial);
  const confirmado = useRef(false);
  function confirmar() { if (confirmado.current) return; confirmado.current = true; onSalvar(v); }
  return (
    <textarea
      autoFocus
      value={v}
      placeholder={placeholder}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmar(); }
        if (e.key === 'Escape') { e.preventDefault(); confirmado.current = true; onCancelar(); }
      }}
      onBlur={confirmar}
      rows={1}
      className="w-full resize-none rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    />
  );
}

/** Editor inline de etiquetas: chips com remover + input para adicionar. */
function EtiquetasEditor({ valorInicial, onSalvar, onFechar }: {
  valorInicial: string[];
  onSalvar: (tags: string[]) => void;
  onFechar: () => void;
}) {
  const [tags, setTags] = useState<string[]>(valorInicial);
  const [novo, setNovo] = useState('');
  function add() {
    const v = novo.trim();
    if (!v || tags.includes(v)) { setNovo(''); return; }
    const n = [...tags, v]; setTags(n); setNovo(''); onSalvar(n);
  }
  function remover(t: string) { const n = tags.filter((x) => x !== t); setTags(n); onSalvar(n); }
  return (
    <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px]">
          {t}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => remover(t)}
            aria-label={`Remover ${t}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        autoFocus
        value={novo}
        placeholder="tag…"
        onChange={(e) => setNovo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(); }
          if (e.key === 'Escape') { e.preventDefault(); onFechar(); }
        }}
        onBlur={onFechar}
        className="h-6 w-16 min-w-16 flex-1 rounded border border-input bg-background px-1.5 text-[11px] focus-visible:outline-none"
      />
    </div>
  );
}

/* ------------------------------- Componente principal --------------------- */

/**
 * Tabela de tarefas estilo Notion: edição inline (status, prazo, prioridade,
 * responsáveis, etiquetas, nome, descrição), agrupamento por campo, ações em
 * massa (seleção por checkbox) e cálculos de rodapé. Colunas configuráveis e
 * redimensionáveis, persistidas por contexto (`persistPrefix`).
 */
export function TarefasTabela({
  tarefas, onAbrir, persistPrefix, onMudou, colunasPadrao, onNovaLinha,
}: {
  tarefas: Tarefa[];
  onAbrir: (id: string) => void;
  persistPrefix: string;
  onMudou?: () => void;
  colunasPadrao?: ColDef[];
  onNovaLinha?: () => void;
}) {
  useStatusGlobal();
  const opcoesFiltro = opcoesEmOrdemDeColuna();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  useEffect(() => { listUsuarios().then(setUsuarios).catch(() => setUsuarios([])); }, []);

  const [colDefs, setColDefs] = useState<ColDef[]>(() => carregarColunas(persistPrefix, colunasPadrao));
  const [larguras, setLarguras] = useState<Larguras>(() => carregarLarguras(persistPrefix));
  const [ordem, setOrdem] = useState<Ordem>(() => carregarOrdem(persistPrefix));
  const [groupBy, setGroupBy] = useState<GroupBy>(() => carregarGroupBy(persistPrefix));
  const [fStatus, setFStatus] = useState('');
  const [fPrioridade, setFPrioridade] = useState('');
  const [fPrazo, setFPrazo] = useState('');
  const [fMes, setFMes] = useState(() => carregarMes(persistPrefix));
  const [concluidasAbertas, setConcluidasAbertas] = useState(false);
  const [atrasadasAbertas, setAtrasadasAbertas] = useState(true);
  const [gruposFechados, setGruposFechados] = useState<Set<string>>(new Set());

  // Célula em edição inline: { id da tarefa, campo }.
  const [editCell, setEditCell] = useState<{ id: string; campo: ColKey } | null>(null);
  // Atualizações otimistas mescladas na renderização até o reload do servidor confirmar.
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<Tarefa>>>({});
  const [descOverride, setDescOverride] = useState<Record<string, string>>({});
  const [comentado, setComentado] = useState<Record<string, boolean>>({});
  // Seleção para ações em massa.
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);

  /** Salva qualquer campo inline com atualização otimista e reversa em erro. */
  async function salvarInline(id: string, parcial: Partial<Tarefa>) {
    setLocalOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...parcial } }));
    try {
      // `expand` é só para exibição otimista — nunca vai pro backend.
      const { expand, ...dados } = parcial as Partial<Tarefa> & { expand?: unknown };
      void expand;
      await atualizarTarefa(id, dados as never);
      onMudou?.();
    } catch {
      setLocalOverrides((prev) => {
        const entry = { ...(prev[id] ?? {}) };
        for (const k of Object.keys(parcial)) delete entry[k as keyof typeof entry];
        return { ...prev, [id]: entry };
      });
    }
  }

  /** Salva descrição (patch) ou adiciona comentário. */
  async function salvarCelula(id: string, campo: 'descricao' | 'comentario', valor: string) {
    setEditCell(null);
    const v = valor.trim();
    if (campo === 'descricao') {
      setDescOverride((m) => ({ ...m, [id]: v }));
      try { await atualizarTarefa(id, { descricao: v } as never); onMudou?.(); } catch { /* */ }
    } else {
      if (!v) return;
      try { await addComentario('tarefa', id, v); setComentado((m) => ({ ...m, [id]: true })); onMudou?.(); } catch { /* */ }
    }
  }

  /** Atualiza responsáveis com expand otimista (avatares) montado a partir dos usuários carregados. */
  function salvarResponsaveis(id: string, ids: string[]) {
    const expandResp = ids
      .map((uid) => usuarios.find((u) => u.id === uid))
      .filter(Boolean)
      .map((u) => ({ id: u!.id, nome: u!.nome, email: u!.email }));
    const atual = localOverrides[id]?.expand ?? tarefas.find((t) => t.id === id)?.expand;
    salvarInline(id, { responsaveis: ids, expand: { ...atual, responsaveis: expandResp } } as Partial<Tarefa>);
  }

  function toggleCol(k: ColKey) {
    setColDefs((cs) => { const n = cs.map((c) => c.key === k ? { ...c, visivel: !c.visivel } : c); salvarColunas(persistPrefix, n); return n; });
  }
  function moverCol(de: number, para: number) {
    setColDefs((cs) => {
      if (de === para || para < 0 || para >= cs.length) return cs;
      const n = [...cs]; const [it] = n.splice(de, 1); n.splice(para, 0, it); salvarColunas(persistPrefix, n); return n;
    });
  }
  function trocarOrdem(o: Ordem) { setOrdem(o); try { localStorage.setItem(`${persistPrefix}-ordem-v1`, o); } catch { /* */ } }
  function trocarMes(m: string) { setFMes(m); try { localStorage.setItem(`${persistPrefix}-mes-v1`, m); } catch { /* */ } }
  function trocarGroupBy(g: GroupBy) { setGroupBy(g); try { localStorage.setItem(`${persistPrefix}-group-v1`, g); } catch { /* */ } }

  const mesSel = fMes === 'atual' ? mesAtualStr() : fMes;
  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const t of tarefas) { const c = competencia(t); if (c) set.add(c); }
    return [...set].sort().reverse();
  }, [tarefas]);

  const filtradas = useMemo(() => {
    let arr = tarefas;
    if (fStatus) arr = arr.filter((t) => {
      const te = { ...t, ...(localOverrides[t.id] ?? {}) } as Tarefa;
      return resolverOpcao(te.status_opcao, te.status)?.id === fStatus;
    });
    if (fPrioridade) arr = arr.filter((t) => (localOverrides[t.id]?.prioridade ?? t.prioridade ?? 'media') === fPrioridade);
    if (fPrazo) arr = arr.filter((t) => catPrazo(t) === fPrazo);
    return [...arr].sort((a, b) => {
      if (ordem === 'nome') return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' });
      if (ordem === 'prioridade') {
        const d = pesoPrioridade(a.prioridade) - pesoPrioridade(b.prioridade);
        if (d !== 0) return d;
      }
      const pa = prazoLimite(a.prazo)?.getTime() ?? Infinity;
      const pb = prazoLimite(b.prazo)?.getTime() ?? Infinity;
      return pa - pb;
    });
  }, [tarefas, fStatus, fPrioridade, fPrazo, ordem, localOverrides]);

  const colsVisiveis = useMemo(() => colDefs.filter((c) => c.visivel), [colDefs]);

  function iniciarResize(key: ColKey, thEl: HTMLElement, e: React.MouseEvent) {
    dragResize(thEl, e, (w) => setLarguras((prev) => { const n = { ...prev, [key]: w }; salvarLarguras(persistPrefix, n); return n; }));
  }

  const tarefaMesclada = (t: Tarefa) => ({ ...t, ...(localOverrides[t.id] ?? {}) } as Tarefa);
  const statusEfetivo = (t: Tarefa) => localOverrides[t.id]?.status ?? t.status;

  /* ----------------------------- Seleção em massa ----------------------------- */

  function toggleSel(id: string) {
    setSelecao((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleSelTodas(ids: string[], marcar: boolean) {
    setSelecao((s) => {
      const n = new Set(s);
      for (const id of ids) { if (marcar) n.add(id); else n.delete(id); }
      return n;
    });
  }
  function limparSelecao() { setSelecao(new Set()); setConfirmandoApagar(false); }

  async function aplicarEmMassa(parcial: Partial<Tarefa>) {
    const ids = [...selecao];
    if (!ids.length) return;
    setLocalOverrides((prev) => {
      const n = { ...prev };
      for (const id of ids) n[id] = { ...(n[id] ?? {}), ...parcial };
      return n;
    });
    limparSelecao();
    try { await Promise.all(ids.map((id) => atualizarTarefa(id, parcial as never))); onMudou?.(); } catch { /* */ }
  }

  // Confirmação in-app (sem window.confirm nativo, que bloqueia o renderer — F-014).
  async function apagarEmMassa() {
    const ids = [...selecao];
    if (!ids.length) return;
    limparSelecao();
    try { await Promise.all(ids.map((id) => removerTarefa(id))); onMudou?.(); } catch { /* */ }
  }

  /* ------------------------------- Célula ----------------------------------- */

  function celula(t: Tarefa, key: ColKey) {
    const te = tarefaMesclada(t);
    const ativo = editCell?.id === t.id && editCell.campo === key;

    if (key === 'tarefa') {
      if (ativo) {
        return (
          <input
            autoFocus
            defaultValue={te.nome}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== te.nome) salvarInline(t.id, { nome: v }); setEditCell(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') { e.preventDefault(); setEditCell(null); }
            }}
            className="h-7 w-full rounded border border-input bg-background px-2 text-sm font-medium focus-visible:outline-none"
          />
        );
      }
      return (
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-foreground">{te.nome}</span>
          <button
            type="button"
            title="Abrir tarefa"
            aria-label="Abrir tarefa"
            onClick={(e) => { e.stopPropagation(); onAbrir(t.id); }}
            className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </span>
      );
    }

    if (key === 'projeto') return <span className="text-sm text-muted-foreground">{te.expand?.projeto?.nome ?? '—'}</span>;

    if (key === 'cliente') {
      const c = te.expand?.cliente;
      if (!c) return <span className="text-muted-foreground">—</span>;
      const nome = nomeCliente(te);
      const logo = c.logo ? logoUrl(c as never, '100x100') : '';
      return logo
        ? <img src={logo} alt={nome} title={nome} loading="lazy" className="size-8 shrink-0 rounded-lg object-cover" />
        : <div title={nome} className={cn('grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white', corAvatar(nome))}>{inicial(nome)}</div>;
    }

    if (key === 'status') {
      if (ativo) {
        return (
          <select
            autoFocus
            value={te.status_opcao ?? opcaoIdPorNome(te.status) ?? ''}
            onChange={(e) => { if (e.target.value) salvarInline(t.id, espelhoStatus(e.target.value)); setEditCell(null); }}
            onBlur={() => setEditCell(null)}
            onClick={(e) => e.stopPropagation()}
            className="h-7 w-full rounded border border-input bg-background px-1 text-xs focus-visible:outline-none"
          >
            {getGrupos().map((g) => {
              const ops = opcoesDoGrupo(g.id);
              if (!ops.length) return null;
              return (
                <optgroup key={g.id} label={g.nome}>
                  {ops.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </optgroup>
              );
            })}
          </select>
        );
      }
      return (te.status_opcao || te.status)
        ? <StatusOpcaoChip opcaoId={te.status_opcao} statusLegado={te.status} />
        : <span className="text-xs text-muted-foreground/50">—</span>;
    }

    if (key === 'prazo') {
      if (ativo) {
        return (
          <input
            type="date"
            autoFocus
            defaultValue={(te.prazo ?? '').slice(0, 10)}
            onBlur={(e) => { const v = e.target.value; if (dataValida(v)) salvarInline(t.id, { prazo: v }); setEditCell(null); }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') { e.preventDefault(); setEditCell(null); }
            }}
            className="h-7 w-full rounded border border-input bg-background px-2 text-xs focus-visible:outline-none"
          />
        );
      }
      if (!te.prazo) return <span className="text-xs text-muted-foreground/40">—</span>;
      return <span className={cn('text-xs', corPrazo(catPrazo(te)))}>{prazoBR(te.prazo)}</span>;
    }

    if (key === 'prioridade') {
      if (ativo) {
        return (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {(['alta', 'media', 'baixa'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { salvarInline(t.id, { prioridade: p }); setEditCell(null); }}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                  p === 'alta' && 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
                  p === 'media' && 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30',
                  p === 'baixa' && 'bg-sky-500/20 text-sky-400 hover:bg-sky-500/30',
                )}
              >
                {rotuloPrioridade(p)}
              </button>
            ))}
          </div>
        );
      }
      return <PrioridadeBadge p={te.prioridade} />;
    }

    if (key === 'responsaveis') {
      const rs = te.expand?.responsaveis ?? [];
      const idsAtuais = te.responsaveis ?? [];
      const conteudo = rs.length === 0
        ? <span className="grid size-7 place-items-center rounded-full border-2 border-card bg-secondary text-muted-foreground"><UserRound className="size-3.5" /></span>
        : (
          <div className="flex -space-x-2">
            {rs.slice(0, 3).map((r) => <AvatarMembro key={r.id} membro={r} className="size-7 border-2 border-card text-[10px]" />)}
            {rs.length > 3 && <div className="grid size-7 place-items-center rounded-full border-2 border-card bg-secondary text-[10px] font-bold text-muted-foreground">+{rs.length - 3}</div>}
          </div>
        );
      if (!ativo) return conteudo;
      return (
        <DropdownMenu open onOpenChange={(o) => { if (!o) setEditCell(null); }}>
          <DropdownMenuTrigger asChild>
            <button type="button" onClick={(e) => e.stopPropagation()}>{conteudo}</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 w-60 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {usuarios.map((u) => {
              const sel = idsAtuais.includes(u.id);
              return (
                <DropdownMenuItem
                  key={u.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    const novos = sel ? idsAtuais.filter((x) => x !== u.id) : [...idsAtuais, u.id];
                    salvarResponsaveis(t.id, novos);
                  }}
                >
                  <Check className={cn('mr-2 size-3.5', sel ? 'opacity-100' : 'opacity-0')} />
                  {u.nome || u.email}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    if (key === 'etiquetas') {
      if (ativo) {
        return (
          <EtiquetasEditor
            valorInicial={te.etiquetas ?? []}
            onSalvar={(tags) => salvarInline(t.id, { etiquetas: tags })}
            onFechar={() => setEditCell(null)}
          />
        );
      }
      const tags = te.etiquetas ?? [];
      if (tags.length === 0) return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/50"><Plus className="size-3" /> tag</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((t2) => <span key={t2} className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px]">{t2}</span>)}
          {tags.length > 3 && <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>}
        </div>
      );
    }

    if (key === 'descricao') {
      if (ativo) {
        return (
          <CellEditor
            valorInicial={descOverride[t.id] ?? te.descricao ?? ''}
            placeholder="Descrição da tarefa…"
            onSalvar={(v) => salvarCelula(t.id, 'descricao', v)}
            onCancelar={() => setEditCell(null)}
          />
        );
      }
      const v = descOverride[t.id] ?? te.descricao ?? '';
      return v
        ? <span className="line-clamp-2 whitespace-pre-wrap text-xs text-foreground">{v}</span>
        : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/50"><Plus className="size-3" /> adicionar</span>;
    }

    if (key === 'comentario') {
      if (ativo) {
        return (
          <CellEditor
            valorInicial=""
            placeholder="Escreva um comentário…"
            onSalvar={(v) => salvarCelula(t.id, 'comentario', v)}
            onCancelar={() => setEditCell(null)}
          />
        );
      }
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/50">
          <Plus className="size-3" /> {comentado[t.id] ? 'comentar de novo' : 'comentar'}
        </span>
      );
    }

    return null;
  }

  /* ------------------------------ Agrupamento ------------------------------- */

  function chaveGrupo(t: Tarefa): { chave: string; label: string; ordem: number } {
    const te = tarefaMesclada(t);
    if (groupBy === 'status') {
      const op = resolverOpcao(te.status_opcao, te.status);
      const idx = op ? opcoesFiltro.findIndex((o) => o.id === op.id) : -1;
      return { chave: op?.id ?? '__sem', label: op?.nome ?? 'Sem status', ordem: idx < 0 ? 9999 : idx };
    }
    if (groupBy === 'cliente') {
      const nome = te.expand?.cliente ? nomeCliente(te) : '';
      return { chave: te.cliente || '__sem', label: nome || 'Sem cliente', ordem: nome ? 0 : 9999 };
    }
    if (groupBy === 'projeto') {
      const nome = te.expand?.projeto?.nome ?? '';
      return { chave: te.projeto || '__sem', label: nome || 'Sem projeto', ordem: nome ? 0 : 9999 };
    }
    if (groupBy === 'responsavel') {
      const r = te.expand?.responsaveis?.[0];
      return { chave: r?.id ?? '__sem', label: r?.nome ?? 'Sem responsável', ordem: r ? 0 : 9999 };
    }
    // prioridade
    const p = te.prioridade ?? 'media';
    return { chave: p, label: rotuloPrioridade(p), ordem: pesoPrioridade(p) };
  }

  const grupos = useMemo(() => {
    if (groupBy === 'none') return [];
    const mapa = new Map<string, { label: string; ordem: number; linhas: Tarefa[] }>();
    for (const t of filtradas) {
      const { chave, label, ordem: ord } = chaveGrupo(t);
      if (!mapa.has(chave)) mapa.set(chave, { label, ordem: ord, linhas: [] });
      mapa.get(chave)!.linhas.push(t);
    }
    return [...mapa.entries()]
      .map(([chave, g]) => ({ chave, ...g }))
      .sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label, 'pt-BR'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtradas, groupBy, localOverrides, opcoesFiltro]);

  /* ------------------------- Modo "sem agrupar": seções --------------------- */

  let abertas = filtradas.filter((t) => !tarefaConcluida(statusEfetivo(t)));
  let concluidas = filtradas.filter((t) => tarefaConcluida(statusEfetivo(t)));
  let atrasadas: Tarefa[] = [];
  if (mesSel) {
    const noMes = (t: Tarefa) => competencia(t) === mesSel;
    const antes = (t: Tarefa) => { const c = competencia(t); return !!c && c < mesSel; };
    atrasadas = abertas.filter(antes);
    abertas = abertas.filter(noMes);
    concluidas = concluidas.filter(noMes);
  }

  /* ------------------------------- Rodapé (S4) ------------------------------ */

  function rodapeCelula(linhas: Tarefa[], key: ColKey): React.ReactNode {
    if (key === 'tarefa') return <span className="font-medium text-foreground">{linhas.length} {linhas.length === 1 ? 'tarefa' : 'tarefas'}</span>;
    if (key === 'status') {
      const feitas = linhas.filter((t) => tarefaConcluida(statusEfetivo(t))).length;
      const pct = linhas.length ? Math.round((feitas / linhas.length) * 100) : 0;
      return <span>{feitas} concl. · {pct}%</span>;
    }
    if (key === 'prazo') {
      const venc = linhas.filter((t) => catPrazo(tarefaMesclada(t)) === 'vencida').length;
      return venc > 0 ? <span className="text-destructive">{venc} vencida{venc > 1 ? 's' : ''}</span> : <span className="text-muted-foreground/50">—</span>;
    }
    if (key === 'prioridade') {
      const alta = linhas.filter((t) => (tarefaMesclada(t).prioridade ?? 'media') === 'alta').length;
      return alta > 0 ? <span>{alta} alta{alta > 1 ? 's' : ''}</span> : <span className="text-muted-foreground/50">—</span>;
    }
    return null;
  }

  /* -------------------------------- Render tabela --------------------------- */

  function tabela(linhas: Tarefa[], vazio: string, comNova = false, comRodape = true) {
    const idsLinhas = linhas.map((l) => l.id);
    const todasSel = idsLinhas.length > 0 && idsLinhas.every((id) => selecao.has(id));
    return (
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 40 }} />
              {colsVisiveis.map((col) => <col key={col.key} style={larguras[col.key] ? { width: larguras[col.key] } : undefined} />)}
            </colgroup>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas"
                    checked={todasSel}
                    onChange={(e) => toggleSelTodas(idsLinhas, e.target.checked)}
                    className="size-3.5 cursor-pointer accent-primary"
                  />
                </th>
                {colsVisiveis.map((col) => (
                  <th key={col.key} className="relative px-4 py-3 font-medium">
                    {col.label}
                    <span role="separator" aria-orientation="vertical" aria-label="Redimensionar"
                      onMouseDown={(e) => iniciarResize(col.key, e.currentTarget.parentElement!, e)}
                      className="group absolute right-0 top-0 z-10 flex h-full w-2 cursor-col-resize select-none items-center justify-center">
                      <span aria-hidden className="h-2/3 w-px bg-border transition-colors group-hover:w-0.5 group-hover:bg-primary" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={colsVisiveis.length + 1} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    {vazio}
                  </td>
                </tr>
              ) : linhas.map((t) => {
                const sel = selecao.has(t.id);
                return (
                  <tr
                    key={t.id}
                    onClick={() => onAbrir(t.id)}
                    className={cn('group cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-secondary/50',
                      tarefaConcluida(statusEfetivo(t)) && 'opacity-60', sel && 'bg-primary/5')}
                  >
                    <td className="px-3 py-3 align-middle" onClick={(e) => { e.stopPropagation(); toggleSel(t.id); }}>
                      <input
                        type="checkbox"
                        aria-label="Selecionar tarefa"
                        checked={sel}
                        onChange={() => toggleSel(t.id)}
                        onClick={(e) => e.stopPropagation()}
                        className={cn('size-3.5 cursor-pointer accent-primary transition-opacity', sel ? 'opacity-100' : 'opacity-30 group-hover:opacity-100')}
                      />
                    </td>
                    {colsVisiveis.map((col) => (
                      <td
                        key={col.key}
                        onClick={EDITAVEIS.has(col.key) ? (e) => { e.stopPropagation(); setEditCell({ id: t.id, campo: col.key }); } : undefined}
                        className={cn('overflow-hidden px-4 py-3 align-middle text-muted-foreground',
                          EDITAVEIS.has(col.key) && 'hover:bg-secondary/70')}
                      >
                        {celula(t, col.key)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {comNova && onNovaLinha && (
                <tr className="border-t border-border">
                  <td colSpan={colsVisiveis.length + 1} className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onNovaLinha(); }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                    >
                      <Plus className="size-3" /> Nova tarefa
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
            {comRodape && linhas.length > 0 && (
              <tfoot>
                <tr className="border-t border-border bg-secondary/30 text-xs text-muted-foreground">
                  <td className="px-3 py-2" />
                  {colsVisiveis.map((col) => (
                    <td key={col.key} className="px-4 py-2 align-middle">{rodapeCelula(linhas, col.key)}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    );
  }

  /* -------------------------------- JSX ------------------------------------- */

  return (
    <div className="flex flex-col gap-4 pb-16">
      {/* Filtros + agrupamento + ordenação + colunas */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Filtrar por status"
          className={cn(filtroCls, fStatus ? 'text-foreground' : 'text-muted-foreground')}>
          <option value="">Status</option>
          {opcoesFiltro.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select value={fPrioridade} onChange={(e) => setFPrioridade(e.target.value)} aria-label="Filtrar por prioridade"
          className={cn(filtroCls, fPrioridade ? 'text-foreground' : 'text-muted-foreground')}>
          <option value="">Prioridade</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
        <select value={fPrazo} onChange={(e) => setFPrazo(e.target.value)} aria-label="Filtrar por prazo"
          className={cn(filtroCls, fPrazo ? 'text-foreground' : 'text-muted-foreground')}>
          <option value="">Prazo</option>
          <option value="hoje">Hoje</option>
          <option value="amanha">Amanhã</option>
          <option value="vencida">Vencida</option>
        </select>
        <select value={fMes} onChange={(e) => trocarMes(e.target.value)} aria-label="Filtrar por mês"
          className={cn(filtroCls, fMes ? 'text-foreground' : 'text-muted-foreground')}>
          <option value="">Mês: todos</option>
          <option value="atual">Mês atual</option>
          {mesesDisponiveis.map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-input bg-background/40 pl-2.5 pr-1">
            <Layers className="size-3.5 text-muted-foreground" />
            <select value={groupBy} onChange={(e) => trocarGroupBy(e.target.value as GroupBy)} aria-label="Agrupar por"
              className="h-9 bg-transparent pr-1 text-sm text-foreground focus-visible:outline-none">
              {GROUPS.map((g) => <option key={g.v} value={g.v}>{g.label}</option>)}
            </select>
          </div>
          <select value={ordem} onChange={(e) => trocarOrdem(e.target.value as Ordem)} aria-label="Ordenar"
            className={cn(filtroCls, 'text-foreground')}>
            {ORDENS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <MenuColunas colDefs={colDefs} onToggle={toggleCol} onMover={moverCol} />
        </div>
      </div>

      {/* --- Modo agrupado --- */}
      {groupBy !== 'none' ? (
        grupos.length === 0 ? (
          tabela([], 'Nenhuma tarefa neste filtro.', false, false)
        ) : (
          grupos.map((g) => {
            const fechado = gruposFechados.has(g.chave);
            return (
              <div key={g.chave}>
                <button
                  type="button"
                  onClick={() => setGruposFechados((s) => { const n = new Set(s); if (n.has(g.chave)) n.delete(g.chave); else n.add(g.chave); return n; })}
                  className="mb-2 flex w-full items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-secondary/50"
                >
                  <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', fechado && '-rotate-90')} />
                  <span className="font-medium text-foreground">{g.label}</span>
                  <Badge variant="muted" className="text-[10px]">{g.linhas.length}</Badge>
                </button>
                {!fechado && tabela(g.linhas, 'Vazio.', false)}
              </div>
            );
          })
        )
      ) : (
        /* --- Modo sem agrupar: abertas / atrasadas / concluídas --- */
        <>
          {mesSel && (
            <p className="-mb-1 text-xs text-muted-foreground">
              Mostrando <span className="font-medium text-foreground">{rotuloMes(mesSel)}</span>
            </p>
          )}

          {tabela(abertas, mesSel ? `Nenhuma tarefa em ${rotuloMes(mesSel)}.` : 'Nenhuma tarefa neste filtro.', true)}

          <p className="pt-1 text-right text-xs text-muted-foreground">
            {abertas.length} {abertas.length === 1 ? 'tarefa em aberto' : 'tarefas em aberto'}
          </p>

          {atrasadas.length > 0 && (
            <div>
              <button type="button" onClick={() => setAtrasadasAbertas((v) => !v)}
                className="flex w-full items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm transition-colors hover:bg-destructive/15">
                <span className="font-medium text-destructive">
                  ⚠ Atrasadas de meses anteriores <span className="opacity-70">({atrasadas.length})</span>
                </span>
                <ChevronDown className={cn('size-4 text-destructive transition-transform', atrasadasAbertas && 'rotate-180')} />
              </button>
              {atrasadasAbertas && <div className="mt-2">{tabela(atrasadas, 'Nenhuma atrasada.', false)}</div>}
            </div>
          )}

          {concluidas.length > 0 && (
            <div>
              <button type="button" onClick={() => setConcluidasAbertas((v) => !v)}
                className="flex w-full items-center justify-between rounded-md border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:bg-secondary/50">
                <span className="font-medium text-muted-foreground">
                  Tarefas concluídas <span className="text-muted-foreground/70">({concluidas.length})</span>
                </span>
                <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', concluidasAbertas && 'rotate-180')} />
              </button>
              {concluidasAbertas && <div className="mt-2">{tabela(concluidas, 'Nenhuma tarefa concluída.', false)}</div>}
            </div>
          )}
        </>
      )}

      {/* --- Barra de ações em massa (S3) --- */}
      {selecao.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg">
          {confirmandoApagar ? (
            <>
              <span className="px-1.5 text-sm">
                Apagar <span className="font-medium">{selecao.size}</span> {selecao.size === 1 ? 'tarefa' : 'tarefas'}? Não dá pra desfazer.
              </span>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setConfirmandoApagar(false)}>Cancelar</Button>
              <Button size="sm" className="gap-1 bg-destructive text-xs text-destructive-foreground hover:bg-destructive/90" onClick={apagarEmMassa}>
                <Trash2 className="size-3.5" /> Apagar
              </Button>
            </>
          ) : (
            <>
              <span className="px-1.5 text-sm font-medium">{selecao.size} selecionada{selecao.size > 1 ? 's' : ''}</span>
              <span className="h-5 w-px bg-border" />

              {/* Status em massa */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">Status <ChevronDown className="size-3" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="max-h-72 w-56 overflow-y-auto">
                  {getGrupos().map((g) => {
                    const ops = opcoesDoGrupo(g.id);
                    if (!ops.length) return null;
                    return (
                      <div key={g.id}>
                        <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">{g.nome}</DropdownMenuLabel>
                        {ops.map((o) => (
                          <DropdownMenuItem key={o.id} onSelect={() => aplicarEmMassa(espelhoStatus(o.id))}>{o.nome}</DropdownMenuItem>
                        ))}
                      </div>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Prioridade em massa */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">Prioridade <ChevronDown className="size-3" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  {(['alta', 'media', 'baixa'] as const).map((p) => (
                    <DropdownMenuItem key={p} onSelect={() => aplicarEmMassa({ prioridade: p })}>{rotuloPrioridade(p)}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Prazo em massa */}
              <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                Prazo
                <input
                  type="date"
                  aria-label="Definir prazo em massa"
                  onChange={(e) => { const v = e.target.value; if (v && dataValida(v)) aplicarEmMassa({ prazo: v }); }}
                  className="h-7 rounded border border-input bg-background px-1.5 text-xs focus-visible:outline-none"
                />
              </label>

              <span className="h-5 w-px bg-border" />
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmandoApagar(true)}>
                <Trash2 className="size-3.5" /> Apagar
              </Button>
              <Button variant="ghost" size="icon" className="size-7" aria-label="Limpar seleção" onClick={limparSelecao}>
                <X className="size-4" />
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
