import { useMemo, useRef, useState } from 'react';
import { SlidersHorizontal, GripVertical, UserRound, ChevronDown, Plus } from 'lucide-react';
import type { Tarefa } from './types';
import { prazoBR, tarefaConcluida, prazoLimite } from './format';
import { StatusOpcaoChip } from './StatusOpcaoChip';
import { atualizarTarefa } from './tarefasService';
import { addComentario } from '@/atividade/atividadeService';
import {
  useStatusGlobal, opcoesEmOrdemDeColuna, resolverOpcao,
  espelhoStatus, getGrupos, opcoesDoGrupo, opcaoIdPorNome,
} from './status';
import { AvatarMembro } from '@/dashboard/AvatarMembro';
import { logoUrl } from '@/clientes/clientesService';
import { corAvatar, inicial } from '@/clientes/format';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator,
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
  | 'descricao' | 'comentario';

export interface ColDef { key: ColKey; label: string; visivel: boolean }

const COLS_PADRAO: ColDef[] = [
  { key: 'cliente', label: 'Cliente', visivel: true },
  { key: 'projeto', label: 'Projeto', visivel: true },
  { key: 'tarefa', label: 'Tarefa', visivel: true },
  { key: 'status', label: 'Status', visivel: true },
  { key: 'prazo', label: 'Prazo', visivel: true },
  { key: 'prioridade', label: 'Prioridade', visivel: true },
  { key: 'responsaveis', label: 'Responsáveis', visivel: true },
  { key: 'descricao', label: 'Descrição', visivel: false },
  { key: 'comentario', label: 'Comentário', visivel: false },
];

/** Colunas que abrem editor inline ao clicar (stopPropagation — não abre o sheet). */
const EDITAVEIS = new Set<ColKey>(['status', 'prazo', 'prioridade', 'descricao', 'comentario']);

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

/* ------------------------------- Componente principal --------------------- */

/**
 * Tabela de tarefas estilo Notion: clique direto nas células de Status, Prazo e
 * Prioridade para editar inline sem abrir o sheet. Colunas configuráveis,
 * redimensionáveis e persistidas por contexto (`persistPrefix`).
 */
