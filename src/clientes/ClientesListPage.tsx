import { useEffect, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Plus, Search, Phone, Mail, Building2, ChevronRight, SlidersHorizontal,
} from 'lucide-react';
import { listClientes } from '@/clientes/clientesService';
import type { Cliente } from '@/clientes/types';
import { useAuth } from '@/auth/useAuth';
import { canCriarCliente } from '@/auth/perms';
import { cn } from '@/lib/utils';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { corAvatar, inicial, statusVariant, haDias } from '@/clientes/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

type ColKey = 'telefone' | 'email' | 'origem' | 'servicos' | 'status' | 'desde';
const COLUNAS: { key: ColKey; label: string }[] = [
  { key: 'telefone', label: 'Telefone' },
  { key: 'email', label: 'E-mail' },
  { key: 'origem', label: 'Origem' },
  { key: 'servicos', label: 'Serviços' },
  { key: 'status', label: 'Status' },
  { key: 'desde', label: 'Cliente desde' },
];
const COL_KEY = 'wenox-colunas-clientes';

function carregarColunas(): Record<ColKey, boolean> {
  const padrao = { telefone: true, email: true, origem: false, servicos: true, status: true, desde: true };
  try {
    const s = localStorage.getItem(COL_KEY);
    return s ? { ...padrao, ...JSON.parse(s) } : padrao;
  } catch {
    return padrao;
  }
}

function Avatar({ nome }: { nome: string }) {
  return (
    <div className={cn('grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white', corAvatar(nome))}>
      {inicial(nome)}
    </div>
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
  const [cols, setCols] = useState<Record<ColKey, boolean>>(carregarColunas);
  const seqRef = useRef(0);

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

  function toggleCol(k: ColKey) {
    setCols((c) => {
      const next = { ...c, [k]: !c[k] };
      try { localStorage.setItem(COL_KEY, JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  }

  const statusPresentes = Array.from(
    new Set(clientes.map((c) => c.status).filter(Boolean)),
  );
  const filtros = ['Todos', ...statusPresentes];
  const visiveis = clientes.filter(
    (c) => filtro === 'Todos' || c.status === filtro,
  );

  return (
    <div className="flex flex-col gap-5">
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
        {isDesktop && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <SlidersHorizontal /> Colunas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUNAS.map((c) => (
                <DropdownMenuItem
                  key={c.key}
                  onSelect={(e) => { e.preventDefault(); toggleCol(c.key); }}
                >
                  <span className={cn('grid size-4 place-items-center rounded border', cols[c.key] ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                    {cols[c.key] ? '✓' : ''}
                  </span>
                  {c.label}
                </DropdownMenuItem>
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

      <div className="flex flex-wrap gap-2">
        {filtros.map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={cn(
              'rounded-full border px-3.5 py-1 text-sm transition-colors',
              filtro === f
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Cliente</th>
                {cols.telefone && <th className="px-4 py-3 font-medium">Telefone</th>}
                {cols.email && <th className="px-4 py-3 font-medium">E-mail</th>}
                {cols.origem && <th className="px-4 py-3 font-medium">Origem</th>}
                {cols.servicos && <th className="px-4 py-3 font-medium">Serviços</th>}
                {cols.status && <th className="px-4 py-3 font-medium">Status</th>}
                {cols.desde && <th className="px-4 py-3 font-medium">Cliente desde</th>}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visiveis.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => history.push(`/clientes/${c.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-secondary/50"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar nome={c.nome_fantasia} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.nome_fantasia}</p>
                        <p className="text-xs text-muted-foreground">{c.categoria}</p>
                      </div>
                    </div>
                  </td>
                  {cols.telefone && <td className="px-4 py-3 text-muted-foreground">{c.telefone}</td>}
                  {cols.email && <td className="px-4 py-3 text-muted-foreground">{c.email || '—'}</td>}
                  {cols.origem && <td className="px-4 py-3 text-muted-foreground">{c.origem || '—'}</td>}
                  {cols.servicos && <td className="px-4 py-3"><TagsServicos servicos={c.servicos} /></td>}
                  {cols.status && (
                    <td className="px-4 py-3">
                      {c.status && <Badge variant={statusVariant(c.status)}>{c.status}</Badge>}
                    </td>
                  )}
                  {cols.desde && <td className="px-4 py-3 text-muted-foreground">{haDias(c.created)}</td>}
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    <ChevronRight className="ml-auto size-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        /* ---------- MOBILE: cards ---------- */
        <div className="flex flex-col gap-3">
          {visiveis.map((c) => (
            <button
              key={c.id}
              onClick={() => history.push(`/clientes/${c.id}`)}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
            >
              <Avatar nome={c.nome_fantasia} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-semibold">{c.nome_fantasia}</p>
                  <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">{c.categoria}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Phone className="size-3" />{c.telefone}</span>
                  {c.email && <span className="flex items-center gap-1"><Mail className="size-3" />{c.email}</span>}
                </p>
                <TagsServicos servicos={c.servicos} />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                {c.status && <Badge variant={statusVariant(c.status)}>{c.status}</Badge>}
                <span className="text-[11px] text-muted-foreground">{haDias(c.created)}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
