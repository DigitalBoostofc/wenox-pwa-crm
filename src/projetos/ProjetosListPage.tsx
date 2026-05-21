import { useEffect, useMemo, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Plus, Search, FolderKanban, LayoutGrid, List, Columns3, MoreHorizontal,
  LayoutList, SlidersHorizontal, GripVertical, Repeat2,
} from 'lucide-react';
import { listProjetos, atualizarProjeto } from './projetosService';
import { listEtapas } from './etapasService';
import type { Projeto, EtapaProjeto } from './types';
import { listOpcoes } from '@/opcoes/opcoesService';
import type { Opcao } from '@/opcoes/types';
import { logoUrl } from '@/clientes/clientesService';
import { corAvatar, inicial, dataBR } from '@/clientes/format';
import {
  STATUS_PROJETO, statusProjetoVariant, statusVariantParaTipo,
  statusesParaTipo, pillStatusParaTipoClass,
  TIPO_SOCIAL_MEDIA,
} from './format';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type ViewMode = 'cards' | 'kanban' | 'lista';
const VIEW_KEY = 'wenox-projetos-view-v1';
function carregarView(): ViewMode {
  try {
    const s = localStorage.getItem(VIEW_KEY);
    if (s === 'cards' || s === 'kanban' || s === 'lista') return s;
  } catch { /* */ }
  return 'lista';
}
function salvarView(v: ViewMode) {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* */ }
}

/** Iniciais (até 2 letras) pra um botão compacto. */
function iniciaisTipo(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  if (partes[0]?.length >= 2) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0]?.[0] ?? '?').toUpperCase();
}

function nomeCliente(p: Projeto): string {
  const c = p.expand?.cliente;
  if (!c) return '—';
  return (c.nome?.trim() || c.nome_fantasia || '—').trim();
}

function logoCliente(p: Projeto): string {
  const c = p.expand?.cliente;
  if (!c?.logo) return '';
  return logoUrl(c as never, '100x100');
}

function iniciaisResponsavel(r?: { nome?: string; email?: string }): string {
  const n = (r?.nome ?? r?.email ?? '?').trim();
  const partes = n.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return n.charAt(0).toUpperCase() || '?';
}

