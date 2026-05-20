import { useEffect, useMemo, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Plus, Search, FolderKanban, LayoutGrid, List, Columns3, MoreHorizontal,
} from 'lucide-react';
import { listProjetos, atualizarProjeto } from './projetosService';
import { listEtapas } from './etapasService';
import type { Projeto, EtapaProjeto } from './types';
import { listOpcoes } from '@/opcoes/opcoesService';
import type { Opcao } from '@/opcoes/types';
import { logoUrl } from '@/clientes/clientesService';
import { corAvatar, inicial, dataBR } from '@/clientes/format';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

type ViewMode = 'cards' | 'kanban' | 'lista';
const VIEW_KEY = 'wenox-projetos-view-v1';
function carregarView(): ViewMode {
  try {
    const s = localStorage.getItem(VIEW_KEY);
    if (s === 'cards' || s === 'kanban' || s === 'lista') return s;
  } catch { /* */ }
  return 'cards';
}
function salvarView(v: ViewMode) {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* */ }
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
  p, etapasDoTipo, onClick, onChanged,
}: {
  p: Projeto;
  etapasDoTipo: EtapaProjeto[];
  onClick: () => void;
  onChanged: () => void;
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
      className="group flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
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
          {p.etapa && (
            <Badge variant="default" className="text-[10px]">{p.etapa}</Badge>
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
          <p className="truncate text-xs text-muted-foreground">{p.tipo || 'Sem tipo'}</p>
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

  const filtros = useMemo(() => ['Todos', ...tipos.map((t) => t.valor)], [tipos]);
  const trocarView = (v: ViewMode) => { setView(v); salvarView(v); };
  const recarregar = () => setRecarregaTrigger((n) => n + 1);
  const abrirProjeto = (id: string) => history.push(`/projetos/${id}`);

  return (
    <div className="flex max-w-7xl flex-col gap-5">
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

      <div className="flex flex-wrap items-center gap-2">
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
      ) : projetos.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <FolderKanban className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum projeto ainda. Clica em <strong>Novo projeto</strong> pra cadastrar.
            </p>
          </div>
        </Card>
      ) : view === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projetos.map((p) => (
            <CardProjeto
              key={p.id}
              p={p}
              etapasDoTipo={etapasPorTipo[p.tipo ?? ''] ?? []}
              onClick={() => abrirProjeto(p.id)}
              onChanged={recarregar}
            />
          ))}
        </div>
      ) : view === 'kanban' ? (
        <KanbanProjetos
          projetos={projetos}
          tipoFiltro={tipoFiltro}
          etapasPorTipo={etapasPorTipo}
          onAbrir={abrirProjeto}
          onTrocarTipo={setTipoFiltro}
          tiposDisponiveis={tipos.map((t) => t.valor)}
          onChanged={recarregar}
        />
      ) : (
        <ListaProjetos
          projetos={projetos}
          etapasPorTipo={etapasPorTipo}
          onAbrir={abrirProjeto}
        />
      )}

      {!carregando && projetos.length > 0 && (
        <p className="pt-1 text-right text-xs text-muted-foreground">
          {projetos.length} {projetos.length === 1 ? 'projeto' : 'projetos'}
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- */
/*                                Kanban                                 */
/* --------------------------------------------------------------------- */

function KanbanProjetos({
  projetos, tipoFiltro, etapasPorTipo, tiposDisponiveis,
  onAbrir, onTrocarTipo, onChanged,
}: {
  projetos: Projeto[];
  tipoFiltro: string;
  etapasPorTipo: Record<string, EtapaProjeto[]>;
  tiposDisponiveis: string[];
  onAbrir: (id: string) => void;
  onTrocarTipo: (t: string) => void;
  onChanged: () => void;
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
      <div className="flex min-w-max gap-3">
        {etapas.map((et) => (
          <ColunaKanban
            key={et.id}
            titulo={et.nome}
            ordem={et.ordem}
            total={etapas.length}
            projetos={buckets.get(et.nome) ?? []}
            etapasDoTipo={etapas}
            onAbrir={onAbrir}
            onChanged={onChanged}
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
  titulo, ordem, total, projetos, etapasDoTipo, onAbrir, onChanged, destaque,
}: {
  titulo: string;
  ordem?: number;
  total?: number;
  projetos: Projeto[];
  etapasDoTipo: EtapaProjeto[];
  onAbrir: (id: string) => void;
  onChanged: () => void;
  destaque?: boolean;
}) {
  return (
    <div className={cn(
      'flex w-72 shrink-0 flex-col gap-2 rounded-lg border border-border bg-background/40 p-3',
      destaque && 'border-dashed border-muted-foreground/30',
    )}>
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
          Nenhum
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

function ListaProjetos({
  projetos, etapasPorTipo, onAbrir,
}: {
  projetos: Projeto[];
  etapasPorTipo: Record<string, EtapaProjeto[]>;
  onAbrir: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-5 py-3 font-medium">Projeto</th>
            <th className="px-4 py-3 font-medium">Cliente</th>
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 font-medium">Etapa</th>
            <th className="px-4 py-3 font-medium">Entrega</th>
            <th className="px-4 py-3 font-medium">Responsáveis</th>
          </tr>
        </thead>
        <tbody>
          {projetos.map((p) => {
            const etapas = etapasPorTipo[p.tipo ?? ''] ?? [];
            const idx = p.etapa ? etapas.findIndex((e) => e.nome === p.etapa) : -1;
            const resps = p.expand?.responsaveis ?? [];
            return (
              <tr
                key={p.id}
                onClick={() => onAbrir(p.id)}
                className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-secondary/50"
              >
                <td className="px-5 py-3 font-medium">{p.nome}</td>
                <td className="px-4 py-3 text-muted-foreground">{nomeCliente(p)}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.tipo || '—'}</td>
                <td className="px-4 py-3">
                  {p.etapa ? (
                    <Badge variant="default" className="text-[10px]">
                      {p.etapa}{etapas.length > 0 && idx >= 0 && ` (${idx + 1}/${etapas.length})`}
                    </Badge>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{dataBR(p.data_entrega) || '—'}</td>
                <td className="px-4 py-3">
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
