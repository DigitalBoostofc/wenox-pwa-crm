import { useEffect, useMemo, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Plus, Search, FolderKanban, LayoutGrid, List, Columns3, MoreHorizontal,
  SlidersHorizontal, GripVertical, Repeat2, Check, ChevronDown,
} from 'lucide-react';
import { listProjetos, atualizarProjeto } from './projetosService';
import { listEtapas } from './etapasService';
import type { Projeto, EtapaProjeto } from './types';
import { listOpcoes } from '@/opcoes/opcoesService';
import type { Opcao } from '@/opcoes/types';
import { logoUrl } from '@/clientes/clientesService';
import { fotoUrl, listUsuarios } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { corAvatar, inicial, dataBR } from '@/clientes/format';
import {
  statusVariantParaTipo, statusesParaTipo, pillStatusParaTipoClass,
  TIPO_SOCIAL_MEDIA,
} from './format';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { BarraTipos } from '@/components/BarraTipos';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HeaderSlot } from '@/components/layout/HeaderSlot';
import { useAuth } from '@/auth/useAuth';
import { ehCliente } from '@/auth/perms';

type ViewMode = 'cards' | 'kanban' | 'lista';
const VIEW_KEY = 'wenox-projetos-view-v1';
function carregarView(): ViewMode {
  return 'lista';
}
function salvarView(v: ViewMode) {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* */ }
}

/** Pill clicável que abre um dropdown (Radix) — o botão inteiro abre,
 *  não só a seta (diferente do <select> nativo). Usado pra status/etapa
 *  editáveis inline na Lista. */
function SeletorPill({
  valor, placeholder, opcoes, onSelect, classeBotao, rotulo,
}: {
  valor: string;
  placeholder: string;
  opcoes: { value: string; label: string }[];
  onSelect: (v: string) => void;
  classeBotao: string;
  rotulo?: string;
}) {
  const atual = opcoes.find((o) => o.value === valor);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            classeBotao,
          )}
        >
          {atual?.label ?? placeholder}
          <ChevronDown className="size-3 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-72 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {rotulo && (
          <>
            <DropdownMenuLabel>{rotulo}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {opcoes.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => onSelect(o.value)}>
            <Check className={cn('size-3.5', o.value === valor ? 'opacity-100' : 'opacity-0')} />
            <span>{o.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Alça de redimensionamento na borda direita do <th>. */
function ResizeHandle({
  onMouseDown,
}: { onMouseDown: (e: React.MouseEvent<HTMLSpanElement>) => void }) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Arraste para redimensionar coluna"
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
      className="group absolute -right-1 top-0 z-10 flex h-full w-2 cursor-col-resize select-none items-center justify-center"
    >
      <span
        aria-hidden
        className="h-2/3 w-px bg-border transition-colors group-hover:w-0.5 group-hover:bg-primary"
      />
    </span>
  );
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

type Responsavel = {
  id: string; nome?: string; email?: string;
  foto?: string; collectionId?: string; collectionName?: string;
};

