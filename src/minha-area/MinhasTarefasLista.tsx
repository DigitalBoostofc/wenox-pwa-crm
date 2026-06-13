import { useMemo, useRef, useState } from 'react';
import { SlidersHorizontal, GripVertical, UserRound, ChevronDown } from 'lucide-react';
import { useDadosAgencia } from '@/dashboard/useDadosAgencia';
import { useAuth } from '@/auth/useAuth';
import type { Tarefa } from '@/tarefas/types';
import { TarefaViewSheet } from '@/tarefas/TarefaViewSheet';
import { statusTarefaClass, prazoVencido, prazoBR, tarefaConcluida, prazoLimite } from '@/tarefas/format';
import { temEtapas, progressoEtapas } from '@/tarefas/etapas';
import { STATUS_TAREFA } from '@/tarefas/status';
import { AvatarMembro } from '@/dashboard/AvatarMembro';
import { dataBR } from '@/clientes/format';
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

type ColKey = 'tarefa' | 'projeto' | 'cliente' | 'status' | 'prazo' | 'prioridade' | 'responsaveis' | 'etapa' | 'criada';
interface ColDef { key: ColKey; label: string; visivel: boolean }

const COLS_PADRAO: ColDef[] = [
  { key: 'tarefa', label: 'Tarefa', visivel: true },
  { key: 'projeto', label: 'Projeto', visivel: true },
  { key: 'cliente', label: 'Cliente', visivel: false },
  { key: 'status', label: 'Status', visivel: true },
  { key: 'prazo', label: 'Prazo', visivel: true },
  { key: 'prioridade', label: 'Prioridade', visivel: true },
  { key: 'responsaveis', label: 'Responsáveis', visivel: true },
  { key: 'etapa', label: 'Etapas', visivel: false },
  { key: 'criada', label: 'Criada em', visivel: false },
];
const COL_KEY = 'wenox-minha-lista-colunas-v1';
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

type Ordem = 'prazo' | 'prioridade' | 'status' | 'nome';
const ORDEM_KEY = 'wenox-minha-lista-ordem-v1';
const ORDENS: { v: Ordem; label: string }[] = [
  { v: 'prazo', label: 'Prazo (mais próximo)' },
  { v: 'prioridade', label: 'Prioridade (alta → baixa)' },
  { v: 'status', label: 'Status' },
  { v: 'nome', label: 'Nome (A→Z)' },
];
function carregarOrdem(): Ordem {
  try { const s = localStorage.getItem(ORDEM_KEY); if (s === 'prazo' || s === 'prioridade' || s === 'status' || s === 'nome') return s; } catch { /* */ }
  return 'prazo';
}

/* --------------------------------- Helpers -------------------------------- */

function pesoPrioridade(p?: string) { return p === 'alta' ? 0 : p === 'baixa' ? 2 : 1; }
function posStatus(s?: string) { const i = (STATUS_TAREFA as readonly string[]).indexOf(s ?? ''); return i >= 0 ? i : 99; }
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
  const [ordem, setOrdem] = useState<Ordem>(carregarOrdem);
  const [fStatus, setFStatus] = useState('');       // '' = todos
  const [fPrioridade, setFPrioridade] = useState(''); // '' = todas
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
    return [...arr].sort((a, b) => {
      if (ordem === 'nome') return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' });
      if (ordem === 'prioridade') {
        const d = pesoPrioridade(a.prioridade) - pesoPrioridade(b.prioridade);
        if (d !== 0) return d;
      }
      if (ordem === 'status') {
        const d = posStatus(a.status) - posStatus(b.status);
        if (d !== 0) return d;
      }
      const pa = prazoLimite(a.prazo)?.getTime() ?? Infinity;
      const pb = prazoLimite(b.prazo)?.getTime() ?? Infinity;
      return pa - pb;
    });
  }, [minhas, fStatus, fPrioridade, ordem]);

  const colsVisiveis = useMemo(() => colDefs.filter((c) => c.visivel), [colDefs]);

  function iniciarResize(key: ColKey, thEl: HTMLElement, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const base = thEl.getBoundingClientRect().width;
    const startX = e.clientX; const MIN = 80;
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
    function onMove(ev: MouseEvent) {
      setLarguras((prev) => { const n = { ...prev, [key]: Math.max(MIN, Math.round(base + (ev.clientX - startX))) }; salvarLarguras(n); return n; });
    }
    function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  }

  function celula(t: Tarefa, key: ColKey) {
    if (key === 'tarefa') return <span className="font-medium">{t.nome}</span>;
    if (key === 'projeto') return <span className="text-muted-foreground">{t.expand?.projeto?.nome ?? '—'}</span>;
    if (key === 'cliente') return <span className="text-muted-foreground">{nomeCliente(t)}</span>;
    if (key === 'status') return t.status
      ? <Badge className={cn('border text-[10px]', statusTarefaClass(t.status))}>{t.status}</Badge>
      : <span className="text-muted-foreground">—</span>;
    if (key === 'prazo') {
      if (!t.prazo) return <span className="text-muted-foreground">—</span>;
      const venc = prazoVencido(t.prazo, t.status);
      return <span className={cn('text-xs', venc ? 'font-medium text-destructive' : 'text-muted-foreground')}>{prazoBR(t.prazo)}</span>;
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
    if (key === 'etapa') {
      if (!temEtapas(t)) return <span className="text-muted-foreground">—</span>;
      const { feitas, total } = progressoEtapas(t.etapas ?? []);
      return <span className="text-xs text-muted-foreground">{feitas}/{total}</span>;
    }
    if (key === 'criada') return <span className="text-muted-foreground">{dataBR(t.created) || '—'}</span>;
    return null;
  }

  const abertas = filtradas.filter((t) => !tarefaConcluida(t.status));
  const concluidas = filtradas.filter((t) => tarefaConcluida(t.status));

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
                      className="group absolute -right-1 top-0 z-10 flex h-full w-2 cursor-col-resize select-none items-center justify-center">
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
