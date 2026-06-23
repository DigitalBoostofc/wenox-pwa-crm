import { useMemo, useRef, useState } from 'react';
import { SlidersHorizontal, GripVertical, UserRound, ChevronDown, Plus } from 'lucide-react';
import type { Tarefa } from './types';
import { statusTarefaClass, prazoBR, tarefaConcluida, prazoLimite } from './format';
import { atualizarTarefa } from './tarefasService';
import { addComentario } from '@/atividade/atividadeService';
import { useStatuses } from './status';
import { AvatarMembro } from '@/dashboard/AvatarMembro';
import { EtapasStepper } from './EtapasStepper';
import { etapaAtual, temEtapas, ehVezDoUsuario, aguardandoAprovacaoCliente } from './etapas';
import { pb } from '@/lib/pocketbase';
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
  | 'descricao' | 'comentario' | 'etapa_atual' | 'resp_etapa' | 'prazo_etapa' | 'status_etapa' | 'progresso';
export interface ColDef { key: ColKey; label: string; visivel: boolean }

/** Colunas que se editam clicando na própria célula da linha. */
const COLS_EDITAVEIS = new Set<ColKey>(['descricao', 'comentario']);

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
  { key: 'etapa_atual', label: 'Etapa atual', visivel: false },
  { key: 'status_etapa', label: 'Status da etapa', visivel: false },
  { key: 'progresso', label: 'Progresso', visivel: false },
  { key: 'resp_etapa', label: 'Resp. da etapa', visivel: false },
  { key: 'prazo_etapa', label: 'Prazo da etapa', visivel: false },
];

/** Default de colunas para um contexto: ordena `visiveis` primeiro (visíveis, nessa ordem),
 *  depois as demais conhecidas (ocultas) — assim o menu mostra todas as opções. */
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
/** "YYYY-MM" do mês corrente (local). */
function mesAtualStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
/** "2026-07" → "Julho 2026". */
function rotuloMes(ym: string): string {
  const [a, m] = ym.split('-').map(Number);
  return `${MESES_PT[(m || 1) - 1]} ${a}`;
}
/** Competência da tarefa = mês do prazo ("YYYY-MM", '' se sem prazo). */
function competencia(t: Tarefa): string {
  return (t.prazo ?? '').slice(0, 7);
}
function carregarMes(prefix: string): string {
  try { return localStorage.getItem(`${prefix}-mes-v1`) ?? ''; } catch { return ''; }
}

/* --------------------------------- Helpers -------------------------------- */

function pesoPrioridade(p?: string) { return p === 'alta' ? 0 : p === 'baixa' ? 2 : 1; }

/** Categoria do prazo da tarefa: vencida / hoje / amanhã / futuro / '' (sem prazo). */
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
/** Cor da data por categoria de prazo. */
export function corPrazo(cat: CatPrazo): string {
  if (cat === 'vencida') return 'font-medium text-destructive';
  if (cat === 'hoje') return 'font-medium text-yellow-500';
  if (cat === 'amanha') return 'font-medium text-orange-500';
  return 'text-muted-foreground';
}

export function nomeCliente(t: Tarefa) {
  return t.expand?.cliente?.nome_fantasia ?? t.expand?.cliente?.nome ?? '—';
}

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

/** Editor inline de célula (descrição = edita o campo; comentário = adiciona).
 *  Enter salva, Esc cancela, sair do campo (blur) salva. */
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

/* ------------------------------- Componente ------------------------------- */

/**
 * Tabela de tarefas estilo "Negócios" (Projetos): colunas configuráveis,
 * redimensionáveis, filtros por status/prioridade/prazo, ordenação e
 * concluídas recolhidas no fim. Usada na página de Tarefas e na Minha Área.
 * `persistPrefix` separa as preferências (colunas/larguras/ordem) por contexto.
 */