function MenuMoverEtapa({
  projeto, etapasDoTipo, onChanged,
}: {
  projeto: Projeto;
  etapasDoTipo: EtapaProjeto[];
  onChanged: () => void;
}) {
  if (etapasDoTipo.length === 0) return null;
  async function mover(etapa: string) {
    if (etapa === projeto.etapa) return;
    await atualizarProjeto(projeto.id, { etapa });
    onChanged();
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mover etapa"
          onClick={(e) => e.stopPropagation()}
          className="size-7"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Mover para etapa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {etapasDoTipo.map((et) => (
          <button
            key={et.id}
            type="button"
            onClick={(e) => { e.stopPropagation(); mover(et.nome); }}
            className={cn(
              'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary',
              et.nome === projeto.etapa && 'text-primary',
            )}
          >
            <span>{et.nome}</span>
            {et.nome === projeto.etapa && <span className="text-xs">atual</span>}
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CardProjeto({
  p, etapasDoTipo, onClick, onChanged, draggable, arrastando, mostrarTipo = true,
}: {
  p: Projeto;
  etapasDoTipo: EtapaProjeto[];
  onClick: () => void;
  onChanged: () => void;
  draggable?: boolean;
  arrastando?: boolean;
  mostrarTipo?: boolean;
}) {
  const cliNome = nomeCliente(p);
  const logo = logoCliente(p);
  const idx = p.etapa ? etapasDoTipo.findIndex((e) => e.nome === p.etapa) : -1;
  const total = etapasDoTipo.length;
  const posTxt = total > 0 && idx >= 0
    ? `Etapa ${idx + 1} de ${total}`
    : (p.etapa ? 'Etapa fora do pipeline' : 'Sem etapa');
  const responsaveis = p.expand?.responsaveis ?? [];

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData('text/projeto-id', p.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={cn(
        'group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        arrastando && 'opacity-50',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(p.etiquetas ?? []).slice(0, 3).map((t) => (
            <Badge key={t} variant="muted" className="text-[10px]">{t}</Badge>
          ))}
          {p.etiquetas && p.etiquetas.length > 3 && (
            <Badge variant="muted" className="text-[10px]">+{p.etiquetas.length - 3}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {p.status && (
            <Badge variant={statusVariantParaTipo(p.tipo, p.status)} className="text-[10px]">
              {p.status}
            </Badge>
          )}
          {p.etapa && (
            <Badge variant="muted" className="text-[10px]">{p.etapa}</Badge>
          )}
          <MenuMoverEtapa projeto={p} etapasDoTipo={etapasDoTipo} onChanged={onChanged} />
        </div>
      </div>

      <h3 className="text-base font-semibold leading-tight">{p.nome}</h3>

      <div className="flex items-center gap-3">
        {logo ? (
          <img src={logo} alt={cliNome} className="size-8 rounded-lg object-cover" />
        ) : (
          <div className={cn('grid size-8 place-items-center rounded-lg text-xs font-bold text-white', corAvatar(cliNome))}>
            {inicial(cliNome)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{cliNome}</p>
          {mostrarTipo && (
            <p className="truncate text-xs text-muted-foreground">{p.tipo || 'Sem tipo'}</p>
          )}
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {posTxt}
        </span>
        <div className="flex -space-x-2">
          {responsaveis.slice(0, 3).map((r) => (
            <div
              key={r.id}
              title={r.nome ?? r.email}
              className={cn('grid size-7 place-items-center rounded-full border-2 border-card text-[10px] font-bold text-white', corAvatar(r.nome ?? r.email ?? r.id))}
            >
              {iniciaisResponsavel(r)}
            </div>
          ))}
          {responsaveis.length > 3 && (
            <div className="grid size-7 place-items-center rounded-full border-2 border-card bg-secondary text-[10px] font-bold text-muted-foreground">
              +{responsaveis.length - 3}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Coluna estreita à esquerda da página com botões compactos por tipo. */
function BarraTipos({
  tipos, ativo, onChange,
}: {
  tipos: string[];
  ativo: string;
  onChange: (t: string) => void;
}) {
  const itens: { valor: string; label: string; icone?: typeof LayoutGrid }[] = [
    { valor: 'Todos', label: 'Todos', icone: LayoutList },
    ...tipos.map((t) => ({ valor: t, label: t })),
  ];
  return (
    <aside className="hidden shrink-0 flex-col gap-2 lg:flex">
      {itens.map((it) => {
        const selecionado = ativo === it.valor;
        const Icon = it.icone;
        return (
          <button
            key={it.valor}
            type="button"
            onClick={() => onChange(it.valor)}
            title={it.label}
            aria-label={it.label}
            aria-pressed={selecionado}
            className={cn(
              'grid size-12 place-items-center rounded-xl border text-xs font-bold transition-colors',
              selecionado
                ? 'border-primary/50 bg-primary/15 text-primary shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35)]'
                : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            {Icon ? <Icon className="size-5" /> : iniciaisTipo(it.valor)}
          </button>
        );
      })}
    </aside>
  );
}

function ViewToggleBtn({
  ativo, onClick, icon: Icon, label,
}: {
  ativo: boolean;
  onClick: () => void;
  icon: typeof LayoutGrid;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={ativo}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
        ativo
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-secondary',
      )}
    >
      <Icon className="size-4" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

export function ProjetosListPage() {
  const history = useHistory();
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('Todos');
  /** Pill de status — default "Desenvolvimento" (pedido do Leonardo). */
  const [statusFiltro, setStatusFiltro] = useState<string>('Desenvolvimento');
  /** Filtro extra (dropdown) — independente do pill de status. */
  const [filtroExtra, setFiltroExtra] = useState<
    'nenhum' | 'execucao' | 'todos' | 'concluidos'
  >('nenhum');
  const [view, setView] = useState<ViewMode>(carregarView);
  const [tipos, setTipos] = useState<Opcao[]>([]);
  const [todasEtapas, setTodasEtapas] = useState<EtapaProjeto[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [recarregaTrigger, setRecarregaTrigger] = useState(0);
  const seqRef = useRef(0);

  useEffect(() => {
    listOpcoes('tipo_projeto').then(setTipos);
    listEtapas().then(setTodasEtapas);
  }, []);

  useEffect(() => {
    const seq = ++seqRef.current;
    const q = busca.trim();
    setCarregando(true);
    const timer = setTimeout(() => {
      const opts = {
        busca: q || undefined,
        tipo: tipoFiltro === 'Todos' ? undefined : tipoFiltro,
      };
      listProjetos(opts)
        .then((res) => {
          if (seq !== seqRef.current) return;
          setProjetos(res);
          setErro('');
        })
        .catch(() => {
          if (seq !== seqRef.current) return;
          setErro('Não foi possível carregar os projetos.');
        })
        .finally(() => {
          if (seq === seqRef.current) setCarregando(false);
        });
    }, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [busca, tipoFiltro, recarregaTrigger]);

  const etapasPorTipo = useMemo(() => {
    const m: Record<string, EtapaProjeto[]> = {};
    for (const e of todasEtapas) (m[e.tipo] ??= []).push(e);
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    return m;
  }, [todasEtapas]);

  /** Aplica os 2 filtros (pill de status + select Filtro) client-side. */
  const projetosFiltrados = useMemo(() => {
    return projetos.filter((p) => {
      // Pill de status
      if (statusFiltro !== 'Todos' && p.status !== statusFiltro) return false;
      // Filtro extra (dropdown)
      if (filtroExtra === 'execucao'
          && p.status !== 'Desenvolvimento' && p.status !== 'Manutenção') return false;
      if (filtroExtra === 'todos' && p.status === 'Inativo') return false;
      if (filtroExtra === 'concluidos') {
        const e = (p.etapa ?? '').trim().toLowerCase();
        if (e !== 'concluído' && e !== 'concluido') return false;
      }
      return true;
    });
  }, [projetos, statusFiltro, filtroExtra]);

  // Reseta statusFiltro ao trocar tipo para evitar filtros inconsistentes
  useEffect(() => { setStatusFiltro('Todos'); }, [tipoFiltro]);

  const filtros = useMemo(() => ['Todos', ...tipos.map((t) => t.valor)], [tipos]);
  const trocarView = (v: ViewMode) => { setView(v); salvarView(v); };
  const recarregar = () => setRecarregaTrigger((n) => n + 1);
  const abrirProjeto = (id: string) => history.push(`/projetos/${id}`);

  /** Move um projeto para outra etapa com update otimista (recarrega no fim). */
  async function moverProjeto(projetoId: string, novaEtapa: string) {
    const alvo = projetos.find((p) => p.id === projetoId);
    if (!alvo || alvo.etapa === novaEtapa) return;
    setProjetos((lst) => lst.map((p) => (p.id === projetoId ? { ...p, etapa: novaEtapa } : p)));
    try {
      await atualizarProjeto(projetoId, { etapa: novaEtapa });
    } catch {
      setErro('Não foi possível mover o projeto. Tente novamente.');
      recarregar();
    }
  }

  /** Atualiza o status de um projeto inline (também otimista). */
  async function atualizarStatus(projetoId: string, novoStatus: string) {
    const alvo = projetos.find((p) => p.id === projetoId);
    if (!alvo || alvo.status === novoStatus) return;
    setProjetos((lst) => lst.map((p) => (p.id === projetoId ? { ...p, status: novoStatus } : p)));
    try {
      await atualizarProjeto(projetoId, { status: novoStatus });
    } catch {
      setErro('Não foi possível atualizar o status. Tente novamente.');
      recarregar();
    }
  }

  return (
    <div className="flex gap-4">
      <BarraTipos
        tipos={tipos.map((t) => t.valor)}
        ativo={tipoFiltro}
        onChange={setTipoFiltro}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Projetos</h1>
        <p className="text-sm text-muted-foreground">
          Visão operacional dos projetos da agência
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Buscar projeto ou cliente"
            aria-label="Buscar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-background/40 p-1">
          <ViewToggleBtn ativo={view === 'cards'} onClick={() => trocarView('cards')} icon={LayoutGrid} label="Cards" />
          <ViewToggleBtn ativo={view === 'kanban'} onClick={() => trocarView('kanban')} icon={Columns3} label="Kanban" />
          <ViewToggleBtn ativo={view === 'lista'} onClick={() => trocarView('lista')} icon={List} label="Lista" />
        </div>
        <Button onClick={() => history.push('/projetos/novo')}>
          <Plus /> Novo projeto
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:hidden">
        {filtros.map((f) => (
          <button
            key={f}
            onClick={() => setTipoFiltro(f)}
            className={cn(
              'rounded-full border px-3.5 py-1 text-sm transition-colors',
              tipoFiltro === f
                ? 'border-primary/50 bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-secondary',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Pills de status + dropdown Filtro. */}
      <div className="flex flex-wrap items-center gap-2">
        {['Todos', ...statusesParaTipo(tipoFiltro === 'Todos' ? undefined : tipoFiltro)].map((s) => {
          const ativo = statusFiltro === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFiltro(s)}
              className={cn(
                'rounded-full border px-3.5 py-1 text-sm transition-colors',
                ativo
                  ? s === 'Todos'
                    ? 'border-primary/50 bg-primary/15 text-primary'
                    : pillStatusParaTipoClass(tipoFiltro === 'Todos' ? undefined : tipoFiltro, s)
                  : 'border-border text-muted-foreground hover:bg-secondary',
              )}
            >
              {s}
            </button>
          );
        })}
        {tipoFiltro !== TIPO_SOCIAL_MEDIA && (
          <select
            aria-label="Filtro extra"
            value={filtroExtra}
            onChange={(e) => setFiltroExtra(e.target.value as typeof filtroExtra)}
            className="h-10 rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <option value="nenhum">Filtro: nenhum</option>
            <option value="execucao">Em execução</option>
            <option value="todos">Todos (exceto Inativos)</option>
            <option value="concluidos">Concluídos</option>
          </select>
        )}
      </div>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {erro}
        </p>
      )}

      {carregando && projetos.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="mb-3 h-4 w-16" />
              <Skeleton className="mb-3 h-5 w-3/4" />
              <Skeleton className="h-8 w-full" />
            </Card>
          ))}
        </div>
      ) : view === 'lista' ? (
        // Em "lista" sempre renderiza o componente (mantém o botão Colunas
        // visível mesmo quando o filtro resulta em zero projetos).
        <ListaProjetos
          projetos={projetosFiltrados}
          etapasPorTipo={etapasPorTipo}
          onAbrir={abrirProjeto}
          mostrarColTipo={tipoFiltro === 'Todos'}
          mostrarColEtapa={tipoFiltro !== TIPO_SOCIAL_MEDIA}
          tipoFiltro={tipoFiltro}
          onStatusChange={atualizarStatus}
          onEtapaChange={tipoFiltro !== TIPO_SOCIAL_MEDIA ? moverProjeto : undefined}
          totalBruto={projetos.length}
        />
      ) : projetosFiltrados.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <FolderKanban className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {projetos.length === 0
                ? <>Nenhum projeto ainda. Clica em <strong>Novo projeto</strong> pra cadastrar.</>
                : 'Nenhum projeto neste filtro.'}
            </p>
          </div>
        </Card>
      ) : view === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projetosFiltrados.map((p) => (
            <CardProjeto
              key={p.id}
              p={p}
              etapasDoTipo={etapasPorTipo[p.tipo ?? ''] ?? []}
              onClick={() => abrirProjeto(p.id)}
              onChanged={recarregar}
              mostrarTipo={tipoFiltro === 'Todos'}
            />
          ))}
        </div>
      ) : (
        <KanbanProjetos
          projetos={projetosFiltrados}
          tipoFiltro={tipoFiltro}
          etapasPorTipo={etapasPorTipo}
          onAbrir={abrirProjeto}
          onTrocarTipo={setTipoFiltro}
          tiposDisponiveis={tipos.map((t) => t.valor)}
          onChanged={recarregar}
          onMover={moverProjeto}
        />
      )}

      {!carregando && projetosFiltrados.length > 0 && (
        <p className="pt-1 text-right text-xs text-muted-foreground">
          {projetosFiltrados.length} {projetosFiltrados.length === 1 ? 'projeto' : 'projetos'}
        </p>
      )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- */
/*                                Kanban                                 */
/* --------------------------------------------------------------------- */

function KanbanProjetos({
  projetos, tipoFiltro, etapasPorTipo, tiposDisponiveis,
  onAbrir, onTrocarTipo, onChanged, onMover,
}: {
  projetos: Projeto[];
  tipoFiltro: string;
  etapasPorTipo: Record<string, EtapaProjeto[]>;
  tiposDisponiveis: string[];
  onAbrir: (id: string) => void;
  onTrocarTipo: (t: string) => void;
  onChanged: () => void;
  onMover: (projetoId: string, novaEtapa: string) => Promise<void>;
}) {
  if (tipoFiltro === 'Todos') {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 px-5 py-12 text-center">
          <Columns3 className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Kanban precisa de um tipo</p>
            <p className="text-sm text-muted-foreground">
              Cada tipo de projeto tem suas próprias etapas. Selecione um tipo acima para ver as colunas.
            </p>
          </div>
          {tiposDisponiveis.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {tiposDisponiveis.map((t) => (
                <Button key={t} size="sm" variant="outline" onClick={() => onTrocarTipo(t)}>
                  {t}
                </Button>
              ))}
            </div>
          )}
        </div>
      </Card>
    );
  }
  if (tipoFiltro === TIPO_SOCIAL_MEDIA) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <Repeat2 className="size-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Projeto recorrente</p>
            <p className="text-sm text-muted-foreground">
              Social Media não usa pipeline de etapas. Acompanhe as atividades
              mensais dentro de cada projeto.
            </p>
          </div>
        </div>
      </Card>
    );
  }
  const etapas = etapasPorTipo[tipoFiltro] ?? [];
  if (etapas.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <Columns3 className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Cadastre as etapas de <strong>{tipoFiltro}</strong> em <em>Configurações → Etapas de projeto</em>.
          </p>
        </div>
      </Card>
    );
  }
  // Agrupa projetos pela etapa (etapa não cadastrada vai pra coluna "Sem etapa")
  const buckets = new Map<string, Projeto[]>();
  for (const et of etapas) buckets.set(et.nome, []);
  const semEtapa: Projeto[] = [];
  for (const p of projetos) {
    if (p.etapa && buckets.has(p.etapa)) buckets.get(p.etapa)!.push(p);
    else semEtapa.push(p);
  }
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3">
        {etapas.map((et) => (
          <ColunaKanban
            key={et.id}
            titulo={et.nome}
            etapaAlvo={et.nome}
            ordem={et.ordem}
            total={etapas.length}
            projetos={buckets.get(et.nome) ?? []}
            etapasDoTipo={etapas}
            onAbrir={onAbrir}
            onChanged={onChanged}
            onSoltar={onMover}
          />
        ))}
        {semEtapa.length > 0 && (
          <ColunaKanban
            titulo="Sem etapa"
            projetos={semEtapa}
            etapasDoTipo={etapas}
            onAbrir={onAbrir}
            onChanged={onChanged}
            destaque
          />
        )}
      </div>
    </div>
  );
}

function ColunaKanban({
  titulo, etapaAlvo, ordem, total, projetos, etapasDoTipo,
  onAbrir, onChanged, destaque, onSoltar,
}: {
  titulo: string;
  etapaAlvo?: string;
  ordem?: number;
  total?: number;
  projetos: Projeto[];
  etapasDoTipo: EtapaProjeto[];
  onAbrir: (id: string) => void;
  onChanged: () => void;
  destaque?: boolean;
  onSoltar?: (projetoId: string, novaEtapa: string) => Promise<void>;
}) {
  const [recebendo, setRecebendo] = useState(false);
  const aceitaDrop = !!(onSoltar && etapaAlvo);
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
        const id = e.dataTransfer.getData('text/projeto-id');
        if (id && etapaAlvo) await onSoltar!(id, etapaAlvo);
      }}
      className={cn(
        'flex min-w-52 flex-1 flex-col gap-2 rounded-lg border border-border bg-background/40 p-3 transition-colors',
        destaque && 'border-dashed border-muted-foreground/30',
        recebendo && 'border-primary bg-primary/5',
      )}
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {ordem != null && total != null && (
            <span className="grid size-5 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
              {ordem}
            </span>
          )}
          <span className="text-sm font-semibold">{titulo}</span>
        </div>
        <Badge variant="muted" className="text-[10px]">{projetos.length}</Badge>
      </div>
      {projetos.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/60 px-3 py-3 text-center text-xs text-muted-foreground">
          {aceitaDrop ? 'Arraste um projeto aqui' : 'Nenhum'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {projetos.map((p) => (
            <CardProjeto
              key={p.id}
              p={p}
              etapasDoTipo={etapasDoTipo}
              onClick={() => onAbrir(p.id)}
              onChanged={onChanged}
              draggable={aceitaDrop}
              mostrarTipo={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/*                                 Lista                                 */
/* --------------------------------------------------------------------- */

/* --------------------------- Lista colunas --------------------------- */

type ColProjKey =
  | 'cliente' | 'projeto' | 'etapa' | 'prazo' | 'status'
  | 'responsaveis' | 'observacao' | 'tipo';

interface ColProjDef { key: ColProjKey; label: string; visivel: boolean }

const COLS_PROJ_PADRAO: ColProjDef[] = [
  { key: 'cliente',      label: 'Cliente',      visivel: true },
  { key: 'projeto',      label: 'Projeto',      visivel: true },
  { key: 'etapa',        label: 'Etapa',        visivel: true },
  { key: 'prazo',        label: 'Prazo',        visivel: true },
  { key: 'status',       label: 'Status',       visivel: true },
  { key: 'responsaveis', label: 'Responsáveis', visivel: true },
  { key: 'observacao',   label: 'Observação',   visivel: true },
  { key: 'tipo',         label: 'Tipo',         visivel: false },
];
const COL_PROJ_KEY = 'wenox-colunas-projetos-v1';

function carregarColunasProj(): ColProjDef[] {
  try {
    const s = localStorage.getItem(COL_PROJ_KEY);
    if (!s) return COLS_PROJ_PADRAO;
    const salvo = JSON.parse(s) as ColProjDef[];
    const conhecidas = new Map(COLS_PROJ_PADRAO.map((c) => [c.key, c]));
    const ord: ColProjDef[] = salvo
      .filter((c) => conhecidas.has(c.key))
      .map((c) => ({ ...conhecidas.get(c.key)!, visivel: !!c.visivel }));
    for (const c of COLS_PROJ_PADRAO) if (!ord.some((o) => o.key === c.key)) ord.push(c);
    return ord;
  } catch {
    return COLS_PROJ_PADRAO;
  }
}
function salvarColunasProj(cols: ColProjDef[]) {
  try { localStorage.setItem(COL_PROJ_KEY, JSON.stringify(cols)); } catch { /* */ }
}

type OrdemProj = 'prazo' | 'cliente' | 'etapa' | 'status';
const ORDEM_PROJ_KEY = 'wenox-ordem-projetos-v1';
const ORDENS_PROJ: { v: OrdemProj; label: string }[] = [
  { v: 'prazo',   label: 'Prazo (mais próximo)' },
  { v: 'cliente', label: 'Cliente (A→Z)' },
  { v: 'etapa',   label: 'Etapa (1ª → última)' },
  { v: 'status',  label: 'Status (Desenv. → Inativo)' },
];
function carregarOrdemProj(): OrdemProj {
  try {
    const s = localStorage.getItem(ORDEM_PROJ_KEY);
    if (s === 'prazo' || s === 'cliente' || s === 'etapa' || s === 'status') return s;
  } catch { /* */ }
  return 'prazo';
}
function salvarOrdemProj(o: OrdemProj) {
  try { localStorage.setItem(ORDEM_PROJ_KEY, o); } catch { /* */ }
}
const ORDEM_STATUS_PROJETO = ['Desenvolvimento', 'Manutenção', 'Ativo', 'Inativo'];
function posicaoStatusProj(s?: string): number {
  const idx = ORDEM_STATUS_PROJETO.indexOf(s ?? '');
  return idx >= 0 ? idx : 99;
}

function ListaProjetos({
  projetos, etapasPorTipo, onAbrir, mostrarColTipo = true,
  mostrarColEtapa = true, tipoFiltro, onStatusChange,
  onEtapaChange, totalBruto,
}: {
  projetos: Projeto[];
  etapasPorTipo: Record<string, EtapaProjeto[]>;
  onAbrir: (id: string) => void;
  mostrarColTipo?: boolean;
  mostrarColEtapa?: boolean;
  tipoFiltro?: string;
  onStatusChange?: (id: string, status: string) => void;
  onEtapaChange?: (id: string, etapa: string) => void;
  totalBruto?: number;
}) {
  const [colDefs, setColDefs] = useState<ColProjDef[]>(carregarColunasProj);
  const [ordem, setOrdem] = useState<OrdemProj>(carregarOrdemProj);
  const dragIdx = useRef<number | null>(null);

  const projetosOrdenados = useMemo(() => {
    const arr = [...projetos];
    arr.sort((a, b) => {
      if (ordem === 'cliente') {
        return nomeCliente(a).localeCompare(nomeCliente(b), 'pt-BR', { sensitivity: 'base' });
      }
      if (ordem === 'prazo') {
        // ASC por data_entrega; sem prazo (null) vai pro fim.
        const ta = a.data_entrega ? new Date(a.data_entrega).getTime() : Number.POSITIVE_INFINITY;
        const tb = b.data_entrega ? new Date(b.data_entrega).getTime() : Number.POSITIVE_INFINITY;
        return ta - tb;
      }
      if (ordem === 'etapa') {
        const etA = etapasPorTipo[a.tipo ?? ''] ?? [];
        const etB = etapasPorTipo[b.tipo ?? ''] ?? [];
        const ia = a.etapa ? etA.findIndex((e) => e.nome === a.etapa) : -1;
        const ib = b.etapa ? etB.findIndex((e) => e.nome === b.etapa) : -1;
        // Sem etapa ou fora do pipeline vai pro fim.
        const va = ia >= 0 ? ia : Number.POSITIVE_INFINITY;
        const vb = ib >= 0 ? ib : Number.POSITIVE_INFINITY;
        return va - vb;
      }
      // status
      return posicaoStatusProj(a.status) - posicaoStatusProj(b.status);
    });
    return arr;
  }, [projetos, ordem, etapasPorTipo]);

  function toggleCol(k: ColProjKey) {
    setColDefs((cs) => {
      const next = cs.map((c) => (c.key === k ? { ...c, visivel: !c.visivel } : c));
      salvarColunasProj(next);
      return next;
    });
  }
  function moverCol(de: number, para: number) {
    setColDefs((cs) => {
      if (de === para || para < 0 || para >= cs.length) return cs;
      const next = [...cs];
      const [item] = next.splice(de, 1);
      next.splice(para, 0, item);
      salvarColunasProj(next);
      return next;
    });
  }

  const colsVisiveis = useMemo(
    () => colDefs.filter((c) =>
      c.visivel &&
      (c.key !== 'tipo' || mostrarColTipo) &&
      (c.key !== 'etapa' || mostrarColEtapa),
    ),
    [colDefs, mostrarColTipo, mostrarColEtapa],
  );

  function celula(p: Projeto, key: ColProjKey) {
    if (key === 'cliente') {
      const cliNome = nomeCliente(p);
      const logo = logoCliente(p);
      return (
        <div className="flex items-center gap-3">
          {logo ? (
            <img src={logo} alt={cliNome} loading="lazy" decoding="async"
              className="size-8 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className={cn('grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white', corAvatar(cliNome))}>
              {inicial(cliNome)}
            </div>
          )}
          <span className="truncate font-medium">{cliNome}</span>
        </div>
      );
    }
    if (key === 'projeto') return <span className="font-medium">{p.nome}</span>;
    if (key === 'etapa') {
      const etapas = etapasPorTipo[p.tipo ?? ''] ?? [];
      const idx = p.etapa ? etapas.findIndex((e) => e.nome === p.etapa) : -1;
      const sufixo = etapas.length > 0 && idx >= 0 ? ` (${idx + 1}/${etapas.length})` : '';
      if (!onEtapaChange || etapas.length === 0) {
        return p.etapa ? (
          <Badge variant="muted" className="text-[10px]">{p.etapa}{sufixo}</Badge>
        ) : <span className="text-muted-foreground">—</span>;
      }
      return (
        <select
          value={p.etapa ?? ''}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); onEtapaChange(p.id, e.target.value); }}
          className="cursor-pointer rounded-full border border-border bg-secondary px-3 py-1.5 pr-7 text-xs font-medium text-muted-foreground transition-colors [color-scheme:dark] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <option value="">—</option>
          {etapas.map((et, i) => (
            <option key={et.id} value={et.nome}>
              {et.nome} ({i + 1}/{etapas.length})
            </option>
          ))}
        </select>
      );
    }
    if (key === 'prazo') {
      return <span className="text-muted-foreground">{dataBR(p.data_entrega) || '—'}</span>;
    }
    if (key === 'status') {
      const isSM = p.tipo === TIPO_SOCIAL_MEDIA;
      if (!onStatusChange) {
        return p.status ? (
          <Badge variant={statusVariantParaTipo(p.tipo, p.status)} className="text-[10px]">
            {p.status}
          </Badge>
        ) : <span className="text-muted-foreground">—</span>;
      }
      const statusOpts = statusesParaTipo(p.tipo);
      return (
        <select
          value={p.status ?? ''}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); onStatusChange(p.id, e.target.value); }}
          className={cn(
            'cursor-pointer rounded-full border px-3 py-1.5 pr-7 text-xs font-medium transition-colors [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            !isSM && p.status === 'Desenvolvimento' && 'border-amber-500/50 bg-amber-500/15 text-amber-400',
            !isSM && p.status === 'Manutenção'      && 'border-primary/50 bg-primary/15 text-primary',
            (p.status === 'Ativo')                  && 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400',
            (p.status === 'Inativo')                && 'border-destructive/50 bg-destructive/15 text-destructive',
            isSM  && p.status === 'Onboarding'      && 'border-primary/50 bg-primary/15 text-primary',
            isSM  && p.status === 'Pendente'        && 'border-amber-500/50 bg-amber-500/15 text-amber-400',
            isSM  && p.status === 'Offboarding'     && 'border-border bg-secondary text-muted-foreground',
            !p.status && 'border-border bg-secondary text-muted-foreground',
          )}
        >
          <option value="">—</option>
          {statusOpts.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      );
    }
    if (key === 'responsaveis') {
      const resps = p.expand?.responsaveis ?? [];
      if (resps.length === 0) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex -space-x-2">
          {resps.slice(0, 3).map((r) => (
            <div
              key={r.id}
              title={r.nome ?? r.email}
              className={cn('grid size-7 place-items-center rounded-full border-2 border-card text-[10px] font-bold text-white', corAvatar(r.nome ?? r.email ?? r.id))}
            >
              {iniciaisResponsavel(r)}
            </div>
          ))}
          {resps.length > 3 && (
            <div className="grid size-7 place-items-center rounded-full border-2 border-card bg-secondary text-[10px] font-bold text-muted-foreground">
              +{resps.length - 3}
            </div>
          )}
        </div>
      );
    }
    if (key === 'observacao') {
      const obs = (p.observacoes ?? '').trim();
      return obs ? (
        <span className="line-clamp-2 max-w-xs text-xs text-muted-foreground" title={obs}>
          {obs}
        </span>
      ) : <span className="text-muted-foreground">—</span>;
    }
    if (key === 'tipo') {
      return <span className="text-muted-foreground">{p.tipo || '—'}</span>;
    }
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          aria-label="Ordenar"
          value={ordem}
          onChange={(e) => { const v = e.target.value as OrdemProj; setOrdem(v); salvarOrdemProj(v); }}
          className="h-9 rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {ORDENS_PROJ.map((o) => (
            <option key={o.v} value={o.v}>{o.label}</option>
          ))}
        </select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal /> Colunas
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Colunas — arraste para reordenar</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {colDefs.map((c, idx) => (
              <div
                key={c.key}
                draggable
                onDragStart={() => { dragIdx.current = idx; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx.current !== null) moverCol(dragIdx.current, idx);
                  dragIdx.current = null;
                }}
                className="flex cursor-grab items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-secondary active:cursor-grabbing"
                onClick={() => toggleCol(c.key)}
              >
                <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                <span className={cn(
                  'grid size-4 shrink-0 place-items-center rounded border text-[10px]',
                  c.visivel ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                )}>
                  {c.visivel ? '✓' : ''}
                </span>
                <span className="flex-1">{c.label}</span>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              {colsVisiveis.map((col) => (
                <th key={col.key} className="px-4 py-3 font-medium">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projetos.length === 0 ? (
              <tr>
                <td colSpan={colsVisiveis.length || 1}
                  className="px-5 py-12 text-center text-sm text-muted-foreground">
                  {totalBruto === 0
                    ? 'Nenhum projeto ainda. Use o botão "Novo projeto" pra cadastrar.'
                    : 'Nenhum projeto neste filtro.'}
                </td>
              </tr>
            ) : projetosOrdenados.map((p) => (
              <tr
                key={p.id}
                onClick={() => onAbrir(p.id)}
                className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-secondary/50"
              >
                {colsVisiveis.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-muted-foreground">
                    {celula(p, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
