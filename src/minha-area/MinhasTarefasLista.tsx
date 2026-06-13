import { useMemo, useRef, useState } from 'react';
import { SlidersHorizontal, GripVertical, UserRound, ChevronDown } from 'lucide-react';
import { useDadosAgencia } from '@/dashboard/useDadosAgencia';
import { useAuth } from '@/auth/useAuth';
import type { Tarefa } from '@/tarefas/types';
import { TarefaViewSheet } from '@/tarefas/TarefaViewSheet';
import { statusTarefaClass, prazoBR, tarefaConcluida, prazoLimite } from '@/tarefas/format';
import { temEtapas, etapaAtual, ehVezDoUsuario, aguardandoAprovacaoCliente } from '@/tarefas/etapas';
import { STATUS_TAREFA } from '@/tarefas/status';
import { AvatarMembro } from '@/dashboard/AvatarMembro';
import { logoUrl } from '@/clientes/clientesService';
import { corAvatar, inicial } from '@/clientes/format';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const filtroCls =
  'h-9 rounded-md border border-input bg-background/40 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

/* --------------------------------- Colunas -------------------------------- */

type ColKey = 'cliente' | 'projeto' | 'tarefa' | 'status' | 'prazo' | 'prioridade' | 'responsaveis';
interface ColDef { key: ColKey; label: string; visivel: boolean }

const COLS_PADRAO: ColDef[] = [
  { key: 'cliente', label: 'Cliente', visivel: true },
  { key: 'projeto', label: 'Projeto', visivel: true },
  { key: 'tarefa', label: 'Tarefa', visivel: true },
  { key: 'status', label: 'Status', visivel: true },
  { key: 'prazo', label: 'Prazo', visivel: true },
  { key: 'prioridade', label: 'Prioridade', visivel: true },
  { key: 'responsaveis', label: 'Responsáveis', visivel: true },
];
const COL_KEY = 'wenox-minha-lista-colunas-v2';
function carregarColunas(): ColDef[] {
  try {
    const s = localStorage.getItem(COL_KEY);
    if (!s) return COLS_PADRAO;
    const salvo = JSON.parse(s) as ColDef[];
    const conhecidas = new Map(COLS_PADRAO.map((c) => [c.key, c]));
    const ord: ColDef[] = salvo
      .filter((c) => conhecidas.has(c.key))
      .map((c) => ({ ...conhecidas.get(c.key)!, visivel: !!c.visivel }));
    for (const c of COLS_PADRAO) if (!ord.some((o) => o.key === c.key)) ord.push(c);
    return ord;
  } catch { return COLS_PADRAO; }
}
function salvarColunas(cols: ColDef[]) {
  try { localStorage.setItem(COL_KEY, JSON.stringify(cols)); } catch { /* */ }
}

