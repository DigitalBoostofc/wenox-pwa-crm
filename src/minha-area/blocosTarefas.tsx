import { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useDadosAgencia } from '@/dashboard/useDadosAgencia';
import { useAuth } from '@/auth/useAuth';
import { tarefaConcluida, prazoVencido, prazoBR, statusTarefaClass, prazoLimite } from '@/tarefas/format';
import {
  tarefaEmEquipe, ehVezDoUsuario, aguardandoAprovacaoCliente, vezLabel,
} from '@/tarefas/etapas';
import type { Tarefa } from '@/tarefas/types';
import { TarefaViewSheet } from '@/tarefas/TarefaViewSheet';
import { TarefaSheet } from '@/tarefas/TarefaSheet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function pesoPrioridade(p?: string): number {
  if (p === 'alta') return 0;
  if (p === 'baixa') return 2;
  return 1;
}

function ordenarPorPrioridade(arr: Tarefa[]): Tarefa[] {
  return [...arr].sort((a, b) => {
    const dp = pesoPrioridade(a.prioridade) - pesoPrioridade(b.prioridade);
    if (dp !== 0) return dp;
    const pa = prazoLimite(a.prazo)?.getTime() ?? Infinity;
    const pb = prazoLimite(b.prazo)?.getTime() ?? Infinity;
    return pa - pb;
  });
}

function ordenarPorData(arr: Tarefa[]): Tarefa[] {
  return [...arr].sort((a, b) => {
    const pa = prazoLimite(a.prazo)?.getTime() ?? Infinity;
    const pb = prazoLimite(b.prazo)?.getTime() ?? Infinity;
    return pa - pb;
  });
}

function contexto(t: Tarefa): string {
  return (
    t.expand?.projeto?.nome
    ?? t.expand?.cliente?.nome_fantasia
    ?? t.expand?.cliente?.nome
    ?? ''
  );
}

function nomeDe(t: Tarefa): (id: string) => string {
  return (id: string) => {
    const r = (t.expand?.responsaveis ?? []).find((u) => u.id === id);
    return r?.nome ?? r?.email ?? id;
  };
}

/* -------------------------------------------------------------------------- */
/*  Linha de tarefa reutilizável                                              */
/* -------------------------------------------------------------------------- */

function LinhaTarefa({
  t, onClick, extra,
}: {
  t: Tarefa;
  onClick: () => void;
  extra?: React.ReactNode;
}) {
  const vencida = prazoVencido(t.prazo, t.status);
  const ctx = contexto(t);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
    >
      {t.prioridade === 'alta' && (
        <ArrowUp className="size-3.5 shrink-0 text-orange-500" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{t.nome}</p>
        {ctx && <p className="truncate text-xs text-muted-foreground">{ctx}</p>}
      </div>
      {t.status && (
        <Badge className={cn('shrink-0 border text-[10px]', statusTarefaClass(t.status))}>
          {t.status}
        </Badge>
      )}
      {t.prazo && (
        <span className={cn(
          'shrink-0 text-[11px]',
          vencida ? 'font-medium text-destructive' : 'text-muted-foreground',
        )}>
          {prazoBR(t.prazo)}
        </span>
      )}
      {extra}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  A) MinhasTarefasBloco                                                     */
/* -------------------------------------------------------------------------- */

export function MinhasTarefasBloco({ somenteLeitura }: { somenteLeitura?: boolean }) {
  const { tarefas, carregando, refresh } = useDadosAgencia();
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const [viewId, setViewId] = useState<string | null>(null);

  if (carregando) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Minhas Tarefas em aberto</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const minhas = tarefas.filter(
    (t) =>
      (t.responsaveis ?? []).includes(uid) &&
      !tarefaConcluida(t.status) &&
      !tarefaEmEquipe(t),
  );

  const porPrioridade = ordenarPorPrioridade(minhas);
  const porData = ordenarPorData(minhas);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Minhas Tarefas em aberto</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="border-b border-border px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">Por prioridade</span>
          </div>
          {porPrioridade.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma tarefa.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {porPrioridade.map((t) => (
                <LinhaTarefa key={t.id} t={t} onClick={() => setViewId(t.id)} />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="border-b border-border px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">Por data</span>
          </div>
          {porData.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma tarefa.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {porData.map((t) => (
                <LinhaTarefa key={t.id} t={t} onClick={() => setViewId(t.id)} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <TarefaViewSheet
        tarefaId={viewId}
        aberto={viewId !== null}
        onClose={() => setViewId(null)}
        onMudou={() => refresh()}
        somenteLeitura={somenteLeitura}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  B) TarefasEquipeBloco                                                     */
/* -------------------------------------------------------------------------- */

export function TarefasEquipeBloco({ somenteLeitura }: { somenteLeitura?: boolean }) {
  const { tarefas, carregando, refresh } = useDadosAgencia();
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  if (carregando) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Tarefas em Equipe</h2>
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const equipe = tarefas.filter(
    (t) =>
      (t.responsaveis ?? []).includes(uid) &&
      tarefaEmEquipe(t) &&
      !tarefaConcluida(t.status),
  );

  equipe.sort((a, b) => {
    const va = ehVezDoUsuario(a, uid) ? 0 : 1;
    const vb = ehVezDoUsuario(b, uid) ? 0 : 1;
    if (va !== vb) return va - vb;
    const pa = prazoLimite(a.prazo)?.getTime() ?? Infinity;
    const pb = prazoLimite(b.prazo)?.getTime() ?? Infinity;
    return pa - pb;
  });

  function tagEtapa(t: Tarefa) {
    if (ehVezDoUsuario(t, uid)) {
      return (
        <Badge className="shrink-0 border border-orange-500/50 bg-orange-500/15 text-[10px] text-orange-500">
          Concluir etapa
        </Badge>
      );
    }
    if (aguardandoAprovacaoCliente(t)) {
      return (
        <Badge className="shrink-0 border border-yellow-500/50 bg-yellow-500/15 text-[10px] text-yellow-500">
          Aguardando cliente
        </Badge>
      );
    }
    return (
      <Badge className="shrink-0 border border-amber-700/50 bg-amber-700/15 text-[10px] text-amber-600">
        Aguardando equipe
      </Badge>
    );
  }

  function handleClick(t: Tarefa) {
    if (ehVezDoUsuario(t, uid)) {
      setEditId(t.id);
    } else {
      setViewId(t.id);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Tarefas em Equipe</h2>

      {equipe.length === 0 ? (
        <Card>
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Você não tem tarefas em equipe.
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-border/40">
          {equipe.map((t) => {
            const label = vezLabel(t, nomeDe(t));
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleClick(t)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {contexto(t)}{label ? ` · ${label}` : ''}
                  </p>
                </div>
                {tagEtapa(t)}
              </button>
            );
          })}
        </Card>
      )}

      <TarefaSheet
        tarefaId={editId}
        aberto={editId !== null}
        onClose={() => setEditId(null)}
        onMudou={() => refresh()}
      />
      <TarefaViewSheet
        tarefaId={viewId}
        aberto={viewId !== null}
        onClose={() => setViewId(null)}
        onMudou={() => refresh()}
        somenteLeitura={somenteLeitura}
      />
    </div>
  );
}
