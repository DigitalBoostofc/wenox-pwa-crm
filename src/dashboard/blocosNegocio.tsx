import { useHistory } from 'react-router-dom';
import {
  Users, FolderKanban,
} from 'lucide-react';
import { useDadosAgencia } from './useDadosAgencia';
import { tarefaConcluida, prazoVencido } from '@/tarefas/format';
import { temEtapas, etapaAtual, prazoVencidoEfetivo } from '@/tarefas/etapas';
import { inicial, corAvatar } from '@/clientes/format';
import { logoUrl } from '@/clientes/clientesService';
import { AvatarMembro } from './AvatarMembro';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Saúde dos Projetos                                                        */
/* -------------------------------------------------------------------------- */

interface ClienteLogo {
  id: string;
  collectionId?: string;
  collectionName?: string;
  nome?: string;
  nome_fantasia?: string;
  logo?: string;
}

interface LinhaProjeto {
  id: string;
  projetoNome: string;
  clienteNome: string;
  cli?: ClienteLogo;
  abertas: number;
  atrasadas: number;
}

export function SaudeProjetosBloco() {
  const history = useHistory();
  const { tarefas, projetos, carregando } = useDadosAgencia();

  if (carregando) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Saúde dos Projetos</h2>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const ativos = projetos.filter((p) => p.status && p.status !== 'Inativo');

  const linhas: LinhaProjeto[] = ativos.map((p) => {
    const doProj = tarefas.filter(
      (t) => t.expand?.projeto?.id === p.id || t.projeto === p.id,
    );
    const abertas = doProj.filter((t) => !tarefaConcluida(t.status));
    const atrasadas = abertas.filter((t) => prazoVencido(t.prazo, t.status));
    const cli = p.expand?.cliente;
    const clienteNome = cli?.nome_fantasia ?? cli?.nome ?? 'Sem cliente';
    return {
      id: p.id,
      projetoNome: p.nome,
      clienteNome,
      cli,
      abertas: abertas.length,
      atrasadas: atrasadas.length,
    };
  }).filter((l) => l.abertas > 0);

  linhas.sort((a, b) => {
    if (b.atrasadas !== a.atrasadas) return b.atrasadas - a.atrasadas;
    return b.abertas - a.abertas;
  });

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Saúde dos Projetos</h2>

      {linhas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <FolderKanban className="size-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum projeto ativo com tarefas abertas.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-border/40">
          {linhas.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => history.push(`/projetos/${l.id}`)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
            >
              {l.cli?.logo ? (
                <img
                  src={logoUrl(l.cli as never, '100x100')}
                  alt={l.clienteNome}
                  loading="lazy"
                  decoding="async"
                  className="size-9 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className={cn('grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold text-white', corAvatar(l.clienteNome))}>
                  {inicial(l.clienteNome)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.clienteNome}</p>
                <p className="truncate text-xs text-muted-foreground">{l.projetoNome}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {l.abertas} abertas
              </span>
              {l.atrasadas > 0 && (
                <Badge className="shrink-0 border border-destructive/50 bg-destructive/15 text-[10px] text-destructive">
                  {l.atrasadas} atrasada{l.atrasadas !== 1 ? 's' : ''}
                </Badge>
              )}
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pulso da Equipe                                                           */
/* -------------------------------------------------------------------------- */

interface LinhaEquipe {
  id: string;
  nome: string;
  foto?: string;
  collectionId?: string;
  collectionName?: string;
  abertas: number;
  atrasadas: number;
}

export function PulsoEquipeBloco() {
  const history = useHistory();
  const { tarefas, usuarios, carregando } = useDadosAgencia();

  if (carregando) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Pulso da Equipe</h2>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const equipe = usuarios.filter(
    (u) => u.role !== 'Cliente' && u.status === 'Ativo',
  );

  const linhas: LinhaEquipe[] = equipe
    .map((u) => {
      const abertas = tarefas.filter(
        (t) => !tarefaConcluida(t.status) && (t.responsaveis ?? []).includes(u.id),
      );
      const atrasadas = abertas.filter((t) => {
        if (!prazoVencidoEfetivo(t)) return false;
        if (temEtapas(t)) return etapaAtual(t.etapas)?.responsavel === u.id;
        return true;
      }).length;
      return {
        id: u.id,
        nome: u.nome ?? u.email ?? u.id,
        foto: u.foto,
        collectionId: u.collectionId,
        collectionName: u.collectionName,
        abertas: abertas.length,
        atrasadas,
      };
    })
    .filter((l) => l.abertas > 0);

  linhas.sort((a, b) => {
    if (b.atrasadas !== a.atrasadas) return b.atrasadas - a.atrasadas;
    return b.abertas - a.abertas;
  });

  const semResponsavel = tarefas.filter(
    (t) =>
      !tarefaConcluida(t.status) &&
      (t.responsaveis ?? []).length === 0 &&
      t.lado !== 'cliente',
  ).length;

  function irParaTarefas() {
    try { localStorage.setItem('wenox-tarefas-agrupar-v1', 'responsavel'); } catch { /* */ }
    history.push('/tarefas');
  }

  // Clica num membro → página de Tarefas filtrada por ele, só as não concluídas.
  function irParaMembro(id: string, nome: string) {
    history.push(`/tarefas?responsavel=${id}&nome=${encodeURIComponent(nome)}&abertas=1`);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <h2 className="text-lg font-semibold">Pulso da Equipe</h2>

      {linhas.length === 0 && semResponsavel === 0 ? (
        <Card className="flex-1">
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <Users className="size-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Ninguém tem tarefas abertas.</p>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-1 flex-col divide-y divide-border/40">
          {linhas.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => irParaMembro(l.id, l.nome)}
              className="flex w-full flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
            >
              <AvatarMembro membro={l} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.nome}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{l.abertas} abertas</span>
              {l.atrasadas > 0 && (
                <Badge className="shrink-0 border border-destructive/50 bg-destructive/15 text-[10px] text-destructive">
                  {l.atrasadas} atrasada{l.atrasadas !== 1 ? 's' : ''}
                </Badge>
              )}
            </button>
          ))}

          {semResponsavel > 0 && (
            <button
              type="button"
              onClick={irParaTarefas}
              className="flex w-full flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
            >
              <div className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-border bg-secondary text-xs text-muted-foreground">
                ⚠
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
                Sem responsável
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{semResponsavel} abertas</span>
            </button>
          )}
        </Card>
      )}
    </div>
  );
}