export function TarefasTabela({
  tarefas, onAbrir, persistPrefix, onMudou, colunasPadrao, onNovaLinha,
}: {
  tarefas: Tarefa[];
  onAbrir: (id: string) => void;
  persistPrefix: string;
  onMudou?: () => void;
  colunasPadrao?: ColDef[];
  /** Callback para abrir criação de tarefa; exibe linha "+ Nova tarefa" no rodapé. */
  onNovaLinha?: () => void;
}) {
  useStatusGlobal();
  const opcoesFiltro = opcoesEmOrdemDeColuna();

  const [colDefs, setColDefs] = useState<ColDef[]>(() => carregarColunas(persistPrefix, colunasPadrao));
  const [larguras, setLarguras] = useState<Larguras>(() => carregarLarguras(persistPrefix));
  const [ordem, setOrdem] = useState<Ordem>(() => carregarOrdem(persistPrefix));
  const [fStatus, setFStatus] = useState('');
  const [fPrioridade, setFPrioridade] = useState('');
  const [fPrazo, setFPrazo] = useState('');
  const [fMes, setFMes] = useState(() => carregarMes(persistPrefix));
  const [concluidasAbertas, setConcluidasAbertas] = useState(false);
  const [atrasadasAbertas, setAtrasadasAbertas] = useState(true);

  // Célula em edição inline: { id da tarefa, campo }.
  const [editCell, setEditCell] = useState<{ id: string; campo: ColKey } | null>(null);
  // Atualizações otimistas mescladas na renderização até o reload do servidor confirmar.
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<Tarefa>>>({});
  // Sobrescritas locais de descrição e flag de comentário enviado.
  const [descOverride, setDescOverride] = useState<Record<string, string>>({});
  const [comentado, setComentado] = useState<Record<string, boolean>>({});

  /** Salva qualquer campo inline com atualização otimista e reversa em erro. */
  async function salvarInline(id: string, parcial: Partial<Tarefa>) {
    setLocalOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...parcial } }));
    try {
      await atualizarTarefa(id, parcial as never);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarefas, fStatus, fPrioridade, fPrazo, ordem, localOverrides]);

  const colsVisiveis = useMemo(() => colDefs.filter((c) => c.visivel), [colDefs]);

  function iniciarResize(key: ColKey, thEl: HTMLElement, e: React.MouseEvent) {
    dragResize(thEl, e, (w) => setLarguras((prev) => { const n = { ...prev, [key]: w }; salvarLarguras(persistPrefix, n); return n; }));
  }

  function celula(t: Tarefa, key: ColKey) {
    const te = { ...t, ...(localOverrides[t.id] ?? {}) } as Tarefa;
    const ativo = editCell?.id === t.id && editCell.campo === key;

    if (key === 'tarefa') return <span className="font-medium text-foreground">{te.nome}</span>;

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
            onChange={(e) => {
              if (e.target.value) salvarInline(t.id, espelhoStatus(e.target.value));
              setEditCell(null);
            }}
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
            onBlur={(e) => { salvarInline(t.id, { prazo: e.target.value }); setEditCell(null); }}
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
                {p === 'alta' ? 'Alta' : p === 'media' ? 'Média' : 'Baixa'}
              </button>
            ))}
          </div>
        );
      }
      return <PrioridadeBadge p={te.prioridade} />;
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

    if (key === 'responsaveis') {
      const rs = te.expand?.responsaveis ?? [];
      if (rs.length === 0) return (
        <span className="grid size-7 place-items-center rounded-full border-2 border-card bg-secondary text-muted-foreground">
          <UserRound className="size-3.5" />
        </span>
      );
      return (
        <div className="flex -space-x-2">
          {rs.slice(0, 3).map((r) => <AvatarMembro key={r.id} membro={r} className="size-7 border-2 border-card text-[10px]" />)}
          {rs.length > 3 && <div className="grid size-7 place-items-center rounded-full border-2 border-card bg-secondary text-[10px] font-bold text-muted-foreground">+{rs.length - 3}</div>}
        </div>
      );
    }

    return null;
  }

  // Divide em abertas/concluídas usando status com override local aplicado.
  const statusEfetivo = (t: Tarefa) => localOverrides[t.id]?.status ?? t.status;
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

  function tabela(linhas: Tarefa[], vazio: string, comNova = false) {
    return (
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                {colsVisiveis.map((col) => (
                  <th key={col.key} className="relative px-4 py-3 font-medium"
                    style={larguras[col.key] ? { width: larguras[col.key] } : undefined}>
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
                  <td colSpan={colsVisiveis.length || 1} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    {vazio}
                  </td>
                </tr>
              ) : linhas.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => onAbrir(t.id)}
                  className={cn('cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-secondary/50', tarefaConcluida(statusEfetivo(t)) && 'opacity-60')}
                >
                  {colsVisiveis.map((col) => (
                    <td
                      key={col.key}
                      onClick={EDITAVEIS.has(col.key) ? (e) => {
                        e.stopPropagation();
                        setEditCell({ id: t.id, campo: col.key });
                      } : undefined}
                      className={cn(
                        'overflow-hidden px-4 py-3 align-middle text-muted-foreground',
                        EDITAVEIS.has(col.key) && 'hover:bg-secondary/70',
                      )}
                    >
                      {celula(t, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
              {comNova && onNovaLinha && (
                <tr className="border-t border-border">
                  <td colSpan={colsVisiveis.length || 1} className="px-4 py-2.5">
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
          </table>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros + ordenação + colunas */}
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
          <select value={ordem} onChange={(e) => trocarOrdem(e.target.value as Ordem)} aria-label="Ordenar"
            className={cn(filtroCls, 'text-foreground')}>
            {ORDENS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <MenuColunas colDefs={colDefs} onToggle={toggleCol} onMover={moverCol} />
        </div>
      </div>

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
          {atrasadasAbertas && <div className="mt-2">{tabela(atrasadas, 'Nenhuma atrasada.')}</div>}
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
          {concluidasAbertas && <div className="mt-2">{tabela(concluidas, 'Nenhuma tarefa concluída.')}</div>}
        </div>
      )}
    </div>
  );
}
