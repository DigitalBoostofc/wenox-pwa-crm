import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, FolderKanban, ChevronDown, Check } from 'lucide-react';
import { getMembro, listProjetosMembro, atualizarMembro } from './equipeService';
import type { Usuario, ROLES } from '@/usuarios/types';
import type { Projeto } from '@/projetos/types';
import { useAuth } from '@/auth/useAuth';
import { canGerirUsuarios } from '@/auth/perms';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { corAvatar, inicial } from '@/clientes/format';
import { logoUrl } from '@/clientes/clientesService';
import { statusVariantParaTipo } from '@/projetos/format';
import { cn } from '@/lib/utils';

const ROLES_LIST: (typeof ROLES)[number][] = ['Owner', 'Admin', 'Gestor', 'Membro', 'Visualizador'];

function roleVariant(role?: string) {
  switch (role) {
    case 'Owner':  return 'default' as const;
    case 'Admin':  return 'warning' as const;
    case 'Gestor': return 'success' as const;
    default:       return 'muted' as const;
  }
}

function CardProjeto({ p, onClick }: { p: Projeto; onClick: () => void }) {
  const c = p.expand?.cliente;
  const cliNome = c ? ((c.nome ?? c.nome_fantasia) || '—') : '—';
  const logo = c?.logo ? logoUrl(c as never, '100x100') : '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
    >
      {logo ? (
        <img src={logo} alt={cliNome} className="size-8 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className={cn('grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white', corAvatar(cliNome))}>
          {inicial(cliNome)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{p.nome}</p>
        <p className="truncate text-xs text-muted-foreground">{cliNome}</p>
      </div>
      {p.status && (
        <Badge variant={statusVariantParaTipo(p.tipo, p.status)} className="shrink-0 text-[10px]">
          {p.status}
        </Badge>
      )}
    </div>
  );
}

export function MembroDetailPage({ id }: { id: string }) {
  const history = useHistory();
  const { user: meUser } = useAuth();
  const [membro, setMembro] = useState<Usuario | null>(null);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoRole, setSalvandoRole] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setCarregando(true);
    Promise.all([getMembro(id), listProjetosMembro(id)])
      .then(([m, ps]) => { setMembro(m); setProjetos(ps); })
      .catch(() => setErro('Não foi possível carregar o membro.'))
      .finally(() => setCarregando(false));
  }, [id]);

  async function trocarRole(novoRole: string) {
    if (!membro || membro.role === novoRole) return;
    setSalvandoRole(true);
    try {
      const atualizado = await atualizarMembro(membro.id, { role: novoRole as Usuario['role'] });
      setMembro(atualizado);
    } catch {
      setErro('Não foi possível alterar o papel.');
    } finally {
      setSalvandoRole(false);
    }
  }

  const podeGerirRoles = canGerirUsuarios(meUser?.role);

  if (carregando) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-8 w-32" />
        <Card className="p-6">
          <div className="flex gap-5">
            <Skeleton className="size-20 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (erro || !membro) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" onClick={() => history.push('/equipe')}>
          <ArrowLeft /> Equipe
        </Button>
        <p className="text-sm text-destructive">{erro || 'Membro não encontrado.'}</p>
      </div>
    );
  }

  const ativo = membro.status === 'Ativo';

  return (
    <div className="flex flex-col gap-5">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => history.push('/equipe')}
      >
        <ArrowLeft /> Equipe
      </Button>

      {/* Card principal */}
      <Card className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {/* Avatar */}
          <div className="relative shrink-0 self-center sm:self-start">
            <div className={cn(
              'grid size-20 place-items-center rounded-full text-2xl font-bold text-white',
              corAvatar(membro.nome ?? membro.email),
            )}>
              {inicial(membro.nome ?? membro.email)}
            </div>
            <span className={cn(
              'absolute bottom-1 right-1 size-4 rounded-full border-2 border-card',
              ativo ? 'bg-emerald-500' : 'bg-muted-foreground',
            )} />
          </div>

          {/* Info */}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold">{membro.nome}</h2>
                {membro.cargo && (
                  <p className="text-sm text-muted-foreground">{membro.cargo}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {membro.area && <Badge variant="muted">{membro.area}</Badge>}
                <Badge variant={roleVariant(membro.role)}>{membro.role}</Badge>
                <Badge variant={ativo ? 'success' : 'muted'}>{membro.status ?? 'Ativo'}</Badge>
              </div>
            </div>

            {/* Contatos */}
            <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Mail className="size-4 shrink-0" /> {membro.email}
              </span>
              {membro.telefone && (
                <span className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0" /> {membro.telefone}
                </span>
              )}
            </div>

            {/* Trocar papel — só Owner/Admin */}
            {podeGerirRoles && (
              <div className="flex items-center gap-3 pt-1">
                <span className="text-sm text-muted-foreground">Papel:</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      disabled={salvandoRole}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                    >
                      {membro.role}
                      <ChevronDown className="size-3 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Alterar papel</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {ROLES_LIST.map((r) => (
                      <DropdownMenuItem key={r} onSelect={() => trocarRole(r)}>
                        <Check className={cn('size-3.5', r === membro.role ? 'opacity-100' : 'opacity-0')} />
                        {r}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Projetos alocados */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FolderKanban className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">
            Projetos alocados
            {projetos.length > 0 && (
              <span className="ml-2 text-muted-foreground">({projetos.length})</span>
            )}
          </h3>
        </div>

        {projetos.length === 0 ? (
          <Card>
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Nenhum projeto alocado.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {projetos.map((p) => (
              <CardProjeto
                key={p.id}
                p={p}
                onClick={() => history.push(`/projetos/${p.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
