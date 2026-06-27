import { useEffect, useRef, useState } from 'react';
import {
  SlidersHorizontal, GripVertical, UserRound, ChevronDown, Plus,
  Check, X, Trash2, Maximize2, Layers, ArrowUpDown, ArrowUp, ArrowDown,
  Filter, Bookmark, Save, Download, EyeOff, Rows3, Rows4,
} from 'lucide-react';
import type { Tarefa } from './types';
import { prazoBR, tarefaConcluida } from './format';
import { StatusOpcaoChip } from './StatusOpcaoChip';
import { atualizarTarefa, removerTarefa } from './tarefasService';
import { addComentario } from '@/atividade/atividadeService';
import {
  useStatusGlobal, opcoesEmOrdemDeColuna, resolverOpcao,
  espelhoStatus, getGrupos, opcoesDoGrupo, opcaoIdPorNome,
} from './status';
import {
  catPrazoData, corPrazo, pesoPrioridade, rotuloPrioridade, nomeClienteDe,
  type GroupBy, GROUPS,
  type FiltroCampo, type FiltroRegra, CAMPOS_FILTRO, CATS_PRAZO,
  type OrdemRegra, ORDEM_CAMPOS, aplicarFiltros, aplicarOrdens, modoManual,
  type ViewState, type ViewSalva, novoId, mesmoEstado,
  carregarViewState, salvarViewState, carregarViews, salvarViews,
  carregarViewAtiva, salvarViewAtiva,
} from './tabelaView';
import { AvatarMembro } from '@/dashboard/AvatarMembro';
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { listProjetos } from '@/projetos/projetosService';
import type { Projeto } from '@/projetos/types';
import {
  clientesComProjetoDoTipo, projetosDoClienteTipo, projetoPadraoDoCliente, projetoAtivo,
} from '@/projetos/relacaoTarefa';
import { listClientes, logoUrl } from '@/clientes/clientesService';
import type { Cliente } from '@/clientes/types';
import { nomeExibicao } from '@/clientes/types';
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
  | 'etiquetas' | 'descricao' | 'comentario' | 'criado' | 'atualizado';

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
  { key: 'criado', label: 'Criado em', visivel: false },
  { key: 'atualizado', label: 'Atualizado em', visivel: false },
];

/** Mapa coluna → campo de ordenação (quando aplicável), p/ o menu do cabeçalho (N1). */
const COL_ORDEM: Partial<Record<ColKey, OrdemRegra['campo']>> = {
  tarefa: 'nome', status: 'status', prazo: 'prazo', prioridade: 'prioridade', cliente: 'cliente', criado: 'criado',
};
/** Mapa coluna → campo de filtro (quando aplicável), p/ o menu do cabeçalho (N1). */
const COL_FILTRO: Partial<Record<ColKey, FiltroCampo>> = {
  tarefa: 'nome', status: 'status', prazo: 'prazo', prioridade: 'prioridade', cliente: 'cliente', responsaveis: 'responsavel', etiquetas: 'etiqueta',
};

