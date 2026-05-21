import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Search, UserPlus } from 'lucide-react';
import { listMembros } from './equipeService';
import type { Usuario } from '@/usuarios/types';
import { fotoUrl } from '@/usuarios/usuariosService';
import { listOpcoes } from '@/opcoes/opcoesService';
import { useAuth } from '@/auth/useAuth';
import { canGerirUsuarios } from '@/auth/perms';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { corAvatar, inicial } from '@/clientes/format';
import { cn } from '@/lib/utils';
import { HeaderSlot } from '@/components/layout/HeaderSlot';

function roleVariant(role?: string) {
  switch (role) {
    case 'Owner':      return 'default' as const;
    case 'Admin':      return 'warning' as const;
    case 'Gestor':     return 'success' as const;
    default:           return 'muted' as const;
  }
}

function CardMembro({ m, onClick }: { m: Usuario; onClick: () => void }) {
  const ativo = m.status === 'Ativo';
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className="group flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center transition-all hover:border-primary/40"
    >
      {/* Avatar */}
      <div className="relative">
        <div className={cn(
          'grid size-14 place-items-center overflow-hidden rounded-full text-lg font-bold text-white',
          !m.foto && corAvatar(m.nome ?? m.email),
        )}>
          {m.foto ? (
            <img
              src={fotoUrl(m, '120x120')}
              alt={m.nome}
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          ) : (
            inicial(m.nome ?? m.email)
          )}
        </div>
        <span className={cn(
          'absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-card',
          ativo ? 'bg-emerald-500' : 'bg-muted-foreground',
        )} />
      </div>

      {/* Info */}
      <div className="min-w-0 w-full">
        <p className="truncate font-semibold">{m.nome}</p>
        {m.cargo && (
          <p className="truncate text-sm text-muted-foreground">{m.cargo}</p>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap justify-center gap-1.5">
        {m.area && <Badge variant="muted" className="text-[10px]">{m.area}</Badge>}
        <Badge variant={roleVariant(m.role)} className="text-[10px]">{m.role}</Badge>
      </div>
    </div>
  );
}

export function EquipePage() {
  const history = useHistory();
  const { user } = useAuth();
  const [membros, setMembros] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [areaFiltro, setAreaFiltro] = useState('Todos');
  const [funcoes, setFuncoes] = useState<string[]>([]);

  useEffect(() => {
    listMembros()
      .then(setMembros)
      .finally(() => setCarregando(false));
    listOpcoes('tipo_projeto').then((o) => setFuncoes(o.map((x) => x.valor)));
  }, []);

  const filtrados = useMemo(() => {
    return membros.filter((m) => {
      if (areaFiltro !== 'Todos' && m.area !== areaFiltro) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        return (
          (m.nome ?? '').toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.cargo ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [membros, busca, areaFiltro]);

  const areas = useMemo(() => ['Todos', ...funcoes], [funcoes]);

  return (
    <>
      <HeaderSlot>
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Buscar membro"
            aria-label="Buscar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          />
        </div>
        {canGerirUsuarios(user?.role) && (
          <Button onClick={() => history.push('/usuarios')}>
            <UserPlus /> Convidar
          </Button>
        )}
      </HeaderSlot>

      <div className="flex flex-col gap-5">
        {/* Pills de área */}
        <div className="flex flex-wrap gap-2">
          {areas.map((a) => (
            <button
              key={a}
              onClick={() => setAreaFiltro(a)}
              className={cn(
                'rounded-full border px-3.5 py-1 text-sm transition-colors',
                areaFiltro === a
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground hover:bg-secondary',
              )}
            >
              {a}
            </button>
          ))}
        </div>

        {carregando ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-5">
                <div className="flex flex-col items-center gap-3">
                  <Skeleton className="size-14 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </Card>
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <Card>
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              {membros.length === 0 ? 'Nenhum membro cadastrado.' : 'Nenhum membro neste filtro.'}
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtrados.map((m) => (
              <CardMembro
                key={m.id}
                m={m}
                onClick={() => history.push(`/equipe/${m.id}`)}
              />
            ))}
          </div>
        )}

        {!carregando && filtrados.length > 0 && (
          <p className="pt-1 text-right text-xs text-muted-foreground">
            {filtrados.length} {filtrados.length === 1 ? 'membro' : 'membros'}
          </p>
        )}
      </div>
    </>
  );
}
