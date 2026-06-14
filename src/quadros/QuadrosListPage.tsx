import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Search, Columns3 as TrelloIcon } from 'lucide-react';
import { listQuadros } from './quadrosService';
import type { Quadro } from './types';
import { fundoStyle } from './types';
import { logoUrl } from '@/clientes/clientesService';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtrados.map((q) => {
            const cli = q.expand?.cliente;
            const nome = nomeCliente(q);
            const logo = cli?.logo ? logoUrl(cli as never, '100x100') : '';
            return (
              <button
                key={q.id}
                onClick={() => history.push(`/quadros/${q.id}`)}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <div
                  style={fundoStyle(q)}
                  className="relative flex aspect-[16/9] w-full items-end p-3"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  {logo && (
                    <img src={logo} alt="" className="absolute right-2 top-2 size-7 rounded-md object-cover ring-1 ring-white/30" />
                  )}
                  <span className="relative line-clamp-2 text-sm font-semibold text-white drop-shadow">
                    {q.nome}
                  </span>
                </div>
                {nome && (
                  <span className="truncate px-3 py-2 text-xs text-muted-foreground">{nome}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
