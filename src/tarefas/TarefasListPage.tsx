import { useEffect, useMemo, useState, useRef } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { Plus, Search, ListChecks, List, Columns3, X } from 'lucide-react';
import { listTarefas, moverTarefaStatus, concluirTarefa, reabrirTarefa } from './tarefasService';
import type { Tarefa } from './types';
import { TarefaCard } from './TarefaCard';
import { statusTarefaClass, tarefaConcluida } from './format';
import { MinhaSemanaList } from './MinhaSemanaList';
import type { TipoAgrupamento } from './MinhaSemanaList';
import { QuickAddTarefa } from './QuickAddTarefa';
import { STATUS_TAREFA, STATUS_CONCLUIDO, STATUS_INICIAL } from './status';
import { useAuth } from '@/auth/useAuth';
import { ehCliente, canGerirEquipe } from '@/auth/perms';
import { listOpcoes } from '@/opcoes/opcoesService';
import { BarraTipos, PillsTipos } from '@/components/BarraTipos';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HeaderSlot } from '@/components/layout/HeaderSlot';
import { cn } from '@/lib/utils';
import { TarefaSheet } from './TarefaSheet';
import { PortalClienteTarefas } from './PortalClienteTarefas';

/* -------------------------------------------------------------------------- */
/*  Persistência de preferências                                               */
/* -------------------------------------------------------------------------- */

type ViewMode = 'lista' | 'kanban';
const VIEW_KEY = 'wenox-tarefas-view-v1';
function carregarView(): ViewMode {
  try {
    const s = localStorage.getItem(VIEW_KEY);
    if (s === 'lista' || s === 'kanban') return s;
  } catch { /* */ }
  return 'lista';
}

const AGRUPAR_KEY = 'wenox-tarefas-agrupar-v1';
const AGRUPAMENTOS_VALIDOS: TipoAgrupamento[] = ['prazo', 'responsavel', 'projeto', 'cliente', 'status'];
function carregarAgrupar(): TipoAgrupamento {
  try {
    const s = localStorage.getItem(AGRUPAR_KEY);
    if (s && AGRUPAMENTOS_VALIDOS.includes(s as TipoAgrupamento)) return s as TipoAgrupamento;
  } catch { /* */ }
  return 'prazo';
}

/** Último tipo de projeto selecionado na barra (Owner/Admin/Gestor). */
const TIPO_KEY = 'wenox-tarefas-tipo-v1';
function carregarTipo(): string {
  try { return localStorage.getItem(TIPO_KEY) ?? ''; } catch { return ''; }
}

/* -------------------------------------------------------------------------- */
/*  Configuração das opções de escopo e agrupamento                           */
/* -------------------------------------------------------------------------- */

type Escopo = 'minhas' | 'todas' | 'internas';
const ESCOPOS: { v: Escopo; label: string }[] = [
  { v: 'minhas', label: 'Minhas' },
  { v: 'todas', label: 'Todas' },
  { v: 'internas', label: 'Internas (sem projeto)' },
];

const AGRUPAMENTOS: { v: TipoAgrupamento; label: string }[] = [
  { v: 'prazo', label: 'Prazo' },
  { v: 'responsavel', label: 'Responsável' },
  { v: 'projeto', label: 'Projeto' },
  { v: 'cliente', label: 'Cliente' },
  { v: 'status', label: 'Status' },
];

/* -------------------------------------------------------------------------- */
/*  Componentes auxiliares                                                     */
/* -------------------------------------------------------------------------- */

function ViewToggleBtn({ ativo, onClick, icon: Icon, label }: {
  ativo: boolean; onClick: () => void; icon: typeof List; label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={ativo}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
        ativo ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary',
      )}
    >
      <Icon className="size-4" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Página principal                                                           */
/* -------------------------------------------------------------------------- */