/** Avatar do responsável: foto cadastrada, ou as iniciais com cor de fallback. */
function AvatarResponsavel({ r }: { r: Responsavel }) {
  const url = fotoUrl(r, '100x100');
  const titulo = r.nome ?? r.email;
  if (url) {
    return (
      <img
        src={url}
        alt={titulo ?? ''}
        title={titulo}
        loading="lazy"
        decoding="async"
        className="size-7 shrink-0 rounded-full border-2 border-card object-cover"
      />
    );
  }
  return (
    <div
      title={titulo}
      className={cn(
        'grid size-7 place-items-center rounded-full border-2 border-card text-[10px] font-bold text-white',
        corAvatar(r.nome ?? r.email ?? r.id),
      )}
    >
      {iniciaisResponsavel(r)}
    </div>
  );
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

      {total > 0 && idx >= 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round(((idx + 1) / total) * 100)}%` }}
          />
        </div>
      )}

      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {posTxt}
        </span>
        <div className="flex -space-x-2">
          {responsaveis.slice(0, 3).map((r) => (
            <AvatarResponsavel key={r.id} r={r} />
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
  const { user } = useAuth();
  const souCliente = ehCliente(user?.role);
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('Todos');
  /** Pill de status — default "Desenvolvimento" (pedido do Leonardo). */
  const [statusFiltro, setStatusFiltro] = useState<string>('Ativo');
  /** Filtro extra (dropdown) — independente do pill de status. */
  const [filtroExtra, setFiltroExtra] = useState<
    'nenhum' | 'execucao' | 'todos' | 'concluidos'
  >('nenhum');
  const [view, setView] = useState<ViewMode>(carregarView);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const [tipos, setTipos] = useState<Opcao[]>([]);
  const [todasEtapas, setTodasEtapas] = useState<EtapaProjeto[]>([]);
  // Membros internos — para o seletor de responsáveis editável na lista.
  const [membros, setMembros] = useState<Usuario[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [recarregaTrigger, setRecarregaTrigger] = useState(0);
  // Estado da tabela Lista (vive aqui pra os controles ficarem no topo da página).
  const [colDefsProj, setColDefsProj] = useState<ColProjDef[]>(carregarColunasProj);
  const [ordemProj, setOrdemProj] = useState<OrdemProj>(carregarOrdemProj);
  const [largurasProj, setLargurasProj] = useState<LargurasProj>(carregarLargurasProj);
  const seqRef = useRef(0);

  function toggleColProj(k: ColProjKey) {
    setColDefsProj((cs) => {
      const next = cs.map((c) => (c.key === k ? { ...c, visivel: !c.visivel } : c));
      salvarColunasProj(next);
      return next;
    });
  }
  function moverColProj(de: number, para: number) {
    setColDefsProj((cs) => {
      if (de === para || para < 0 || para >= cs.length) return cs;
      const next = [...cs];
      const [item] = next.splice(de, 1);
      next.splice(para, 0, item);
      salvarColunasProj(next);
      return next;
    });
  }

  useEffect(() => {
    listOpcoes('tipo_projeto').then((ts) => {
      setTipos(ts);
      // Sem "Todos": começa no 1º tipo (cai em 'Todos' só se não houver tipos).
      setTipoFiltro((cur) => (cur === 'Todos' && ts.length ? ts[0].valor : cur));
    });
    listEtapas().then(setTodasEtapas);
    listUsuarios()
      .then((us) => setMembros(us.filter((u) => u.role !== 'Cliente')))
      .catch(() => { /* sem membros → seletor fica vazio */ });
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

  // Reseta statusFiltro ao trocar tipo para evitar filtros inconsistentes.
  // "Ativo" existe em todos os tipos (inclusive Social Media).
  useEffect(() => { setStatusFiltro('Ativo'); }, [tipoFiltro]);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  /** Em mobile sempre cards; no desktop respeita a escolha salva. */
  const viewEfetiva: ViewMode = isMobile ? 'cards' : view;

  const filtros = useMemo(() => tipos.map((t) => t.valor), [tipos]);
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

  /** Edição inline genérica de um campo do projeto (otimista). */
  async function atualizarCampo(projetoId: string, patch: Partial<Projeto>) {
    setProjetos((lst) => lst.map((p) => {
      if (p.id !== projetoId) return p;
      const np: Projeto = { ...p, ...patch };
      // Ao mudar responsáveis, reconstrói o expand pra os avatares atualizarem.
      if (patch.responsaveis) {
        const sel = membros.filter((m) => patch.responsaveis!.includes(m.id));
        np.expand = { ...p.expand, responsaveis: sel };
      }
      return np;
    }));
    try {
      await atualizarProjeto(projetoId, patch);
    } catch {
      setErro('Não foi possível salvar a alteração. Tente novamente.');
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

      <HeaderSlot>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Buscar projeto ou cliente"
              aria-label="Buscar"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            />
          </div>
          {viewEfetiva === 'lista' && (
            <>
              <select
                aria-label="Ordenar"
                value={ordemProj}
                onChange={(e) => { const v = e.target.value as OrdemProj; setOrdemProj(v); salvarOrdemProj(v); }}
                className="h-9 rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                {ORDENS_PROJ.map((o) => (
                  <option key={o.v} value={o.v}>{o.label}</option>
                ))}
              </select>
              <MenuColunasProj
                colDefs={colDefsProj}
                onToggle={toggleColProj}
                onMover={moverColProj}
              />
            </>
          )}
          <div className="hidden items-center gap-1 rounded-md border border-border bg-background/40 p-1 lg:flex">
            <ViewToggleBtn ativo={view === 'lista'} onClick={() => trocarView('lista')} icon={List} label="Lista" />
            <ViewToggleBtn ativo={view === 'kanban'} onClick={() => trocarView('kanban')} icon={Columns3} label="Kanban" />
            <ViewToggleBtn ativo={view === 'cards'} onClick={() => trocarView('cards')} icon={LayoutGrid} label="Cards" />
          </div>
          {!souCliente && (
            <Button size="sm" onClick={() => history.push('/projetos/novo')}>
              <Plus /> Novo projeto
            </Button>
          )}
        </div>
      </HeaderSlot>

      {/* Pills de tipo — mobile apenas, scroll horizontal */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 lg:hidden [&::-webkit-scrollbar]:hidden">
        {filtros.map((f) => (
          <button
            key={f}
            onClick={() => setTipoFiltro(f)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1 text-sm transition-colors',
              tipoFiltro === f
                ? 'border-primary/50 bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-secondary',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Pills de status — scroll horizontal no mobile, wrap no desktop */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:overflow-visible lg:pb-0">
        {[...statusesParaTipo(tipoFiltro === 'Todos' ? undefined : tipoFiltro), 'Todos'].map((s) => {
          const ativo = statusFiltro === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFiltro(s)}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1 text-sm transition-colors',
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
            className="hidden h-10 shrink-0 rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 lg:block"
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
      ) : viewEfetiva === 'lista' ? (
        // Em "lista" sempre renderiza o componente (mantém o botão Colunas
        // visível mesmo quando o filtro resulta em zero projetos).
        <ListaProjetos
          projetos={projetosFiltrados}
          etapasPorTipo={etapasPorTipo}
          onAbrir={abrirProjeto}
          mostrarColTipo={tipoFiltro === 'Todos'}
          mostrarColEtapa={tipoFiltro !== TIPO_SOCIAL_MEDIA}
          onStatusChange={souCliente ? undefined : atualizarStatus}
          onEtapaChange={!souCliente && tipoFiltro !== TIPO_SOCIAL_MEDIA ? moverProjeto : undefined}
          onCampoChange={souCliente ? undefined : atualizarCampo}
          membros={membros}
          totalBruto={projetos.length}
          colDefs={colDefsProj}
          ordem={ordemProj}
          larguras={largurasProj}
          onResize={(key, largura) => {
            setLargurasProj((prev) => {
              const next = { ...prev, [key]: largura };
              salvarLargurasProj(next);
              return next;
            });
          }}
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
      ) : viewEfetiva === 'cards' ? (
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

/** Larguras (px) por coluna da tabela de projetos — persistidas. */
type LargurasProj = Partial<Record<ColProjKey, number>>;
const LARGURA_PROJ_KEY = 'wenox-larguras-projetos-v1';
function carregarLargurasProj(): LargurasProj {
  try {
    const s = localStorage.getItem(LARGURA_PROJ_KEY);
    return s ? (JSON.parse(s) as LargurasProj) : {};
  } catch {
    return {};
  }
}
function salvarLargurasProj(l: LargurasProj) {
  try { localStorage.setItem(LARGURA_PROJ_KEY, JSON.stringify(l)); } catch { /* */ }
}

/** Dropdown "Colunas" da Lista — toggle de visibilidade + reordenar arrastando. */
function MenuColunasProj({
  colDefs, onToggle, onMover,
}: {
  colDefs: ColProjDef[];
  onToggle: (k: ColProjKey) => void;
  onMover: (de: number, para: number) => void;
}) {
  const dragIdx = useRef<number | null>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
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
              if (dragIdx.current !== null) onMover(dragIdx.current, idx);
              dragIdx.current = null;
            }}
            className="flex cursor-grab items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-secondary active:cursor-grabbing"
            onClick={() => onToggle(c.key)}
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
  );
}

/** Texto editável inline: clica → input; Enter/blur salva; Esc cancela. */
function CelulaTexto({
  valor, onSalvar, placeholder = '—', multiline = false, className,
}: {
  valor: string;
  onSalvar: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(valor);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  function salvar() {
    setEditando(false);
    const limpo = v.trim();
    if (limpo !== (valor ?? '').trim()) onSalvar(limpo);
  }
  const cls = 'w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';
  if (!editando) {
    return (
      <button type="button"
        onClick={(e) => { e.stopPropagation(); setV(valor); setEditando(true); }}
        className={cn('block w-full truncate rounded px-1 py-0.5 text-left hover:bg-secondary', className)}>
        {valor.trim()
          ? <span className={multiline ? 'line-clamp-2 text-xs' : ''}>{valor}</span>
          : <span className="text-muted-foreground">{placeholder}</span>}
      </button>
    );
  }
  if (multiline) {
    return (
      <textarea autoFocus value={v} rows={2} onClick={stop}
        onChange={(e) => setV(e.target.value)} onBlur={salvar}
        onKeyDown={(e) => { stop(e); if (e.key === 'Escape') setEditando(false); }}
        className={cls} />
    );
  }
  return (
    <input autoFocus value={v} onClick={stop}
      onChange={(e) => setV(e.target.value)} onBlur={salvar}
      onKeyDown={(e) => { stop(e); if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setEditando(false); }}
      className={cls} />
  );
}

/** Data (prazo) editável inline. */
function CelulaData({ valor, onSalvar }: { valor?: string; onSalvar: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const iso = (valor ?? '').slice(0, 10);
  if (!editando) {
    return (
      <button type="button"
        onClick={(e) => { e.stopPropagation(); setEditando(true); }}
        className="w-full rounded px-1 py-0.5 text-left text-muted-foreground hover:bg-secondary">
        {dataBR(valor) || '—'}
      </button>
    );
  }
  return (
    <input type="date" autoFocus defaultValue={iso}
      onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}
      onBlur={(e) => { setEditando(false); if (e.target.value !== iso) onSalvar(e.target.value); }}
      className="w-full rounded border border-input bg-background px-2 py-1 text-sm text-foreground" />
  );
}

/** Responsáveis editáveis inline (dropdown com checkboxes). */
function CelulaResponsaveis({
  atuais, membros, onSalvar,
}: {
  atuais: string[];
  membros: Usuario[];
  onSalvar: (ids: string[]) => void;
}) {
  const selecionados = membros.filter((m) => atuais.includes(m.id));
  function toggle(id: string) {
    onSalvar(atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id]);
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" onClick={(e) => e.stopPropagation()}
          className="flex items-center rounded px-1 py-0.5 hover:bg-secondary">
          {selecionados.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <div className="flex -space-x-2">
              {selecionados.slice(0, 3).map((m) => <AvatarResponsavel key={m.id} r={m} />)}
              {selecionados.length > 3 && (
                <div className="grid size-7 place-items-center rounded-full border-2 border-card bg-secondary text-[10px] font-bold text-muted-foreground">
                  +{selecionados.length - 3}
                </div>
              )}
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        {membros.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum membro</div>
        ) : membros.map((m) => {
          const ativo = atuais.includes(m.id);
          return (
            <DropdownMenuItem key={m.id}
              onSelect={(e) => { e.preventDefault(); toggle(m.id); }}
              className="gap-2">
              <span className={cn('grid size-4 shrink-0 place-items-center rounded border',
                ativo ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                {ativo && <Check className="size-3" />}
              </span>
              <span className="truncate">{m.nome || m.email}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ListaProjetos({
  projetos, etapasPorTipo, onAbrir, mostrarColTipo = true,
  mostrarColEtapa = true, onStatusChange, onEtapaChange, onCampoChange,
  membros = [], totalBruto, colDefs, ordem, larguras, onResize,
}: {
  projetos: Projeto[];
  etapasPorTipo: Record<string, EtapaProjeto[]>;
  onAbrir: (id: string) => void;
  mostrarColTipo?: boolean;
  mostrarColEtapa?: boolean;
  onStatusChange?: (id: string, status: string) => void;
  onEtapaChange?: (id: string, etapa: string) => void;
  onCampoChange?: (id: string, patch: Partial<Projeto>) => void;
  membros?: Usuario[];
  totalBruto?: number;
  colDefs: ColProjDef[];
  ordem: OrdemProj;
  larguras: LargurasProj;
  onResize: (key: ColProjKey, largura: number) => void;
}) {

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

  function iniciarResize(key: ColProjKey, thEl: HTMLElement, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const base = thEl.getBoundingClientRect().width;
    const startX = e.clientX;
    const MIN = 80;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    function onMove(ev: MouseEvent) {
      onResize(key, Math.max(MIN, Math.round(base + (ev.clientX - startX))));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
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
    if (key === 'projeto') {
      if (!onCampoChange) return <span className="font-medium">{p.nome}</span>;
      return (
        <CelulaTexto
          valor={p.nome ?? ''}
          className="font-medium"
          onSalvar={(v) => { if (v) onCampoChange(p.id, { nome: v }); }}
        />
      );
    }
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
        <SeletorPill
          valor={p.etapa ?? ''}
          placeholder="—"
          rotulo="Mover para etapa"
          opcoes={etapas.map((et, i) => ({
            value: et.nome,
            label: `${et.nome} (${i + 1}/${etapas.length})`,
          }))}
          onSelect={(v) => onEtapaChange(p.id, v)}
          classeBotao="border-border bg-secondary text-muted-foreground hover:text-foreground"
        />
      );
    }
    if (key === 'prazo') {
      if (!onCampoChange) {
        return <span className="text-muted-foreground">{dataBR(p.data_entrega) || '—'}</span>;
      }
      return (
        <CelulaData
          valor={p.data_entrega}
          onSalvar={(v) => onCampoChange(p.id, { data_entrega: v })}
        />
      );
    }
    if (key === 'status') {
      if (!onStatusChange) {
        return p.status ? (
          <Badge variant={statusVariantParaTipo(p.tipo, p.status)} className="text-[10px]">
            {p.status}
          </Badge>
        ) : <span className="text-muted-foreground">—</span>;
      }
      const statusOpts = statusesParaTipo(p.tipo);
      const classeBotao = p.status
        ? pillStatusParaTipoClass(p.tipo, p.status)
        : 'border-border bg-secondary text-muted-foreground';
      return (
        <SeletorPill
          valor={p.status ?? ''}
          placeholder="—"
          rotulo="Status do projeto"
          opcoes={statusOpts.map((s) => ({ value: s, label: s }))}
          onSelect={(v) => onStatusChange(p.id, v)}
          classeBotao={classeBotao}
        />
      );
    }
    if (key === 'responsaveis') {
      if (onCampoChange) {
        return (
          <CelulaResponsaveis
            atuais={p.responsaveis ?? []}
            membros={membros}
            onSalvar={(ids) => onCampoChange(p.id, { responsaveis: ids })}
          />
        );
      }
      const resps = p.expand?.responsaveis ?? [];
      if (resps.length === 0) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex -space-x-2">
          {resps.slice(0, 3).map((r) => (
            <AvatarResponsavel key={r.id} r={r} />
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
      if (onCampoChange) {
        return (
          <CelulaTexto
            valor={p.observacoes ?? ''}
            multiline
            placeholder="—"
            onSalvar={(v) => onCampoChange(p.id, { observacoes: v })}
          />
        );
      }
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
    <Card className="overflow-hidden">
      <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            {colsVisiveis.map((col) => (
              <th
                key={col.key}
                className="relative px-4 py-3 font-medium"
                style={larguras[col.key] ? { width: larguras[col.key] } : undefined}
              >
                {col.label}
                <ResizeHandle
                  onMouseDown={(e) => iniciarResize(col.key, e.currentTarget.parentElement!, e)}
                />
              </th>
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
                <td key={col.key} className="overflow-hidden px-4 py-3 text-muted-foreground">
                  {celula(p, col.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