/** dd/mm/aaaa a partir de um ISO datetime do PocketBase. */
function fmtDataHora(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const EDITAVEIS = new Set<ColKey>(['tarefa', 'cliente', 'projeto', 'status', 'prazo', 'prioridade', 'responsaveis', 'etiquetas', 'descricao', 'comentario']);

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

/** Arrasto de redimensionamento de coluna. */
function dragResize(thEl: HTMLElement, e: React.MouseEvent, aplicar: (largura: number) => void) {
  e.preventDefault(); e.stopPropagation();
  const base = thEl.getBoundingClientRect().width;
  const startX = e.clientX; const MIN = 80;
  document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
  function onMove(ev: MouseEvent) { aplicar(Math.max(MIN, Math.round(base + (ev.clientX - startX)))); }
  function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; }
  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
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
  valorInicial: string; placeholder: string; onSalvar: (v: string) => void; onCancelar: () => void;
}) {
  const [v, setV] = useState(valorInicial);
  const confirmado = useRef(false);
  function confirmar() { if (confirmado.current) return; confirmado.current = true; onSalvar(v); }
  return (
    <textarea
      autoFocus value={v} placeholder={placeholder}
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

/** Editor inline de etiquetas: chips + input. */
function EtiquetasEditor({ valorInicial, onSalvar, onFechar }: {
  valorInicial: string[]; onSalvar: (tags: string[]) => void; onFechar: () => void;
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
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => remover(t)} aria-label={`Remover ${t}`} className="text-muted-foreground hover:text-destructive">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        autoFocus value={novo} placeholder="tag…"
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

/** Chip de um filtro ativo: rótulo (abre editor) + remover. (S6) */
function ChipFiltro({ regra, rotulo, clientes, usuarios, onChange, onRemove }: {
  regra: FiltroRegra;
  rotulo: string;
  clientes: { id: string; nome: string }[];
  usuarios: Usuario[];
  onChange: (r: FiltroRegra) => void;
  onRemove: () => void;
}) {
  const meta = CAMPOS_FILTRO[regra.campo];
  return (
    <span className="inline-flex items-center overflow-hidden rounded-full border border-primary/40 bg-primary/10 text-xs text-primary">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="px-2.5 py-1 hover:bg-primary/15">{rotulo}</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
          {meta.ops.length > 1 && (
            <>
              <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">Condição</DropdownMenuLabel>
              <div className="flex gap-1 px-2 pb-1">
                {meta.ops.map((o) => (
                  <button key={o.v} type="button"
                    onClick={() => onChange({ ...regra, op: o.v })}
                    className={cn('rounded px-2 py-0.5 text-xs', regra.op === o.v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/70')}>
                    {o.label}
                  </button>
                ))}
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          {meta.tipo === 'opcao' && getGrupos().map((g) => {
            const ops = opcoesDoGrupo(g.id);
            if (!ops.length) return null;
            return (
              <div key={g.id}>
                <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">{g.nome}</DropdownMenuLabel>
                {ops.map((o) => (
                  <DropdownMenuItem key={o.id} onSelect={() => onChange({ ...regra, valor: o.id })}>
                    <Check className={cn('mr-2 size-3.5', regra.valor === o.id ? 'opacity-100' : 'opacity-0')} />{o.nome}
                  </DropdownMenuItem>
                ))}
              </div>
            );
          })}
          {meta.tipo === 'prioridade' && (['alta', 'media', 'baixa'] as const).map((p) => (
            <DropdownMenuItem key={p} onSelect={() => onChange({ ...regra, valor: p })}>
              <Check className={cn('mr-2 size-3.5', regra.valor === p ? 'opacity-100' : 'opacity-0')} />{rotuloPrioridade(p)}
            </DropdownMenuItem>
          ))}
          {meta.tipo === 'cat-prazo' && CATS_PRAZO.map((c) => (
            <DropdownMenuItem key={c.v} onSelect={() => onChange({ ...regra, valor: c.v })}>
              <Check className={cn('mr-2 size-3.5', regra.valor === c.v ? 'opacity-100' : 'opacity-0')} />{c.label}
            </DropdownMenuItem>
          ))}
          {meta.tipo === 'cliente' && (clientes.length === 0
            ? <DropdownMenuItem disabled>Sem clientes</DropdownMenuItem>
            : clientes.map((c) => (
              <DropdownMenuItem key={c.id} onSelect={() => onChange({ ...regra, valor: c.id })}>
                <Check className={cn('mr-2 size-3.5', regra.valor === c.id ? 'opacity-100' : 'opacity-0')} />{c.nome}
              </DropdownMenuItem>
            )))}
          {meta.tipo === 'usuario' && usuarios.map((u) => (
            <DropdownMenuItem key={u.id} onSelect={() => onChange({ ...regra, valor: u.id })}>
              <Check className={cn('mr-2 size-3.5', regra.valor === u.id ? 'opacity-100' : 'opacity-0')} />{u.nome || u.email}
            </DropdownMenuItem>
          ))}
          {meta.tipo === 'texto' && (
            <div className="p-2">
              <input
                autoFocus defaultValue={regra.valor} placeholder="digite…"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onChange({ ...regra, valor: e.target.value })}
                className="h-8 w-full rounded border border-input bg-background px-2 text-xs focus-visible:outline-none"
              />
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button" onClick={onRemove} aria-label="Remover filtro" className="px-1.5 py-1 hover:bg-primary/20">
        <X className="size-3" />
      </button>
    </span>
  );
}

/* ------------------------------- Componente principal --------------------- */

/**
 * Tabela de tarefas estilo Notion. Sprint 1: edição inline ampla, agrupamento,
 * ações em massa, rodapé. Sprint 2: filtros compostos (chips), ordenação
 * multinível e visões salvas — tudo persistido por contexto (`persistPrefix`).
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
  const [projetosTodos, setProjetosTodos] = useState<Projeto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  useEffect(() => {
    listUsuarios().then(setUsuarios).catch(() => setUsuarios([]));
    listProjetos().then(setProjetosTodos).catch(() => setProjetosTodos([]));
    listClientes('').then(setClientes).catch(() => setClientes([]));
  }, []);

  const [colDefs, setColDefs] = useState<ColDef[]>(() => carregarColunas(persistPrefix, colunasPadrao));
  const [larguras, setLarguras] = useState<Larguras>(() => carregarLarguras(persistPrefix));
  const [fMes, setFMes] = useState(() => carregarMes(persistPrefix));
  const [compacto, setCompacto] = useState(() => {
    try { return localStorage.getItem(`${persistPrefix}-densidade-v1`) === 'compacto'; } catch { return false; }
  });

  // Estado de visão (filtros + ordens + agrupamento) + visões salvas (S5/S6/S7).
  const [viewState, setViewState] = useState<ViewState>(() => carregarViewState(persistPrefix));
  const [views, setViews] = useState<ViewSalva[]>(() => carregarViews(persistPrefix));
  const [viewAtiva, setViewAtiva] = useState<string>(() => carregarViewAtiva(persistPrefix));
  const [nomeNovaView, setNomeNovaView] = useState('');

  const [concluidasAbertas, setConcluidasAbertas] = useState(false);
  const [atrasadasAbertas, setAtrasadasAbertas] = useState(true);
  const [gruposFechados, setGruposFechados] = useState<Set<string>>(new Set());

  const [editCell, setEditCell] = useState<{ id: string; campo: ColKey } | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<Tarefa>>>({});
  const [descOverride, setDescOverride] = useState<Record<string, string>>({});
  const [comentado, setComentado] = useState<Record<string, boolean>>({});

  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);

  /* ----------------------------- View state helpers ----------------------- */

  function aplicarEstado(parcial: Partial<ViewState>) {
    setViewState((v) => { const n = { ...v, ...parcial }; salvarViewState(persistPrefix, n); return n; });
  }
  const filtros = viewState.filtros;
  const ordens = viewState.ordens;
  const groupBy = viewState.groupBy;

  function valorPadraoFiltro(campo: FiltroCampo): string {
    if (campo === 'status') return opcoesFiltro[0]?.id ?? '';
    if (campo === 'prioridade') return 'alta';
    if (campo === 'prazo') return 'vencida';
    if (campo === 'cliente') return clientesOpcoes[0]?.id ?? '';
    if (campo === 'responsavel') return usuarios[0]?.id ?? '';
    return '';
  }
  function addFiltro(campo: FiltroCampo) {
    const regra: FiltroRegra = { id: novoId('f'), campo, op: CAMPOS_FILTRO[campo].ops[0].v, valor: valorPadraoFiltro(campo) };
    aplicarEstado({ filtros: [...filtros, regra] });
  }
  function updateFiltro(r: FiltroRegra) { aplicarEstado({ filtros: filtros.map((x) => x.id === r.id ? r : x) }); }
  function removeFiltro(id: string) { aplicarEstado({ filtros: filtros.filter((x) => x.id !== id) }); }

  function addOrdem() {
    const usados = new Set(ordens.map((o) => o.campo));
    const campo = (ORDEM_CAMPOS.find((c) => !usados.has(c.v))?.v) ?? 'prazo';
    aplicarEstado({ ordens: [...ordens, { campo, dir: 'asc' }] });
  }
  function updateOrdem(i: number, parcial: Partial<OrdemRegra>) {
    aplicarEstado({ ordens: ordens.map((o, idx) => idx === i ? { ...o, ...parcial } : o) });
  }
  function removeOrdem(i: number) { aplicarEstado({ ordens: ordens.filter((_, idx) => idx !== i) }); }

  function setGroupBy(g: GroupBy) { aplicarEstado({ groupBy: g }); }

  /* ----------------------------- Visões salvas (S5) ----------------------- */

  function persistViews(lista: ViewSalva[]) { setViews(lista); salvarViews(persistPrefix, lista); }
  function setAtiva(id: string) { setViewAtiva(id); salvarViewAtiva(persistPrefix, id); }

  function aplicarView(v: ViewSalva) {
    setViewState(v.estado); salvarViewState(persistPrefix, v.estado); setAtiva(v.id);
  }
  function salvarComoNova() {
    const nome = nomeNovaView.trim();
    if (!nome) return;
    const nova: ViewSalva = { id: novoId('v'), nome, estado: viewState };
    persistViews([...views, nova]); setAtiva(nova.id); setNomeNovaView('');
  }
  function atualizarViewAtiva() {
    if (!viewAtiva) return;
    persistViews(views.map((v) => v.id === viewAtiva ? { ...v, estado: viewState } : v));
  }
  function excluirView(id: string) {
    persistViews(views.filter((v) => v.id !== id));
    if (viewAtiva === id) setAtiva('');
  }
  function limparVisao() {
    const vazio: ViewState = { filtros: [], ordens: [], groupBy: 'none' };
    setViewState(vazio); salvarViewState(persistPrefix, vazio); setAtiva('');
  }

  const viewAtivaObj = views.find((v) => v.id === viewAtiva);
  const modificada = !!viewAtivaObj && !mesmoEstado(viewState, viewAtivaObj.estado);

  /* ------------------------------ Persistência colunas/mês ---------------- */

  function toggleCol(k: ColKey) {
    setColDefs((cs) => { const n = cs.map((c) => c.key === k ? { ...c, visivel: !c.visivel } : c); salvarColunas(persistPrefix, n); return n; });
  }
  function moverCol(de: number, para: number) {
    setColDefs((cs) => {
      if (de === para || para < 0 || para >= cs.length) return cs;
      const n = [...cs]; const [it] = n.splice(de, 1); n.splice(para, 0, it); salvarColunas(persistPrefix, n); return n;
    });
  }
  function trocarMes(m: string) { setFMes(m); try { localStorage.setItem(`${persistPrefix}-mes-v1`, m); } catch { /* */ } }
  function trocarDensidade(v: boolean) { setCompacto(v); try { localStorage.setItem(`${persistPrefix}-densidade-v1`, v ? 'compacto' : 'confortavel'); } catch { /* */ } }

  // N1 — menu do cabeçalho: ordenar por uma coluna (substitui a ordenação atual por 1 critério).
  function ordenarPorColuna(key: ColKey, dir: 'asc' | 'desc') {
    const campo = COL_ORDEM[key];
    if (campo) aplicarEstado({ ordens: [{ campo, dir }] });
  }

  // N5 — exporta a visão atual (linhas filtradas+ordenadas, colunas visíveis) em CSV.
  function exportarCSV() {
    const aspas = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const cabecalho = colsVisiveis.map((c) => aspas(c.label)).join(',');
    const linhas = filtradas.map((t) => colsVisiveis.map((c) => aspas(valorCSV(t, c.key))).join(','));
    const csv = '﻿' + [cabecalho, ...linhas].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tarefas-${persistPrefix.replace(/[^a-z0-9]+/gi, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function valorCSV(t: Tarefa, key: ColKey): string {
    const te = tarefaMesclada(t);
    switch (key) {
      case 'tarefa': return te.nome ?? '';
      case 'cliente': return te.expand?.cliente ? nomeClienteDe(te) : '';
      case 'projeto': return te.expand?.projeto?.nome ?? '';
      case 'status': return resolverOpcao(te.status_opcao, te.status)?.nome ?? te.status ?? '';
      case 'prazo': return te.prazo ? prazoBR(te.prazo) : '';
      case 'prioridade': return rotuloPrioridade(te.prioridade);
      case 'responsaveis': return (te.expand?.responsaveis ?? []).map((r) => r.nome ?? '').filter(Boolean).join('; ');
      case 'etiquetas': return (te.etiquetas ?? []).join('; ');
      case 'descricao': return te.descricao ?? '';
      case 'criado': return fmtDataHora(te.created);
      case 'atualizado': return fmtDataHora(te.updated);
      default: return '';
    }
  }

  const mesSel = fMes === 'atual' ? mesAtualStr() : fMes;
  const mesesDisponiveis = (() => {
    const set = new Set<string>();
    for (const t of tarefas) { const c = competencia(t); if (c) set.add(c); }
    return [...set].sort().reverse();
  })();

  const clientesOpcoes = (() => {
    const m = new Map<string, string>();
    for (const t of tarefas) if (t.cliente && t.expand?.cliente) m.set(t.cliente, nomeClienteDe(t));
    return [...m.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  })();

  const tarefaMesclada = (t: Tarefa) => ({ ...t, ...(localOverrides[t.id] ?? {}) } as Tarefa);
  const statusEfetivo = (t: Tarefa) => localOverrides[t.id]?.status ?? t.status;

  const filtradas = aplicarOrdens(aplicarFiltros(tarefas, filtros, tarefaMesclada), ordens, tarefaMesclada);

  const colsVisiveis = colDefs.filter((c) => c.visivel);

  function iniciarResize(key: ColKey, thEl: HTMLElement, e: React.MouseEvent) {
    dragResize(thEl, e, (w) => setLarguras((prev) => { const n = { ...prev, [key]: w }; salvarLarguras(persistPrefix, n); return n; }));
  }

  /* ------------------------------ Salvar inline ----------------------------- */

  async function salvarInline(id: string, parcial: Partial<Tarefa>) {
    setLocalOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...parcial } }));
    try {
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
  /** Define cliente + projeto na linha (expand otimista p/ logo/nome; persiste só ids). */
  function salvarClienteProjeto(id: string, clienteId: string, projetoId: string) {
    const cli = clientes.find((c) => c.id === clienteId);
    const proj = projetosTodos.find((p) => p.id === projetoId);
    const atual = localOverrides[id]?.expand ?? tarefas.find((t) => t.id === id)?.expand;
    salvarInline(id, {
      cliente: clienteId,
      projeto: projetoId,
      expand: {
        ...atual,
        cliente: cli ? { id: cli.id, nome: cli.nome, nome_fantasia: cli.nome_fantasia, logo: cli.logo } : undefined,
        projeto: proj ? { id: proj.id, nome: proj.nome, tipo: proj.tipo } : undefined,
      },
    } as Partial<Tarefa>);
  }

  function salvarResponsaveis(id: string, ids: string[]) {
    const expandResp = ids
      .map((uid) => usuarios.find((u) => u.id === uid))
      .filter(Boolean)
      .map((u) => ({ id: u!.id, nome: u!.nome, email: u!.email }));
    const atual = localOverrides[id]?.expand ?? tarefas.find((t) => t.id === id)?.expand;
    salvarInline(id, { responsaveis: ids, expand: { ...atual, responsaveis: expandResp } } as Partial<Tarefa>);
  }

  /* ----------------------------- Seleção em massa (S3) -------------------- */

  function toggleSel(id: string) {
    setSelecao((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleSelTodas(ids: string[], marcar: boolean) {
    setSelecao((s) => { const n = new Set(s); for (const id of ids) { if (marcar) n.add(id); else n.delete(id); } return n; });
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
  async function apagarEmMassa() {
    const ids = [...selecao];
    if (!ids.length) return;
    limparSelecao();
    try { await Promise.all(ids.map((id) => removerTarefa(id))); onMudou?.(); } catch { /* */ }
  }

  /* ----------------------------- Reordenar por arrasto (S8) --------------- */

  // Só faz sentido no modo manual (sem critérios de ordenação) e sem agrupar.
  const reordenavel = modoManual(ordens) && groupBy === 'none';

  /** Move `arrastadoId` para antes de `alvoId` na lista visível e regrava `ordem`. */
  async function reordenar(linhas: Tarefa[], arrastadoId: string, alvoId: string) {
    if (arrastadoId === alvoId) return;
    const ids = linhas.map((l) => l.id);
    const de = ids.indexOf(arrastadoId);
    const para = ids.indexOf(alvoId);
    if (de < 0 || para < 0) return;
    const nova = [...linhas];
    const [it] = nova.splice(de, 1);
    nova.splice(para, 0, it);
    // Regrava ordem sequencial (0,10,20…); persiste só o que mudou.
    const mudancas: { id: string; ordem: number }[] = [];
    nova.forEach((t, i) => {
      const ordemNova = i * 10;
      if ((tarefaMesclada(t).ordem ?? 0) !== ordemNova) mudancas.push({ id: t.id, ordem: ordemNova });
    });
    if (!mudancas.length) return;
    setLocalOverrides((prev) => {
      const n = { ...prev };
      for (const m of mudancas) n[m.id] = { ...(n[m.id] ?? {}), ordem: m.ordem };
      return n;
    });
    try { await Promise.all(mudancas.map((m) => atualizarTarefa(m.id, { ordem: m.ordem } as never))); onMudou?.(); } catch { /* */ }
  }

  /* ----------------------------- Navegação por teclado (S9) --------------- */

  function onRowKey(e: React.KeyboardEvent<HTMLTableRowElement>, id: string) {
    // Só age quando a própria linha está focada (não interfere nos editores inline).
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = Array.from(e.currentTarget.closest('tbody')?.querySelectorAll<HTMLTableRowElement>('tr[data-row]') ?? []);
      const i = rows.indexOf(e.currentTarget);
      rows[i + (e.key === 'ArrowDown' ? 1 : -1)]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault(); onAbrir(id);
    } else if (e.key === ' ') {
      e.preventDefault(); toggleSel(id);
    }
  }

  /* ------------------------------- Rótulo de chip --------------------------- */

  function opcaoNome(id: string) { return opcoesFiltro.find((o) => o.id === id)?.nome ?? '—'; }
  function rotuloFiltro(r: FiltroRegra): string {
    const meta = CAMPOS_FILTRO[r.campo];
    const opLabel = meta.ops.find((o) => o.v === r.op)?.label ?? '';
    let val = r.valor || '…';
    if (r.campo === 'status') val = opcaoNome(r.valor);
    else if (r.campo === 'prioridade') val = rotuloPrioridade(r.valor);
    else if (r.campo === 'prazo') val = CATS_PRAZO.find((c) => c.v === r.valor)?.label ?? r.valor;
    else if (r.campo === 'cliente') val = clientesOpcoes.find((c) => c.id === r.valor)?.nome ?? '—';
    else if (r.campo === 'responsavel') { const u = usuarios.find((x) => x.id === r.valor); val = u?.nome || u?.email || '—'; }
    return `${meta.label} ${opLabel} ${val}`;
  }

  /* ------------------------------- Célula ----------------------------------- */

  function celula(t: Tarefa, key: ColKey) {
    const te = tarefaMesclada(t);
    const ativo = editCell?.id === t.id && editCell.campo === key;

    if (key === 'tarefa') {
      if (ativo) {
        return (
          <input
            autoFocus defaultValue={te.nome}
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
          <button type="button" title="Abrir tarefa" aria-label="Abrir tarefa"
            onClick={(e) => { e.stopPropagation(); onAbrir(t.id); }}
            className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary hover:text-foreground group-hover:opacity-100">
            <Maximize2 className="size-3.5" />
          </button>
        </span>
      );
    }

    if (key === 'projeto') {
      if (ativo) {
        const tipoLinha = te.tipo || undefined;
        const cands = te.cliente ? projetosDoClienteTipo(projetosTodos, te.cliente, tipoLinha) : [];
        return (
          <select
            autoFocus value={te.projeto ?? ''} onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const pid = e.target.value;
              const proj = projetosTodos.find((p) => p.id === pid);
              salvarClienteProjeto(t.id, proj?.cliente ?? te.cliente ?? '', pid);
              setEditCell(null);
            }}
            onBlur={() => setEditCell(null)}
            className="h-7 w-full rounded border border-input bg-background px-1 text-xs focus-visible:outline-none"
          >
            <option value="">{te.cliente ? '— sem projeto —' : 'selecione o cliente'}</option>
            {cands.map((p) => <option key={p.id} value={p.id}>{p.nome}{projetoAtivo(p) ? '' : ' (inativo)'}</option>)}
          </select>
        );
      }
      return <span className="text-sm text-muted-foreground">{te.expand?.projeto?.nome ?? '—'}</span>;
    }

    if (key === 'cliente') {
      if (ativo) {
        const tipoLinha = te.tipo || undefined;
        const set = clientesComProjetoDoTipo(projetosTodos, tipoLinha);
        const opts = tipoLinha ? clientes.filter((c) => set.has(c.id)) : clientes;
        return (
          <select
            autoFocus value={te.cliente ?? ''} onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const cid = e.target.value;
              const pid = cid ? projetoPadraoDoCliente(projetosTodos, cid, tipoLinha) : '';
              salvarClienteProjeto(t.id, cid, pid);
              setEditCell(null);
            }}
            onBlur={() => setEditCell(null)}
            className="h-7 w-full rounded border border-input bg-background px-1 text-xs focus-visible:outline-none"
          >
            <option value="">— sem cliente —</option>
            {opts.map((c) => <option key={c.id} value={c.id}>{nomeExibicao(c)}</option>)}
          </select>
        );
      }
      const c = te.expand?.cliente;
      if (!c) return <span className="text-muted-foreground">—</span>;
      const nome = nomeClienteDe(te);
      const logo = c.logo ? logoUrl(c as never, '100x100') : '';
      return logo
        ? <img src={logo} alt={nome} title={nome} loading="lazy" className="size-8 shrink-0 rounded-lg object-cover" />
        : <div title={nome} className={cn('grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white', corAvatar(nome))}>{inicial(nome)}</div>;
    }

    if (key === 'status') {
      if (ativo) {
        return (
          <select
            autoFocus value={te.status_opcao ?? opcaoIdPorNome(te.status) ?? ''}
            onChange={(e) => { if (e.target.value) salvarInline(t.id, espelhoStatus(e.target.value)); setEditCell(null); }}
            onBlur={() => setEditCell(null)} onClick={(e) => e.stopPropagation()}
            className="h-7 w-full rounded border border-input bg-background px-1 text-xs focus-visible:outline-none"
          >
            {getGrupos().map((g) => {
              const ops = opcoesDoGrupo(g.id);
              if (!ops.length) return null;
              return <optgroup key={g.id} label={g.nome}>{ops.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</optgroup>;
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
            type="date" autoFocus defaultValue={(te.prazo ?? '').slice(0, 10)}
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
      return <span className={cn('text-xs', corPrazo(catPrazoData(te.prazo, tarefaConcluida(te.status))))}>{prazoBR(te.prazo)}</span>;
    }

    if (key === 'prioridade') {
      if (ativo) {
        return (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {(['alta', 'media', 'baixa'] as const).map((p) => (
              <button key={p} type="button" onClick={() => { salvarInline(t.id, { prioridade: p }); setEditCell(null); }}
                className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                  p === 'alta' && 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
                  p === 'media' && 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30',
                  p === 'baixa' && 'bg-sky-500/20 text-sky-400 hover:bg-sky-500/30')}>
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
          <DropdownMenuTrigger asChild><button type="button" onClick={(e) => e.stopPropagation()}>{conteudo}</button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 w-60 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {usuarios.map((u) => {
              const sel = idsAtuais.includes(u.id);
              return (
                <DropdownMenuItem key={u.id} onSelect={(e) => {
                  e.preventDefault();
                  salvarResponsaveis(t.id, sel ? idsAtuais.filter((x) => x !== u.id) : [...idsAtuais, u.id]);
                }}>
                  <Check className={cn('mr-2 size-3.5', sel ? 'opacity-100' : 'opacity-0')} />{u.nome || u.email}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    if (key === 'etiquetas') {
      if (ativo) {
        return <EtiquetasEditor valorInicial={te.etiquetas ?? []} onSalvar={(tags) => salvarInline(t.id, { etiquetas: tags })} onFechar={() => setEditCell(null)} />;
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
        return <CellEditor valorInicial={descOverride[t.id] ?? te.descricao ?? ''} placeholder="Descrição da tarefa…" onSalvar={(v) => salvarCelula(t.id, 'descricao', v)} onCancelar={() => setEditCell(null)} />;
      }
      const v = descOverride[t.id] ?? te.descricao ?? '';
      return v
        ? <span className="line-clamp-2 whitespace-pre-wrap text-xs text-foreground">{v}</span>
        : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/50"><Plus className="size-3" /> adicionar</span>;
    }

    if (key === 'comentario') {
      if (ativo) {
        return <CellEditor valorInicial="" placeholder="Escreva um comentário…" onSalvar={(v) => salvarCelula(t.id, 'comentario', v)} onCancelar={() => setEditCell(null)} />;
      }
      return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/50"><Plus className="size-3" /> {comentado[t.id] ? 'comentar de novo' : 'comentar'}</span>;
    }

    if (key === 'criado') return <span className="text-xs text-muted-foreground">{fmtDataHora(te.created) || '—'}</span>;
    if (key === 'atualizado') return <span className="text-xs text-muted-foreground">{fmtDataHora(te.updated) || '—'}</span>;

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
      const nome = te.expand?.cliente ? nomeClienteDe(te) : '';
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
    const p = te.prioridade ?? 'media';
    return { chave: p, label: rotuloPrioridade(p), ordem: pesoPrioridade(p) };
  }

  const grupos = (() => {
    if (groupBy === 'none') return [];
    const mapa = new Map<string, { label: string; ordem: number; linhas: Tarefa[] }>();
    for (const t of filtradas) {
      const { chave, label, ordem: ord } = chaveGrupo(t);
      if (!mapa.has(chave)) mapa.set(chave, { label, ordem: ord, linhas: [] });
      mapa.get(chave)!.linhas.push(t);
    }
    return [...mapa.entries()].map(([chave, g]) => ({ chave, ...g }))
      .sort((a, b) => a.ordem - b.ordem || a.label.localeCompare(b.label, 'pt-BR'));
  })();

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
      const venc = linhas.filter((t) => catPrazoData(tarefaMesclada(t).prazo, tarefaConcluida(statusEfetivo(t))) === 'vencida').length;
      return venc > 0 ? <span className="text-destructive">{venc} vencida{venc > 1 ? 's' : ''}</span> : <span className="text-muted-foreground/50">—</span>;
    }
    if (key === 'prioridade') {
      const alta = linhas.filter((t) => (tarefaMesclada(t).prioridade ?? 'media') === 'alta').length;
      return alta > 0 ? <span>{alta} alta{alta > 1 ? 's' : ''}</span> : <span className="text-muted-foreground/50">—</span>;
    }
    return null;
  }

  /* -------------------------------- Render tabela --------------------------- */

  function tabela(linhas: Tarefa[], vazio: string, comNova = false, comRodape = true, ordenavel = false) {
    const idsLinhas = linhas.map((l) => l.id);
    const todasSel = idsLinhas.length > 0 && idsLinhas.every((id) => selecao.has(id));
    return (
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: ordenavel ? 64 : 44 }} />
              {colsVisiveis.map((col) => <col key={col.key} style={larguras[col.key] ? { width: larguras[col.key] } : undefined} />)}
            </colgroup>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3">
                  <input type="checkbox" aria-label="Selecionar todas" checked={todasSel}
                    onChange={(e) => toggleSelTodas(idsLinhas, e.target.checked)}
                    className="size-3.5 cursor-pointer accent-primary" />
                </th>
                {colsVisiveis.map((col) => {
                  const podeOrdenar = !!COL_ORDEM[col.key];
                  const podeFiltrar = !!COL_FILTRO[col.key];
                  return (
                    <th key={col.key} className="relative px-4 py-3 font-medium">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="flex max-w-full items-center gap-1 truncate uppercase hover:text-foreground">{col.label}</button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44">
                          {podeOrdenar && (
                            <>
                              <DropdownMenuItem onSelect={() => ordenarPorColuna(col.key, 'asc')}><ArrowUp className="mr-2 size-3.5" /> Ordenar ↑</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => ordenarPorColuna(col.key, 'desc')}><ArrowDown className="mr-2 size-3.5" /> Ordenar ↓</DropdownMenuItem>
                            </>
                          )}
                          {podeFiltrar && (
                            <DropdownMenuItem onSelect={() => addFiltro(COL_FILTRO[col.key]!)}><Filter className="mr-2 size-3.5" /> Filtrar por…</DropdownMenuItem>
                          )}
                          {(podeOrdenar || podeFiltrar) && <DropdownMenuSeparator />}
                          <DropdownMenuItem onSelect={() => toggleCol(col.key)}><EyeOff className="mr-2 size-3.5" /> Ocultar coluna</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <span role="separator" aria-orientation="vertical" aria-label="Redimensionar"
                        onMouseDown={(e) => iniciarResize(col.key, e.currentTarget.parentElement!, e)}
                        className="group absolute right-0 top-0 z-10 flex h-full w-2 cursor-col-resize select-none items-center justify-center">
                        <span aria-hidden className="h-2/3 w-px bg-border transition-colors group-hover:w-0.5 group-hover:bg-primary" />
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr><td colSpan={colsVisiveis.length + 1} className="px-5 py-12 text-center text-sm text-muted-foreground">{vazio}</td></tr>
              ) : linhas.map((t) => {
                const sel = selecao.has(t.id);
                return (
                  <tr key={t.id} data-row tabIndex={0} onClick={() => onAbrir(t.id)} onKeyDown={(e) => onRowKey(e, t.id)}
                    onDragOver={ordenavel && arrastando ? (e) => e.preventDefault() : undefined}
                    onDrop={ordenavel && arrastando ? (e) => { e.preventDefault(); reordenar(linhas, arrastando, t.id); setArrastando(null); } : undefined}
                    className={cn('group cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-secondary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                      tarefaConcluida(statusEfetivo(t)) && 'opacity-60', sel && 'bg-primary/5', arrastando === t.id && 'opacity-40')}>
                    <td className={cn('px-3 align-middle', compacto ? 'py-1.5' : 'py-3')}>
                      <div className="flex items-center gap-1">
                        {ordenavel && (
                          <span
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); setArrastando(t.id); e.dataTransfer.effectAllowed = 'move'; }}
                            onDragEnd={() => setArrastando(null)}
                            onClick={(e) => e.stopPropagation()}
                            title="Arraste para reordenar"
                            className="cursor-grab text-muted-foreground/40 opacity-0 transition-opacity hover:text-muted-foreground group-hover:opacity-100 active:cursor-grabbing">
                            <GripVertical className="size-4" />
                          </span>
                        )}
                        <input type="checkbox" aria-label="Selecionar tarefa" checked={sel}
                          onChange={() => toggleSel(t.id)} onClick={(e) => e.stopPropagation()}
                          className={cn('size-3.5 cursor-pointer accent-primary transition-opacity', sel ? 'opacity-100' : 'opacity-30 group-hover:opacity-100')} />
                      </div>
                    </td>
                    {colsVisiveis.map((col) => (
                      <td key={col.key}
                        onClick={EDITAVEIS.has(col.key) ? (e) => { e.stopPropagation(); setEditCell({ id: t.id, campo: col.key }); } : undefined}
                        className={cn('overflow-hidden px-4 align-middle text-muted-foreground', compacto ? 'py-1.5' : 'py-3', EDITAVEIS.has(col.key) && 'hover:bg-secondary/70')}>
                        {celula(t, col.key)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {comNova && onNovaLinha && (
                <tr className="border-t border-border">
                  <td colSpan={colsVisiveis.length + 1} className="px-4 py-2.5">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onNovaLinha(); }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground/50 transition-colors hover:text-muted-foreground">
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
                  {colsVisiveis.map((col) => <td key={col.key} className="px-4 py-2 align-middle">{rodapeCelula(linhas, col.key)}</td>)}
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
    <div className="flex flex-col gap-3 pb-16">
      {/* Linha 1: visões + mês · ordenar/agrupar/colunas */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Visões salvas (S5) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Bookmark className="size-3.5" />
              {viewAtivaObj ? viewAtivaObj.nome : 'Visão'}{modificada && <span className="text-primary">•</span>}
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Visões salvas</DropdownMenuLabel>
            {views.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma ainda.</p>}
            {views.map((v) => (
              <div key={v.id} className={cn('flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-secondary', v.id === viewAtiva && 'bg-secondary/60')}>
                <button type="button" className="flex flex-1 items-center gap-2 text-left" onClick={() => aplicarView(v)}>
                  <Check className={cn('size-3.5', v.id === viewAtiva ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{v.nome}</span>
                </button>
                <button type="button" aria-label={`Excluir ${v.nome}`} onClick={() => excluirView(v.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            <DropdownMenuSeparator />
            {modificada && viewAtivaObj && (
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); atualizarViewAtiva(); }}>
                <Save className="mr-2 size-3.5" /> Atualizar “{viewAtivaObj.nome}”
              </DropdownMenuItem>
            )}
            <div className="flex items-center gap-1 p-1.5" onClick={(e) => e.stopPropagation()}>
              <input
                value={nomeNovaView} placeholder="Salvar visão como…"
                onChange={(e) => setNomeNovaView(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); salvarComoNova(); } }}
                className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs focus-visible:outline-none"
              />
              <Button size="sm" className="h-8" disabled={!nomeNovaView.trim()} onClick={salvarComoNova}>Salvar</Button>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => limparVisao()}>
              <X className="mr-2 size-3.5" /> Limpar filtros e ordenação
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <select value={fMes} onChange={(e) => trocarMes(e.target.value)} aria-label="Filtrar por mês"
          className={cn(filtroCls, fMes ? 'text-foreground' : 'text-muted-foreground')}>
          <option value="">Mês: todos</option>
          <option value="atual">Mês atual</option>
          {mesesDisponiveis.map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-2">
          {/* Ordenação multinível (S7) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowUpDown className="size-3.5" /> Ordenar{ordens.length > 0 && <span className="text-muted-foreground">({ordens.length})</span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
              {ordens.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">Padrão: prazo mais próximo.</p>}
              {ordens.map((o, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <span className="w-4 text-center text-[10px] text-muted-foreground">{i + 1}</span>
                  <select value={o.campo} onChange={(e) => updateOrdem(i, { campo: e.target.value as OrdemRegra['campo'] })}
                    className="h-8 flex-1 rounded border border-input bg-background px-1.5 text-xs focus-visible:outline-none">
                    {ORDEM_CAMPOS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                  </select>
                  <button type="button" aria-label="Direção" onClick={() => updateOrdem(i, { dir: o.dir === 'asc' ? 'desc' : 'asc' })}
                    className="grid size-8 place-items-center rounded border border-input hover:bg-secondary">
                    {o.dir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                  </button>
                  <button type="button" aria-label="Remover nível" onClick={() => removeOrdem(i)} className="grid size-8 place-items-center rounded text-muted-foreground hover:text-destructive">
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); addOrdem(); }}>
                <Plus className="mr-2 size-3.5" /> Adicionar nível
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Agrupar (S2) */}
          <div className="flex items-center gap-1 rounded-md border border-input bg-background/40 pl-2.5 pr-1">
            <Layers className="size-3.5 text-muted-foreground" />
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} aria-label="Agrupar por"
              className="h-9 bg-transparent pr-1 text-sm text-foreground focus-visible:outline-none">
              {GROUPS.map((g) => <option key={g.v} value={g.v}>{g.label}</option>)}
            </select>
          </div>

          <MenuColunas colDefs={colDefs} onToggle={toggleCol} onMover={moverCol} />
          <Button variant="outline" size="sm" aria-label={compacto ? 'Linhas confortáveis' : 'Linhas compactas'}
            title={compacto ? 'Linhas confortáveis' : 'Linhas compactas'} onClick={() => trocarDensidade(!compacto)}>
            {compacto ? <Rows4 className="size-4" /> : <Rows3 className="size-4" />}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportarCSV} title="Exportar CSV da visão atual">
            <Download className="size-3.5" /> CSV
          </Button>
        </div>
      </div>

      {/* Linha 2: filtros compostos (S6) */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground">
              <Filter className="size-3.5" /> Filtro
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Filtrar por</DropdownMenuLabel>
            {(Object.keys(CAMPOS_FILTRO) as FiltroCampo[]).map((campo) => (
              <DropdownMenuItem key={campo} onSelect={() => addFiltro(campo)}>{CAMPOS_FILTRO[campo].label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {filtros.map((r) => (
          <ChipFiltro key={r.id} regra={r} rotulo={rotuloFiltro(r)} clientes={clientesOpcoes} usuarios={usuarios}
            onChange={updateFiltro} onRemove={() => removeFiltro(r.id)} />
        ))}
        {filtros.length > 1 && (
          <button type="button" onClick={() => aplicarEstado({ filtros: [] })} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
            limpar filtros
          </button>
        )}
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
                <button type="button"
                  onClick={() => setGruposFechados((s) => { const n = new Set(s); if (n.has(g.chave)) n.delete(g.chave); else n.add(g.chave); return n; })}
                  className="mb-2 flex w-full items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-secondary/50">
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
        <>
          {mesSel && <p className="-mb-1 text-xs text-muted-foreground">Mostrando <span className="font-medium text-foreground">{rotuloMes(mesSel)}</span></p>}

          {tabela(abertas, mesSel ? `Nenhuma tarefa em ${rotuloMes(mesSel)}.` : 'Nenhuma tarefa neste filtro.', true, true, reordenavel)}

          <p className="pt-1 flex items-center justify-end gap-2 text-xs text-muted-foreground">
            {reordenavel && <span className="text-muted-foreground/60">Arraste pelo ⠿ para reordenar · ↑/↓ navega · Enter abre</span>}
            <span>{abertas.length} {abertas.length === 1 ? 'tarefa em aberto' : 'tarefas em aberto'}</span>
          </p>

          {atrasadas.length > 0 && (
            <div>
              <button type="button" onClick={() => setAtrasadasAbertas((v) => !v)}
                className="flex w-full items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm transition-colors hover:bg-destructive/15">
                <span className="font-medium text-destructive">⚠ Atrasadas de meses anteriores <span className="opacity-70">({atrasadas.length})</span></span>
                <ChevronDown className={cn('size-4 text-destructive transition-transform', atrasadasAbertas && 'rotate-180')} />
              </button>
              {atrasadasAbertas && <div className="mt-2">{tabela(atrasadas, 'Nenhuma atrasada.', false)}</div>}
            </div>
          )}

          {concluidas.length > 0 && (
            <div>
              <button type="button" onClick={() => setConcluidasAbertas((v) => !v)}
                className="flex w-full items-center justify-between rounded-md border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:bg-secondary/50">
                <span className="font-medium text-muted-foreground">Tarefas concluídas <span className="text-muted-foreground/70">({concluidas.length})</span></span>
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
              <span className="px-1.5 text-sm">Apagar <span className="font-medium">{selecao.size}</span> {selecao.size === 1 ? 'tarefa' : 'tarefas'}? Não dá pra desfazer.</span>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setConfirmandoApagar(false)}>Cancelar</Button>
              <Button size="sm" className="gap-1 bg-destructive text-xs text-destructive-foreground hover:bg-destructive/90" onClick={apagarEmMassa}>
                <Trash2 className="size-3.5" /> Apagar
              </Button>
            </>
          ) : (
            <>
              <span className="px-1.5 text-sm font-medium">{selecao.size} selecionada{selecao.size > 1 ? 's' : ''}</span>
              <span className="h-5 w-px bg-border" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="gap-1 text-xs">Status <ChevronDown className="size-3" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="max-h-72 w-56 overflow-y-auto">
                  {getGrupos().map((g) => {
                    const ops = opcoesDoGrupo(g.id);
                    if (!ops.length) return null;
                    return (
                      <div key={g.id}>
                        <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">{g.nome}</DropdownMenuLabel>
                        {ops.map((o) => <DropdownMenuItem key={o.id} onSelect={() => aplicarEmMassa(espelhoStatus(o.id))}>{o.nome}</DropdownMenuItem>)}
                      </div>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="gap-1 text-xs">Prioridade <ChevronDown className="size-3" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  {(['alta', 'media', 'baixa'] as const).map((p) => <DropdownMenuItem key={p} onSelect={() => aplicarEmMassa({ prioridade: p })}>{rotuloPrioridade(p)}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
              <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                Prazo
                <input type="date" aria-label="Definir prazo em massa"
                  onChange={(e) => { const v = e.target.value; if (v && dataValida(v)) aplicarEmMassa({ prazo: v }); }}
                  className="h-7 rounded border border-input bg-background px-1.5 text-xs focus-visible:outline-none" />
              </label>
              <span className="h-5 w-px bg-border" />
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmandoApagar(true)}>
                <Trash2 className="size-3.5" /> Apagar
              </Button>
              <Button variant="ghost" size="icon" className="size-7" aria-label="Limpar seleção" onClick={limparSelecao}><X className="size-4" /></Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* Guarda de data (corrige F-013): só grava vazio (limpar) ou ISO com ano de 4 dígitos. */
function dataValida(v: string): boolean {
  if (v === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  return Number(v.slice(0, 4)) >= 1000;
}