export function TarefasListPage() {
  const { user } = useAuth();
  const history = useHistory();
  const location = useLocation();
  const [busca, setBusca] = useState('');
  const [escopo, setEscopo] = useState<Escopo>('minhas');
  const [view, setView] = useState<ViewMode>(carregarView);
  const [agrupar, setAgrupar] = useState<TipoAgrupamento>(carregarAgrupar);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [recarrega, setRecarrega] = useState(0);
  const seqRef = useRef(0);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  // Filtro por responsável vindo do Dashboard (Pulso da Equipe) via querystring.
  const [respFiltro, setRespFiltro] = useState<{ id: string; nome: string } | null>(null);
  const [soAbertas, setSoAbertas] = useState(false);
  // Barra de tipos (= tipo de projeto). Filtra a lista e prepara o dropdown ao criar.
  const [tipos, setTipos] = useState<string[]>([]);
  const [tipoAtivo, setTipoAtivo] = useState<string>(carregarTipo);

  const isCliente = ehCliente(user?.role);
  const gerencia = canGerirEquipe(user?.role);

  // Carrega os tipos visíveis: gestão vê todos; membro vê só a função dele (user.area).
  useEffect(() => {
    if (isCliente) return;
    listOpcoes('tipo_projeto').then((ts) => {
      const todos = ts.map((t) => t.valor);
      const visiveis = gerencia ? todos : todos.filter((t) => t === user?.area);
      setTipos(visiveis);
      setTipoAtivo((cur) => (cur && visiveis.includes(cur) ? cur : (visiveis[0] ?? '')));
    });
  }, [isCliente, gerencia, user?.area]);

  function trocarTipo(t: string) {
    setTipoAtivo(t);
    try { localStorage.setItem(TIPO_KEY, t); } catch { /* */ }
  }

  // Sincroniza o filtro de responsável a partir da URL (?responsavel=&nome=&abertas=1).
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const r = p.get('responsavel');
    setRespFiltro(r ? { id: r, nome: p.get('nome') ?? '' } : null);
    setSoAbertas(p.get('abertas') === '1');
  }, [location.search]);

  function limparFiltroResp() {
    setRespFiltro(null);
    setSoAbertas(false);
    history.replace('/tarefas');
  }

  function trocarEscopo(v: Escopo) {
    setEscopo(v);
    if (respFiltro) limparFiltroResp();
  }

  useEffect(() => {
    if (isCliente) return; // PortalClienteTarefas cuida do fetch do cliente
    const seq = ++seqRef.current;
    const q = busca.trim();
    setCarregando(true);
    const timer = setTimeout(() => {
      listTarefas({
        busca: q || undefined,
        responsavelId: respFiltro ? respFiltro.id : (escopo === 'minhas' ? user?.id : undefined),
        somenteAvulsas: escopo === 'internas' ? true : undefined,
      })
        .then((res) => {
          if (seq !== seqRef.current) return;
          setTarefas(res);
          setErro('');
        })
        .catch(() => {
          if (seq !== seqRef.current) return;
          setErro('Não foi possível carregar as tarefas.');
        })
        .finally(() => { if (seq === seqRef.current) setCarregando(false); });
    }, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [busca, escopo, user?.id, recarrega, isCliente, respFiltro]);

  // Filtros client-side: "só abertas" (vindo do Pulso) + tipo de projeto (barra).
  // Tarefas avulsas (sem projeto) não pertencem a um tipo → sempre aparecem.
  const tarefasExibidas = useMemo(() => {
    let arr = tarefas;
    if (soAbertas) arr = arr.filter((t) => !tarefaConcluida(t.status));
    if (tipoAtivo) arr = arr.filter((t) => !t.projeto || t.expand?.projeto?.tipo === tipoAtivo);
    return arr;
  }, [tarefas, soAbertas, tipoAtivo]);

  const trocarView = (v: ViewMode) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* */ }
  };

  const trocarAgrupar = (v: TipoAgrupamento) => {
    setAgrupar(v);
    try { localStorage.setItem(AGRUPAR_KEY, v); } catch { /* */ }
  };

  const abrir = (id: string) => setSheetId(id);

  async function mover(tarefaId: string, status: string) {
    const alvo = tarefas.find((t) => t.id === tarefaId);
    if (!alvo || alvo.status === status) return;
    setTarefas((lst) => lst.map((t) => (t.id === tarefaId ? { ...t, status } : t)));
    try {
      await moverTarefaStatus(tarefaId, status);
    } catch {
      setErro('Não foi possível mover a tarefa. Tente novamente.');
      setRecarrega((n) => n + 1);
    }
  }

  async function handleConcluir(id: string) {
    setTarefas((lst) => lst.map((t) => (t.id === id ? { ...t, status: STATUS_CONCLUIDO } : t)));
    try {
      await concluirTarefa(id, STATUS_CONCLUIDO);
      setRecarrega((n) => n + 1);
    } catch {
      setErro('Não foi possível concluir a tarefa.');
      setRecarrega((n) => n + 1);
    }
  }

  async function handleReabrir(id: string) {
    setTarefas((lst) => lst.map((t) => (t.id === id ? { ...t, status: STATUS_INICIAL } : t)));
    try {
      await reabrirTarefa(id, STATUS_INICIAL);
      setRecarrega((n) => n + 1);
    } catch {
      setErro('Não foi possível reabrir a tarefa.');
      setRecarrega((n) => n + 1);
    }
  }

  /* ---- Portal do cliente: UI simplificada ---- */
  if (isCliente) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <PortalClienteTarefas
          key={recarrega}
          clienteId={user?.cliente ?? ''}
          onAbrir={abrir}
        />
        <TarefaSheet
          tarefaId={sheetId}
          aberto={sheetId !== null}
          onClose={() => setSheetId(null)}
          onMudou={() => setRecarrega((n) => n + 1)}
        />
      </div>
    );
  }

  /* ---- Interface interna (equipe Wenox) ---- */
  return (
    <div className="flex gap-4">
      <BarraTipos tipos={tipos} ativo={tipoAtivo} onChange={trocarTipo} />
      <div className="flex min-w-0 flex-1 flex-col gap-5">
      <HeaderSlot>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Buscar tarefa ou projeto"
              aria-label="Buscar"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            />
          </div>
          <div className="hidden items-center gap-1 rounded-md border border-border bg-background/40 p-1 lg:flex">
            <ViewToggleBtn ativo={view === 'lista'} onClick={() => trocarView('lista')} icon={List} label="Lista" />
            <ViewToggleBtn ativo={view === 'kanban'} onClick={() => trocarView('kanban')} icon={Columns3} label="Kanban" />
          </div>
          <Button size="sm" onClick={() => setCriando(true)}>
            <Plus /> Nova tarefa
          </Button>
        </div>
      </HeaderSlot>

      {/* Pills de tipo — mobile apenas (espelha a BarraTipos do desktop) */}
      <PillsTipos tipos={tipos} ativo={tipoAtivo} onChange={trocarTipo} />

      {/* Pills de escopo + seletor de agrupamento (só na lista) */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:overflow-visible">
          {ESCOPOS.map((e) => (
            <button
              key={e.v}
              onClick={() => trocarEscopo(e.v)}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1 text-sm transition-colors',
                !respFiltro && escopo === e.v
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground hover:bg-secondary',
              )}
            >
              {e.label}
            </button>
          ))}
        </div>

        {respFiltro && (
          <button
            type="button"
            onClick={limparFiltroResp}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/50 bg-primary/15 px-3 py-1 text-sm text-primary transition-colors hover:bg-primary/25"
            title="Limpar filtro"
          >
            Responsável: {respFiltro.nome || '—'}{soAbertas ? ' · só abertas' : ''}
            <X className="size-3.5" />
          </button>
        )}

        {view === 'lista' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden lg:overflow-visible">
            <span className="shrink-0 text-xs text-muted-foreground">Agrupar:</span>
            {AGRUPAMENTOS.map((ag) => (
              <button
                key={ag.v}
                onClick={() => trocarAgrupar(ag.v)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-0.5 text-xs transition-colors',
                  agrupar === ag.v
                    ? 'border-primary/50 bg-primary/15 text-primary'
                    : 'border-border text-muted-foreground hover:bg-secondary',
                )}
              >
                {ag.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {erro}
        </p>
      )}

      {carregando && tarefas.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="mb-3 h-4 w-16" />
              <Skeleton className="mb-3 h-5 w-3/4" />
              <Skeleton className="h-8 w-full" />
            </Card>
          ))}
        </div>
      ) : view === 'kanban' ? (
        tarefasExibidas.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <ListChecks className="size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma tarefa neste filtro.</p>
            </div>
          </Card>
        ) : (
          <KanbanTarefas tarefas={tarefasExibidas} statuses={STATUS_TAREFA} onAbrir={abrir} onMover={mover} />
        )
      ) : (
        <div className="flex flex-col gap-3">
          <QuickAddTarefa
            onCriada={(id) => { setRecarrega((n) => n + 1); setSheetId(id); }}
          />
          <MinhaSemanaList
            tarefas={tarefasExibidas}
            onAbrir={abrir}
            onConcluir={handleConcluir}
            onReabrir={handleReabrir}
            agrupar={agrupar}
            statuses={[...STATUS_TAREFA]}
          />
        </div>
      )}

      {!carregando && tarefasExibidas.length > 0 && (
        <p className="pt-1 text-right text-xs text-muted-foreground">
          {tarefasExibidas.length} {tarefasExibidas.length === 1 ? 'tarefa' : 'tarefas'}
        </p>
      )}

      <TarefaSheet
        tarefaId={criando ? null : sheetId}
        aberto={criando || sheetId !== null}
        criar={criando}
        tipoProjeto={tipoAtivo || undefined}
        onClose={() => { setCriando(false); setSheetId(null); }}
        onMudou={() => setRecarrega((n) => n + 1)}
      />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Kanban                                                                     */