export function TarefasTabela({
  tarefas, onAbrir, persistPrefix, onMudou, etapaSemDots = false, progressoCards, colunasPadrao,
}: {
  tarefas: Tarefa[];
  onAbrir: (id: string) => void;
  persistPrefix: string;
  /** Chamado após salvar uma edição inline (descrição/comentário) p/ recarregar. */
  onMudou?: () => void;
  /** Oculta as bolinhas de progresso na coluna "Etapa atual" (só caption). */
  etapaSemDots?: boolean;
  /** Por tarefa: contador de cards que concluíram a etapa atual (ex.: 3/8). */
  progressoCards?: Record<string, { feitos: number; total: number }>;
  /** Colunas padrão deste contexto (usado só quando não há preferência salva). */
  colunasPadrao?: ColDef[];
}) {
  const uid = pb.authStore?.record?.id ?? '';
  const statuses = useStatuses();
  const [colDefs, setColDefs] = useState<ColDef[]>(() => carregarColunas(persistPrefix, colunasPadrao));
  const [larguras, setLarguras] = useState<Larguras>(() => carregarLarguras(persistPrefix));
  const [ordem, setOrdem] = useState<Ordem>(() => carregarOrdem(persistPrefix));
  const [fStatus, setFStatus] = useState('');
  const [fPrioridade, setFPrioridade] = useState('');
  const [fPrazo, setFPrazo] = useState('');
  const [fMes, setFMes] = useState(() => carregarMes(persistPrefix)); // '' = todos; 'atual'; ou 'YYYY-MM'
  const [concluidasAbertas, setConcluidasAbertas] = useState(false);
  const [atrasadasAbertas, setAtrasadasAbertas] = useState(true);
  // Edição inline de célula + overrides locais p/ refletir na hora.
  const [edit, setEdit] = useState<{ id: string; campo: 'descricao' | 'comentario' } | null>(null);
  const [descOverride, setDescOverride] = useState<Record<string, string>>({});
  const [comentado, setComentado] = useState<Record<string, boolean>>({});

  function abrirEdicao(t: Tarefa, campo: 'descricao' | 'comentario') {
    setEdit({ id: t.id, campo });
  }
  async function salvarCelula(id: string, campo: 'descricao' | 'comentario', valor: string) {
    setEdit(null);
    const v = valor.trim();
    if (campo === 'descricao') {
      setDescOverride((m) => ({ ...m, [id]: v }));
      try { await atualizarTarefa(id, { descricao: v }); onMudou?.(); } catch { /* */ }
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

  // Mês selecionado resolvido ('' = todos; 'atual' vira o mês corrente real).
  const mesSel = fMes === 'atual' ? mesAtualStr() : fMes;
  // Meses presentes nos dados (pra povoar o dropdown), do mais recente ao mais antigo.
  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const t of tarefas) { const c = competencia(t); if (c) set.add(c); }
    return [...set].sort().reverse();
  }, [tarefas]);

  const filtradas = useMemo(() => {
    let arr = tarefas;
    if (fStatus) arr = arr.filter((t) => (t.status ?? '') === fStatus);
    if (fPrioridade) arr = arr.filter((t) => (t.prioridade ?? 'media') === fPrioridade);
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
  }, [tarefas, fStatus, fPrioridade, fPrazo, ordem]);

  const colsVisiveis = useMemo(() => colDefs.filter((c) => c.visivel), [colDefs]);

  function iniciarResize(key: ColKey, thEl: HTMLElement, e: React.MouseEvent) {
    dragResize(thEl, e, (w) => setLarguras((prev) => { const n = { ...prev, [key]: w }; salvarLarguras(persistPrefix, n); return n; }));
  }

  function celula(t: Tarefa, key: ColKey) {
    if (key === 'tarefa') return <span className="font-medium">{t.nome}</span>;
    if (key === 'projeto') return <span className="text-muted-foreground">{t.expand?.projeto?.nome ?? '—'}</span>;
    if (key === 'cliente') {
      const c = t.expand?.cliente;
      if (!c) return <span className="text-muted-foreground">—</span>;
      const nome = nomeCliente(t);
      const logo = c.logo ? logoUrl(c as never, '100x100') : '';
      return logo
        ? <img src={logo} alt={nome} title={nome} loading="lazy" className="size-8 shrink-0 rounded-lg object-cover" />
        : <div title={nome} className={cn('grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white', corAvatar(nome))}>{inicial(nome)}</div>;
    }
    if (key === 'status') return t.status
      ? <Badge className={cn('border text-[10px]', statusTarefaClass(t.status))}>{t.status}</Badge>
      : <span className="text-muted-foreground">—</span>;
    if (key === 'prazo') {
      if (!t.prazo) return <span className="text-muted-foreground">—</span>;
      return <span className={cn('text-xs', corPrazo(catPrazo(t)))}>{prazoBR(t.prazo)}</span>;
    }
    if (key === 'prioridade') return <PrioridadeBadge p={t.prioridade} />;
    if (key === 'descricao') {
      const v = descOverride[t.id] ?? t.descricao ?? '';
      return v
        ? <span className="line-clamp-2 whitespace-pre-wrap text-xs text-foreground">{v}</span>
        : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60"><Plus className="size-3" /> adicionar</span>;
    }
    if (key === 'comentario') {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60">
          <Plus className="size-3" /> {comentado[t.id] ? 'comentar de novo' : 'comentar'}
        </span>
      );
    }
    if (key === 'responsaveis') {
      const rs = t.expand?.responsaveis ?? [];
      if (rs.length === 0) return <span className="grid size-7 place-items-center rounded-full border-2 border-card bg-secondary text-muted-foreground"><UserRound className="size-3.5" /></span>;
      return (
        <div className="flex -space-x-2">
          {rs.slice(0, 3).map((r) => <AvatarMembro key={r.id} membro={r} className="size-7 border-2 border-card text-[10px]" />)}
          {rs.length > 3 && <div className="grid size-7 place-items-center rounded-full border-2 border-card bg-secondary text-[10px] font-bold text-muted-foreground">+{rs.length - 3}</div>}
        </div>
      );
    }
    if (key === 'etapa_atual') {
      return (
        <EtapasStepper
          etapas={t.etapas}
          responsaveis={t.expand?.responsaveis ?? []}
          variant="compact"
          prazo={t.prazo}
          status={t.status}
          mostrarPrazo={false}
          mostrarDots={!etapaSemDots}
          contador={colsVisiveis.some((c) => c.key === 'progresso') ? undefined : progressoCards?.[t.id]}
        />
      );
    }
    if (key === 'resp_etapa') {
      const hasSteps = temEtapas(t);
      if (!hasSteps) {
        const rs = t.expand?.responsaveis ?? [];
        if (rs.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <div className="flex items-center gap-1.5">
            <AvatarMembro membro={rs[0]} className="size-7 text-[10px]" />
            <span className="truncate text-xs text-muted-foreground">{rs[0]?.nome?.split(' ')[0] ?? ''}</span>
          </div>
        );
      }
      const atual = etapaAtual(t.etapas);
      if (!atual) return <span className="text-xs text-emerald-500">Concluído</span>;
      if (atual.tipo === 'aprovacao_cliente') return <span className="text-xs text-amber-500/90">Aprovação do cliente</span>;
      const resp = (t.expand?.responsaveis ?? []).find((r) => r.id === atual.responsavel);
      if (!resp) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <div className="flex items-center gap-1.5">
          <AvatarMembro membro={resp} className="size-7 text-[10px]" />
          <span className="truncate text-xs text-muted-foreground">{resp.nome?.split(' ')[0] ?? ''}</span>
        </div>
      );
    }
    if (key === 'prazo_etapa') {
      // Sem etapas: cai no prazo da própria tarefa (prazo efetivo).
      if (!temEtapas(t)) {
        if (!t.prazo) return <span className="text-xs text-muted-foreground">—</span>;
        return <span className={cn('text-xs', corPrazo(catPrazo(t)))}>{prazoBR(t.prazo)}</span>;
      }
      const atual = etapaAtual(t.etapas);
      if (!atual) return <span className="text-xs text-emerald-500">Concluído</span>;
      if (!atual.prazo) return <span className="text-xs text-muted-foreground">—</span>;
      const cat = catPrazoData(atual.prazo, tarefaConcluida(t.status));
      return <span className={cn('text-xs', corPrazo(cat))}>{prazoBR(atual.prazo)}</span>;
    }
    if (key === 'status_etapa') {
      if (tarefaConcluida(t.status)) return <Badge className="border border-emerald-500/50 bg-emerald-500/15 text-[10px] text-emerald-500">Concluído</Badge>;
      if (!temEtapas(t)) return <span className="text-xs text-muted-foreground">—</span>;
      if (!etapaAtual(t.etapas)) return <Badge className="border border-emerald-500/50 bg-emerald-500/15 text-[10px] text-emerald-500">Concluído</Badge>;
      if (ehVezDoUsuario(t, uid)) return <Badge className="border border-orange-500/50 bg-orange-500/15 text-[10px] text-orange-500">Concluir Etapa</Badge>;
      if (aguardandoAprovacaoCliente(t)) return <Badge className="border border-yellow-500/50 bg-yellow-500/15 text-[10px] text-yellow-500">Aguardando Cliente</Badge>;
      return <Badge className="border border-amber-700/50 bg-amber-700/15 text-[10px] text-amber-600">Aguardando Equipe</Badge>;
    }
    if (key === 'progresso') {
      const pr = progressoCards?.[t.id];
      if (!pr || pr.total === 0) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <span className={cn(
          'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums',
          pr.feitos >= pr.total
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
            : 'border-amber-500/40 bg-amber-500/10 text-amber-500',
        )}>
          {pr.feitos}/{pr.total} posts
        </span>
      );
    }
    return null;
  }

  let abertas = filtradas.filter((t) => !tarefaConcluida(t.status));
  let concluidas = filtradas.filter((t) => tarefaConcluida(t.status));
  // Atrasadas = abertas com competência ANTERIOR ao mês selecionado (ficam à vista, à parte).
  let atrasadas: Tarefa[] = [];
  if (mesSel) {
    const noMes = (t: Tarefa) => competencia(t) === mesSel;
    const antes = (t: Tarefa) => { const c = competencia(t); return !!c && c < mesSel; };
    atrasadas = abertas.filter(antes);
    abertas = abertas.filter(noMes);
    concluidas = concluidas.filter(noMes);
  }

  function tabela(linhas: Tarefa[], vazio: string) {
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
                <tr><td colSpan={colsVisiveis.length || 1} className="px-5 py-12 text-center text-sm text-muted-foreground">{vazio}</td></tr>
              ) : linhas.map((t) => (
                <tr key={t.id} onClick={() => onAbrir(t.id)}
                  className={cn('border-b border-border last:border-0 transition-colors hover:bg-secondary/50', tarefaConcluida(t.status) && 'opacity-60')}>
                  {colsVisiveis.map((col) => {
                    const editavel = COLS_EDITAVEIS.has(col.key);
                    const emEdicao = editavel && edit?.id === t.id && edit.campo === col.key;
                    return (
                      <td key={col.key}
                        onClick={editavel
                          ? (e) => { e.stopPropagation(); if (!emEdicao) abrirEdicao(t, col.key as 'descricao' | 'comentario'); }
                          : undefined}
                        className={cn('overflow-hidden px-4 py-3 align-middle text-muted-foreground',
                          editavel ? 'cursor-text' : 'cursor-pointer')}>
                        {emEdicao ? (
                          <CellEditor
                            valorInicial={col.key === 'descricao' ? (descOverride[t.id] ?? t.descricao ?? '') : ''}
                            placeholder={col.key === 'descricao' ? 'Descrição da tarefa…' : 'Escreva um comentário…'}
                            onSalvar={(v) => salvarCelula(t.id, col.key as 'descricao' | 'comentario', v)}
                            onCancelar={() => setEdit(null)}
                          />
                        ) : celula(t, col.key)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Controles: filtros (dropdown) + ordenar + colunas */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Filtrar por status"
          className={cn(filtroCls, fStatus ? 'text-foreground' : 'text-muted-foreground')}>
          <option value="">Status</option>
          {statuses.map((s) => <option key={s.id} value={s.nome}>{s.nome}</option>)}
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

      {tabela(abertas, mesSel ? `Nenhuma tarefa em ${rotuloMes(mesSel)}.` : 'Nenhuma tarefa neste filtro.')}

      <p className="pt-1 text-right text-xs text-muted-foreground">
        {abertas.length} {abertas.length === 1 ? 'tarefa em aberto' : 'tarefas em aberto'}
      </p>

      {/* Atrasadas de meses anteriores — à vista, mas separadas */}
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

      {/* Concluídas — recolhidas no final */}
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
