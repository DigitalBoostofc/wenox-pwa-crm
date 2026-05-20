import { useEffect, useMemo, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Plus, Search, Phone, Mail, Building2, ChevronRight, SlidersHorizontal,
  GripVertical,
} from 'lucide-react';
import { listClientes, logoUrl } from '@/clientes/clientesService';
import type { Cliente } from '@/clientes/types';
import { nomeExibicao, telefonePrincipal, emailPrincipal } from '@/clientes/types';
import { useAuth } from '@/auth/useAuth';
import { canCriarCliente } from '@/auth/perms';
import { cn } from '@/lib/utils';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { corAvatar, inicial, statusVariant, haDias, pillSelectedClass } from '@/clientes/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

type ColKey = 'telefone' | 'email' | 'origem' | 'servicos' | 'status' | 'desde';
/** Chave usada também pelo mapa de larguras (inclui 'cliente', que é a 1ª coluna). */
type LarguraKey = ColKey | 'cliente';
interface ColDef { key: ColKey; label: string; visivel: boolean }
const COLS_PADRAO: ColDef[] = [
  { key: 'telefone', label: 'Telefone', visivel: true },
  { key: 'email', label: 'E-mail', visivel: true },
  { key: 'origem', label: 'Origem', visivel: false },
  { key: 'servicos', label: 'Serviços', visivel: true },
  { key: 'status', label: 'Status', visivel: true },
  { key: 'desde', label: 'Cliente desde', visivel: true },
];
const COL_KEY = 'wenox-colunas-clientes-v2';
const LARGURA_KEY = 'wenox-larguras-clientes-v1';

type Larguras = Partial<Record<LarguraKey, number>>;
function carregarLarguras(): Larguras {
  try {
    const s = localStorage.getItem(LARGURA_KEY);
    return s ? (JSON.parse(s) as Larguras) : {};
  } catch {
    return {};
  }
}
function salvarLarguras(l: Larguras) {
  try { localStorage.setItem(LARGURA_KEY, JSON.stringify(l)); } catch { /* */ }
}

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
  } catch {
    return COLS_PADRAO;
  }
}
function salvarColunas(cols: ColDef[]) {
  try { localStorage.setItem(COL_KEY, JSON.stringify(cols)); } catch { /* */ }
}

type Ordenacao = 'az' | 'za' | 'recentes' | 'antigos';
const ORDENACOES: { v: Ordenacao; label: string }[] = [
  { v: 'az', label: 'Nome (A→Z)' },
  { v: 'za', label: 'Nome (Z→A)' },
  { v: 'recentes', label: 'Mais recentes' },
  { v: 'antigos', label: 'Mais antigos' },
];

function Avatar({ nome, src }: { nome: string; src?: string }) {
  if (src) {
    return (
      <img src={src} alt={nome} loading="lazy" decoding="async"
        width={40} height={40}
        className="size-10 shrink-0 rounded-xl object-cover" />
    );
  }
  return (
    <div className={cn('grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white', corAvatar(nome))}>
      {inicial(nome)}
    </div>
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
      className="absolute -right-0.5 top-0 z-10 h-full w-1.5 cursor-col-resize select-none hover:bg-primary/50"
    />
  );
}

function TagsServicos({ servicos }: { servicos?: string[] }) {
  if (!servicos || servicos.length === 0) return null;
  const visiveis = servicos.slice(0, 2);
  const resto = servicos.length - visiveis.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {visiveis.map((s) => (
        <Badge key={s} variant="muted">{s}</Badge>
      ))}
      {resto > 0 && <Badge variant="muted">+{resto}</Badge>}
    </div>
  );
}