/* -------------------------------------------------------------------------- */

function KanbanTarefas({ tarefas, statuses, onAbrir, onMover }: {
  tarefas: Tarefa[];
  statuses: readonly string[];
  onAbrir: (id: string) => void;
  onMover: (id: string, status: string) => Promise<void>;
}) {
  const nomes = statuses;
  const buckets = new Map<string, Tarefa[]>();
  for (const n of nomes) buckets.set(n, []);
  const semStatus: Tarefa[] = [];
  for (const t of tarefas) {
    if (t.status && buckets.has(t.status)) buckets.get(t.status)!.push(t);
    else semStatus.push(t);
  }
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3">
        {nomes.map((n) => (
          <ColunaKanban
            key={n}
            titulo={n}
            statusAlvo={n}
            tarefas={buckets.get(n) ?? []}
            onAbrir={onAbrir}
            onSoltar={onMover}
          />
        ))}
        {semStatus.length > 0 && (
          <ColunaKanban titulo="Sem status" tarefas={semStatus} onAbrir={onAbrir} destaque />
        )}
      </div>
    </div>
  );
}

function ColunaKanban({ titulo, statusAlvo, tarefas, onAbrir, onSoltar, destaque }: {
  titulo: string;
  statusAlvo?: string;
  tarefas: Tarefa[];
  onAbrir: (id: string) => void;
  onSoltar?: (id: string, status: string) => Promise<void>;
  destaque?: boolean;
}) {
  const [recebendo, setRecebendo] = useState(false);
  const aceitaDrop = !!(onSoltar && statusAlvo);
  return (
    <div
      onDragOver={(e) => {
        if (!aceitaDrop) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!recebendo) setRecebendo(true);
      }}
      onDragLeave={() => setRecebendo(false)}
      onDrop={async (e) => {
        if (!aceitaDrop) return;
        e.preventDefault();
        setRecebendo(false);
        const id = e.dataTransfer.getData('text/tarefa-id');
        if (id && statusAlvo) await onSoltar!(id, statusAlvo);
      }}
      className={cn(
        'flex min-w-60 flex-1 flex-col gap-2 rounded-lg border border-border bg-background/40 p-3 transition-colors',
        destaque && 'border-dashed border-muted-foreground/30',
        recebendo && 'border-primary bg-primary/5',
      )}
    >
      <div className="flex items-center justify-between px-1">
        <span className={cn(
          'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
          statusAlvo ? statusTarefaClass(statusAlvo) : 'border-border text-muted-foreground',
        )}>
          {titulo}
        </span>
        <Badge variant="muted" className="text-[10px]">{tarefas.length}</Badge>
      </div>
      {tarefas.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/60 px-3 py-3 text-center text-xs text-muted-foreground">
          {aceitaDrop ? 'Arraste uma tarefa aqui' : 'Nenhuma'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {tarefas.map((t) => (
            <TarefaCard key={t.id} t={t} onClick={() => onAbrir(t.id)} draggable={aceitaDrop} />
          ))}
        </div>
      )}
    </div>
  );
}
