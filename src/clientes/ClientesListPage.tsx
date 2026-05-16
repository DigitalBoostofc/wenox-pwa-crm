import { useEffect, useState, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { Plus, Search, Phone } from 'lucide-react';
import { listClientes } from '@/clientes/clientesService';
import type { Cliente } from '@/clientes/types';
import { useAuth } from '@/auth/useAuth';
import { canCriarCliente } from '@/auth/perms';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ClientesListPage() {
  const history = useHistory();
  const { user } = useAuth();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('Todos');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  // sequencia: só aplica a resposta mais recente (evita "clientes sumindo"
  // por respostas fora de ordem com autoCancellation desligado)
  const seqRef = useRef(0);

  useEffect(() => {
    const seq = ++seqRef.current;
    const q = busca.trim();
    setCarregando(true);
    const timer = setTimeout(
      () => {
        listClientes(q)
          .then((res) => {
            if (seq !== seqRef.current) return; // resposta obsoleta: ignora
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
      },
      q ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [busca]);

  const statusPresentes = Array.from(
    new Set(clientes.map((c) => c.status).filter(Boolean)),
  );
  const filtros = ['Todos', ...statusPresentes];
  const visiveis = clientes.filter(
    (c) => filtro === 'Todos' || c.status === filtro,
  );

  return (
    <div className="flex flex-col gap-5">
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

      <Card className="divide-y divide-border">
        {carregando && clientes.length === 0 &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        {!carregando && visiveis.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado.
          </p>
        )}
        {visiveis.map((c) => (
          <button
            key={c.id}
            onClick={() => history.push(`/clientes/${c.id}`)}
            className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/60"
          >
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-sm font-bold text-primary">
              {(c.nome_fantasia ?? '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.nome_fantasia}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="size-3.5" /> {c.telefone}
              </p>
            </div>
            {c.status && <Badge variant="muted">{c.status}</Badge>}
          </button>
        ))}
      </Card>
    </div>
  );
}