type Larguras = Partial<Record<ColKey, number>>;
const LARGURA_KEY = 'wenox-minha-lista-larguras-v1';
function carregarLarguras(): Larguras {
  try { const s = localStorage.getItem(LARGURA_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
}
function salvarLarguras(l: Larguras) {
  try { localStorage.setItem(LARGURA_KEY, JSON.stringify(l)); } catch { /* */ }
}

/** Arrasto genérico de redimensionamento de coluna. */
function dragResize(thEl: HTMLElement, e: React.MouseEvent, aplicar: (largura: number) => void) {
  e.preventDefault(); e.stopPropagation();
  const base = thEl.getBoundingClientRect().width;
  const startX = e.clientX; const MIN = 80;
  document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
  function onMove(ev: MouseEvent) { aplicar(Math.max(MIN, Math.round(base + (ev.clientX - startX)))); }
  function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; }
  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
}

/** Colunas (fixas) da tabela de Etapas Pendentes. */
const COLS_ETAPAS: { key: string; label: string; w?: number }[] = [
  { key: 'cliente', label: 'Cliente', w: 72 },
  { key: 'projeto', label: 'Projeto' },
  { key: 'tarefa', label: 'Tarefa / Etapa' },
  { key: 'status', label: 'Status', w: 170 },
  { key: 'prazo', label: 'Prazo', w: 130 },
  { key: 'resp', label: 'Responsável', w: 110 },
];
const LARGURA_ETAPAS_KEY = 'wenox-minha-etapas-larguras-v1';
function carregarLargurasEtapas(): Record<string, number> {
  try { const s = localStorage.getItem(LARGURA_ETAPAS_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
}
function salvarLargurasEtapas(l: Record<string, number>) {
  try { localStorage.setItem(LARGURA_ETAPAS_KEY, JSON.stringify(l)); } catch { /* */ }
}

type Ordem = 'prazo' | 'prioridade' | 'nome';
const ORDEM_KEY = 'wenox-minha-lista-ordem-v1';
const ORDENS: { v: Ordem; label: string }[] = [
  { v: 'prazo', label: 'Prazo (mais próximo)' },
  { v: 'prioridade', label: 'Prioridade (alta → baixa)' },
  { v: 'nome', label: 'Nome (A→Z)' },
];
function carregarOrdem(): Ordem {
  try { const s = localStorage.getItem(ORDEM_KEY); if (s === 'prazo' || s === 'prioridade' || s === 'nome') return s; } catch { /* */ }
  return 'prazo';
}

/* --------------------------------- Helpers -------------------------------- */

function pesoPrioridade(p?: string) { return p === 'alta' ? 0 : p === 'baixa' ? 2 : 1; }

/** Categoria do prazo da tarefa: vencida / hoje / amanhã / futuro / '' (sem prazo). */
type CatPrazo = '' | 'vencida' | 'hoje' | 'amanha' | 'futuro';
function catPrazoData(prazo?: string, feito?: boolean): CatPrazo {
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
function corPrazo(cat: CatPrazo): string {
  if (cat === 'vencida') return 'font-medium text-destructive';
  if (cat === 'hoje') return 'font-medium text-yellow-500';
  if (cat === 'amanha') return 'font-medium text-orange-500';
  return 'text-muted-foreground';
}

function nomeCliente(t: Tarefa) {
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

/* ------------------------------- Componente ------------------------------- */

export function MinhasTarefasLista({ somenteLeitura }: { somenteLeitura?: boolean }) {
  const { tarefas, carregando, refresh } = useDadosAgencia();
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const [viewId, setViewId] = useState<string | null>(null);

  const [colDefs, setColDefs] = useState<ColDef[]>(carregarColunas);
  const [larguras, setLarguras] = useState<Larguras>(carregarLarguras);
  const [largurasEtapas, setLargurasEtapas] = useState<Record<string, number>>(carregarLargurasEtapas);
  const [ordem, setOrdem] = useState<Ordem>(carregarOrdem);
  const [fStatus, setFStatus] = useState('');       // '' = todos
  const [fPrioridade, setFPrioridade] = useState(''); // '' = todas
  const [fPrazo, setFPrazo] = useState('');           // '' = todos
  const [concluidasAbertas, setConcluidasAbertas] = useState(false);

  function toggleCol(k: ColKey) {
    setColDefs((cs) => { const n = cs.map((c) => c.key === k ? { ...c, visivel: !c.visivel } : c); salvarColunas(n); return n; });
  }
  function moverCol(de: number, para: number) {
    setColDefs((cs) => {
      if (de === para || para < 0 || para >= cs.length) return cs;
      const n = [...cs]; const [it] = n.splice(de, 1); n.splice(para, 0, it); salvarColunas(n); return n;
    });
  }
  function trocarOrdem(o: Ordem) { setOrdem(o); try { localStorage.setItem(ORDEM_KEY, o); } catch { /* */ } }

  const minhas = useMemo(
    () => tarefas.filter((t) => (t.responsaveis ?? []).includes(uid)),
    [tarefas, uid],
  );

  const filtradas = useMemo(() => {
    let arr = minhas;
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
  }, [minhas, fStatus, fPrioridade, fPrazo, ordem]);

  const colsVisiveis = useMemo(() => colDefs.filter((c) => c.visivel), [colDefs]);

  function iniciarResize(key: ColKey, thEl: HTMLElement, e: React.MouseEvent) {
    dragResize(thEl, e, (w) => setLarguras((prev) => { const n = { ...prev, [key]: w }; salvarLarguras(n); return n; }));
  }
  function iniciarResizeEtapas(key: string, thEl: HTMLElement, e: React.MouseEvent) {
    dragResize(thEl, e, (w) => setLargurasEtapas((prev) => { const n = { ...prev, [key]: w }; salvarLargurasEtapas(n); return n; }));
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
        ? <img src={logo} alt={nome} title={nome} loading="lazy" className="size-7 rounded-md object-cover" />
        : <div title={nome} className={cn('grid size-7 place-items-center rounded-md text-[10px] font-bold text-white', corAvatar(nome))}>{inicial(nome)}</div>;
    }
    if (key === 'status') return t.status
      ? <Badge className={cn('border text-[10px]', statusTarefaClass(t.status))}>{t.status}</Badge>
      : <span className="text-muted-foreground">—</span>;
    if (key === 'prazo') {
      if (!t.prazo) return <span className="text-muted-foreground">—</span>;
      return <span className={cn('text-xs', corPrazo(catPrazo(t)))}>{prazoBR(t.prazo)}</span>;
    }
    if (key === 'prioridade') return <PrioridadeBadge p={t.prioridade} />;
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
    return null;
  }

  const abertas = filtradas.filter((t) => !tarefaConcluida(t.status));
  const concluidas = filtradas.filter((t) => tarefaConcluida(t.status));

  // Etapas pendentes: a etapa atual de cada tarefa em andamento (com etapas) do usuário.
  const etapasPendentes = minhas
    .filter((t) => temEtapas(t) && !tarefaConcluida(t.status))
    .map((t) => ({ t, etapa: etapaAtual(t.etapas ?? []) }))
    .filter((r): r is { t: Tarefa; etapa: NonNullable<typeof r.etapa> } => !!r.etapa)
    .sort((a, b) => (prazoLimite(a.etapa.prazo)?.getTime() ?? Infinity) - (prazoLimite(b.etapa.prazo)?.getTime() ?? Infinity));

  function badgeEtapa(t: Tarefa) {
    if (ehVezDoUsuario(t, uid)) return <Badge className="border border-orange-500/50 bg-orange-500/15 text-[10px] text-orange-500">Concluir Etapa</Badge>;
    if (aguardandoAprovacaoCliente(t)) return <Badge className="border border-yellow-500/50 bg-yellow-500/15 text-[10px] text-yellow-500">Aguardando Cliente</Badge>;
    return <Badge className="border border-amber-700/50 bg-amber-700/15 text-[10px] text-amber-600">Aguardando Equipe</Badge>;
  }
  function clienteCell(t: Tarefa) {
    const c = t.expand?.cliente;
    if (!c) return <span className="text-muted-foreground">—</span>;
    const nome = nomeCliente(t);
    const logo = c.logo ? logoUrl(c as never, '100x100') : '';
    return logo
      ? <img src={logo} alt={nome} title={nome} loading="lazy" className="size-7 rounded-md object-cover" />
      : <div title={nome} className={cn('grid size-7 place-items-center rounded-md text-[10px] font-bold text-white', corAvatar(nome))}>{inicial(nome)}</div>;
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
                <tr key={t.id} onClick={() => setViewId(t.id)}
                  className={cn('cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-secondary/50', tarefaConcluida(t.status) && 'opacity-60')}>
                  {colsVisiveis.map((col) => (
                    <td key={col.key} className="overflow-hidden px-4 py-3 text-muted-foreground">{celula(t, col.key)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  if (carregando) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="flex flex-col gap-4">
      {/* Controles: filtros (dropdown) + ordenar + colunas */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Filtrar por status"
          className={cn(filtroCls, fStatus ? 'text-foreground' : 'text-muted-foreground')}>
          <option value="">Status</option>
          {STATUS_TAREFA.map((s) => <option key={s} value={s}>{s}</option>)}
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
        <div className="ml-auto flex items-center gap-2">
          <select value={ordem} onChange={(e) => trocarOrdem(e.target.value as Ordem)} aria-label="Ordenar"
            className={cn(filtroCls, 'text-foreground')}>
            {ORDENS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
          <MenuColunas colDefs={colDefs} onToggle={toggleCol} onMover={moverCol} />
        </div>
      </div>

      {tabela(abertas, 'Nenhuma tarefa neste filtro.')}

      {!carregando && (
        <p className="pt-1 text-right text-xs text-muted-foreground">
          {abertas.length} {abertas.length === 1 ? 'tarefa em aberto' : 'tarefas em aberto'}
        </p>
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

      {/* Etapas Pendentes */}
      {etapasPendentes.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Etapas Pendentes</h3>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    {COLS_ETAPAS.map((c) => (
                      <th key={c.key} className="relative px-4 py-3 font-medium"
                        style={largurasEtapas[c.key] ? { width: largurasEtapas[c.key] } : (c.w ? { width: c.w } : undefined)}>
                        {c.label}
                        <span role="separator" aria-orientation="vertical" aria-label="Redimensionar"
                          onMouseDown={(e) => iniciarResizeEtapas(c.key, e.currentTarget.parentElement!, e)}
                          className="group absolute right-0 top-0 z-10 flex h-full w-2 cursor-col-resize select-none items-center justify-center">
                          <span aria-hidden className="h-2/3 w-px bg-border transition-colors group-hover:w-0.5 group-hover:bg-primary" />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {etapasPendentes.map(({ t, etapa }) => {
                    const resp = etapa.tipo === 'aprovacao_cliente'
                      ? null
                      : (t.expand?.responsaveis ?? []).find((r) => r.id === etapa.responsavel);
                    const cat = catPrazoData(etapa.prazo, false);
                    return (
                      <tr key={t.id} onClick={() => setViewId(t.id)}
                        className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-secondary/50">
                        <td className="overflow-hidden px-4 py-3">{clienteCell(t)}</td>
                        <td className="overflow-hidden px-4 py-3 text-muted-foreground">{t.expand?.projeto?.nome ?? '—'}</td>
                        <td className="overflow-hidden px-4 py-3">
                          <span className="font-medium">{t.nome}</span>
                          <span className="block truncate text-xs text-muted-foreground">{etapa.texto}</span>
                        </td>
                        <td className="overflow-hidden px-4 py-3">{badgeEtapa(t)}</td>
                        <td className="overflow-hidden px-4 py-3">
                          {etapa.prazo
                            ? <span className={cn('text-xs', corPrazo(cat))}>{prazoBR(etapa.prazo)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="overflow-hidden px-4 py-3">
                          {etapa.tipo === 'aprovacao_cliente'
                            ? <span className="text-xs text-amber-500">Cliente</span>
                            : resp
                              ? <AvatarMembro membro={resp} className="size-7 text-[10px]" />
                              : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <TarefaViewSheet
        tarefaId={viewId}
        aberto={viewId !== null}
        onClose={() => setViewId(null)}
        onMudou={() => refresh()}
        somenteLeitura={somenteLeitura}
      />
    </div>
  );
}
