import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Search, Columns3 as TrelloIcon } from 'lucide-react';
import { listQuadros } from './quadrosService';
import type { Quadro } from './types';
import { logoUrl } from '@/clientes/clientesService';
import { corAvatar, inicial } from '@/clientes/format';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function nomeCliente(q: Quadro): string {
  return q.expand?.cliente?.nome_fantasia ?? q.expand?.cliente?.nome ?? '';
}

export function QuadrosListPage() {
  const history = useHistory();
  const [quadros, setQuadros] = useState<Quadro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    listQuadros()
      .then(setQuadros)
      .catch(() => { /* */ })
      .finally(() => setCarregando(false));
  }, []);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return quadros;
    return quadros.filter((q) =>
      q.nome.toLowerCase().includes(t) || nomeCliente(q).toLowerCase().includes(t));
  }, [quadros, busca]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar quadro ou cliente"
          className="h-9 w-full rounded-md border border-input bg-background/40 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        />
      </div>

      {carregando ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : filtrados.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <TrelloIcon className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum quadro encontrado.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtrados.map((q) => {
            const cli = q.expand?.cliente;
            const nome = nomeCliente(q);
            const logo = cli?.logo ? logoUrl(cli as never, '100x100') : '';
            return (
              <button
                key={q.id}
                onClick={() => history.push(`/quadros/${q.id}`)}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-secondary/40"
              >
                {logo ? (
                  <img src={logo} alt={nome} className="size-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className={cn('grid size-10 shrink-0 place-items-center rounded-lg text-sm font-bold text-white', corAvatar(nome || q.nome))}>
                    {inicial(nome || q.nome)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{q.nome}</p>
                  {nome && <p className="truncate text-xs text-muted-foreground">{nome}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