export function ClientesListPage() {
  const history = useHistory();
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('Todos');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [colDefs, setColDefs] = useState<ColDef[]>(carregarColunas);
  const [larguras, setLarguras] = useState<Larguras>(carregarLarguras);
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('az');
  const [fOrigem, setFOrigem] = useState('Todas');
  const [fServico, setFServico] = useState('Todos');
  const seqRef = useRef(0);
  const dragIdx = useRef<number | null>(null);

  useEffect(() => {
    const seq = ++seqRef.current;
    const q = busca.trim();
    setCarregando(true);
    const timer = setTimeout(() => {
      listClientes(q)
        .then((res) => {
          if (seq !== seqRef.current) return;
          setClientes(res);
          setErro('');
        })
        .catch(() => {
          if (seq !== seqRef.current) return;
          setErro('Não foi possível carregar os clientes. Tente de novo.');
        })
        .finally(() => {
          if (seq === seqRef.current) setCarregando(false);
        });
    }, q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [busca]);

  /** Inicia o arraste de redimensionamento de uma coluna. */
  function iniciarResize(key: LarguraKey, thEl: HTMLElement, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const base = thEl.getBoundingClientRect().width;
    const startX = e.clientX;
    const MIN = 80;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    function onMove(ev: MouseEvent) {
      const nova = Math.max(MIN, Math.round(base + (ev.clientX - startX)));
      setLarguras((prev) => ({ ...prev, [key]: nova }));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setLarguras((prev) => { salvarLarguras(prev); return prev; });
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function toggleCol(k: ColKey) {
    setColDefs((cs) => {
      const next = cs.map((c) => (c.key === k ? { ...c, visivel: !c.visivel } : c));
      salvarColunas(next);
      return next;
    });
  }
  function moverCol(de: number, para: number) {
    setColDefs((cs) => {
      if (de === para || para < 0 || para >= cs.length) return cs;
      const next = [...cs];
      const [item] = next.splice(de, 1);
      next.splice(para, 0, item);
      salvarColunas(next);
      return next;
    });
  }

  const { statusPresentes, origensPresentes, servicosPresentes } = useMemo(() => ({
    statusPresentes: Array.from(
      new Set(clientes.map((c) => c.status).filter(Boolean)),
    ),
    origensPresentes: Array.from(
      new Set(clientes.map((c) => c.origem).filter(Boolean) as string[]),
    ),
    servicosPresentes: Array.from(
      new Set(clientes.flatMap((c) => c.servicos ?? [])),
    ),
  }), [clientes]);
  const filtros = useMemo(
    () => ['Todos', ...statusPresentes],
    [statusPresentes],
  );

  const visiveis = useMemo(() => clientes
    .filter((c) => filtro === 'Todos' || c.status === filtro)
    .filter((c) => fOrigem === 'Todas' || c.origem === fOrigem)
    .filter((c) => fServico === 'Todos' || (c.servicos ?? []).includes(fServico))
    .sort((a, b) => {
      if (ordenacao === 'recentes')
        return +new Date(b.created ?? 0) - +new Date(a.created ?? 0);
      if (ordenacao === 'antigos')
        return +new Date(a.created ?? 0) - +new Date(b.created ?? 0);
      const cmp = (a.nome_fantasia ?? '').localeCompare(
        b.nome_fantasia ?? '', 'pt-BR', { sensitivity: 'base' },
      );
      return ordenacao === 'za' ? -cmp : cmp;
    }),
    [clientes, filtro, fOrigem, fServico, ordenacao],
  );

  const colsVisiveis = useMemo(
    () => colDefs.filter((c) => c.visivel),
    [colDefs],
  );
  const selectCls =
    'h-10 rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

  function celula(c: Cliente, key: ColKey) {
    if (key === 'telefone') return telefonePrincipal(c) || '—';
    if (key === 'email') return emailPrincipal(c) || '—';
    if (key === 'origem') return c.origem || '—';
    if (key === 'servicos') return <TagsServicos servicos={c.servicos} />;
    if (key === 'status')
      return c.status ? <Badge variant={statusVariant(c.status)}>{c.status}</Badge> : null;
    return haDias(c.created);
  }

  return (
    <div className="flex max-w-7xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro e gestão de clientes da agência
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Buscar"
            aria-label="Buscar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          />
        </div>
        <select
          aria-label="Ordenar"
          value={ordenacao}
          onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
          className={selectCls}
        >
          {ORDENACOES.map((o) => (
            <option key={o.v} value={o.v}>{o.label}</option>
          ))}
        </select>
        {isDesktop && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <SlidersHorizontal /> Colunas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                Colunas — arraste para reordenar
              </DropdownMenuLabel>
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
                  <span className={cn('grid size-4 shrink-0 place-items-center rounded border text-[10px]', c.visivel ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                    {c.visivel ? '✓' : ''}
                  </span>
                  <span className="flex-1">{c.label}</span>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {canCriarCliente(user?.role) && (
          <Button onClick={() => history.push('/novo-cliente')}>
            <Plus /> Novo cliente
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filtros.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={cn(
              'rounded-full border px-3.5 py-1 text-sm transition-colors',
              filtro === f
                ? f === 'Todos'
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : pillSelectedClass(f)
                : 'border-border text-muted-foreground hover:bg-secondary',
            )}
          >
            {f}
          </button>
        ))}
        {origensPresentes.length > 0 && (
          <select
            aria-label="Filtrar por origem"
            value={fOrigem}
            onChange={(e) => setFOrigem(e.target.value)}
            className={selectCls}
          >
            <option value="Todas">Origem: todas</option>
            {origensPresentes.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        )}
        {servicosPresentes.length > 0 && (
          <select
            aria-label="Filtrar por serviço"
            value={fServico}
            onChange={(e) => setFServico(e.target.value)}
            className={selectCls}
          >
            <option value="Todos">Serviço: todos</option>
            {servicosPresentes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {erro}
        </p>
      )}

      {carregando && clientes.length === 0 ? (
        <Card className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </Card>
      ) : visiveis.length === 0 ? (
        <Card>
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado.
          </p>
        </Card>
      ) : isDesktop ? (
        /* ---------- DESKTOP: tabela ---------- */
        <Card className="overflow-hidden">
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th
                  className="relative px-5 py-3 font-medium"
                  style={larguras.cliente ? { width: larguras.cliente } : undefined}
                >
                  Cliente
                  <ResizeHandle onMouseDown={(e) => iniciarResize('cliente', e.currentTarget.parentElement!, e)} />
                </th>
                {colsVisiveis.map((col) => (
                  <th
                    key={col.key}
                    className="relative px-4 py-3 font-medium"
                    style={larguras[col.key] ? { width: larguras[col.key] } : undefined}
                  >
                    {col.label}
                    <ResizeHandle onMouseDown={(e) => iniciarResize(col.key, e.currentTarget.parentElement!, e)} />
                  </th>
                ))}
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => {
                const nome = nomeExibicao(c);
                return (
                <tr
                  key={c.id}
                  onClick={() => history.push(`/clientes/${c.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-secondary/50"
                >
                  <td className="overflow-hidden px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar nome={nome} src={logoUrl(c, '100x100')} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{nome}</p>
                        <p className="text-xs text-muted-foreground">{c.categoria}</p>
                      </div>
                    </div>
                  </td>
                  {colsVisiveis.map((col) => (
                    <td key={col.key} className="overflow-hidden truncate px-4 py-3 text-muted-foreground">
                      {celula(c, col.key)}
                    </td>
                  ))}
                  <td className="w-10 px-4 py-3 text-right text-muted-foreground">
                    <ChevronRight className="ml-auto size-4" />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        /* ---------- MOBILE: cards ---------- */
        <div className="flex flex-col gap-3">
          {visiveis.map((c) => {
            const nome = nomeExibicao(c);
            const tel = telefonePrincipal(c);
            const em = emailPrincipal(c);
            return (
            <button
              key={c.id}
              onClick={() => history.push(`/clientes/${c.id}`)}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
            >
              <Avatar nome={nome} src={logoUrl(c, '100x100')} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-semibold">{nome}</p>
                  <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">{c.categoria}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {tel && <span className="flex items-center gap-1"><Phone className="size-3" />{tel}</span>}
                  {em && <span className="flex items-center gap-1"><Mail className="size-3" />{em}</span>}
                </p>
                <TagsServicos servicos={c.servicos} />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {c.status && <Badge variant={statusVariant(c.status)}>{c.status}</Badge>}
                <span className="text-[11px] text-muted-foreground">{haDias(c.created)}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
