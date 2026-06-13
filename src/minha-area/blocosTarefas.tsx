import { useState } from 'react';
import { useDadosAgencia } from '@/dashboard/useDadosAgencia';
import { useAuth } from '@/auth/useAuth';
import { tarefaConcluida, prazoVencido, prazoBR, prazoLimite } from '@/tarefas/format';
import {
  temEtapas, tarefaEmEquipe, ehVezDoUsuario, aguardandoAprovacaoCliente, vezLabel,
} from '@/tarefas/etapas';
import type { Tarefa } from '@/tarefas/types';
import { TarefaViewSheet } from '@/tarefas/TarefaViewSheet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Helpers de ordenação / contexto                                           */
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
/*  Etiquetas                                                                  */
/* -------------------------------------------------------------------------- */

function BadgePrazo({ t }: { t: Tarefa }) {
  if (prazoVencido(t.prazo, t.status)) {
    return (
      <Badge className="shrink-0 animate-pulse border border-destructive/60 bg-destructive/20 text-[10px] text-destructive">
        Atrasada
      </Badge>
    );
  }
  return (
    <Badge className="shrink-0 border border-emerald-500/50 bg-emerald-500/15 text-[10px] text-emerald-500">
      No prazo
    </Badge>
  );
}

function BadgePrioridade({ t }: { t: Tarefa }) {
  const p = t.prioridade ?? 'media';
  if (p === 'alta') {
    return (
      <Badge className="shrink-0 animate-pulse border border-red-500/60 bg-red-500/20 text-[10px] text-red-500">
        Alta
      </Badge>
    );
  }
  if (p === 'baixa') {
    return (
      <Badge className="shrink-0 border border-sky-500/50 bg-sky-500/15 text-[10px] text-sky-400">
        Baixa
      </Badge>
    );
  }
  return (
    <Badge className="shrink-0 border border-amber-500/50 bg-amber-500/15 text-[10px] text-amber-400">
      Média
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/*  Linha de tarefa (badge customizável)                                      */
/* -------------------------------------------------------------------------- */

function LinhaTarefa({ t, onClick, badge }: { t: Tarefa; onClick: () => void; badge: React.ReactNode }) {
  const vencida = prazoVencido(t.prazo, t.status);
  const ctx = contexto(t);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{t.nome}</p>
        {ctx && <p className="truncate text-xs text-muted-foreground">{ctx}</p>}
      </div>
      {badge}
      {t.prazo && (
        <span className={cn(
          'shrink-0 text-[11px]',
          vencida ? 'font-medium text-destructive' : 'text-muted-foreground',
        )}>
          {prazoBR(t.prazo)}
        </span>
      )}
    </button>
  );
}

/** Altura fixa ≈ 5 linhas; passa disso, rola dentro do próprio card. */
const ALTURA_LISTA = 'h-[19rem]';

/** Scroll fino e discreto, na cor do tema (thumb suave, trilho transparente). */
const SCROLL_CLEAN =
  '[scrollbar-width:thin] '
  + '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent '
  + '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border '
  + 'hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40';

function CardLista({ titulo, vazio, children }: { titulo: string; vazio: boolean; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col">
      <div className="border-b border-border px-4 py-2.5">
        <span className="text-xs font-medium text-muted-foreground">{titulo}</span>
      </div>
      {vazio ? (
        <div className={cn('flex items-center justify-center px-4 text-center text-sm text-muted-foreground', ALTURA_LISTA)}>
          Nenhuma tarefa.
        </div>
      ) : (
        <div className={cn('divide-y divide-border/40 overflow-y-auto', ALTURA_LISTA, SCROLL_CLEAN)}>
          {children}
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Minhas Tarefas — 3 cards (Por data | Por prioridade | Tarefas em Equipe)  */
/* -------------------------------------------------------------------------- */

export function MinhasTarefasBloco({ somenteLeitura }: { somenteLeitura?: boolean }) {
  const { tarefas, carregando, refresh } = useDadosAgencia();
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const [viewId, setViewId] = useState<string | null>(null);

  if (carregando) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    );
  }

  const individuais = tarefas.filter(
    (t) => (t.responsaveis ?? []).includes(uid) && !tarefaConcluida(t.status) && !tarefaEmEquipe(t),
  );
  const porData = ordenarPorData(individuais);
  const porPrioridade = ordenarPorPrioridade(individuais);

  const equipe = tarefas
    .filter((t) => (t.responsaveis ?? []).includes(uid) && tarefaEmEquipe(t) && !tarefaConcluida(t.status))
    .sort((a, b) => {
      const va = ehVezDoUsuario(a, uid) ? 0 : 1;
      const vb = ehVezDoUsuario(b, uid) ? 0 : 1;
      if (va !== vb) return va - vb;
      return (prazoLimite(a.prazo)?.getTime() ?? Infinity) - (prazoLimite(b.prazo)?.getTime() ?? Infinity);
    });

  function tagEquipe(t: Tarefa) {
    if (!temEtapas(t)) {
      return <Badge className="shrink-0 border border-border bg-secondary text-[10px] text-muted-foreground">Em equipe</Badge>;
    }
    if (ehVezDoUsuario(t, uid)) {
      return <Badge className="shrink-0 animate-pulse border border-orange-500/50 bg-orange-500/15 text-[10px] text-orange-500">Concluir Etapa</Badge>;
    }
    if (aguardandoAprovacaoCliente(t)) {
      return <Badge className="shrink-0 border border-yellow-500/50 bg-yellow-500/15 text-[10px] text-yellow-500">Aguardando Cliente</Badge>;
    }
    return <Badge className="shrink-0 border border-amber-700/50 bg-amber-700/15 text-[10px] text-amber-600">Aguardando Equipe</Badge>;
  }

  function abrirEquipe(t: Tarefa) {
    setViewId(t.id);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Por data */}
        <CardLista titulo="Por data" vazio={porData.length === 0}>
          {porData.map((t) => (
            <LinhaTarefa key={t.id} t={t} onClick={() => setViewId(t.id)} badge={<BadgePrazo t={t} />} />
          ))}
        </CardLista>

        {/* Por prioridade */}
        <CardLista titulo="Por prioridade" vazio={porPrioridade.length === 0}>
          {porPrioridade.map((t) => (
            <LinhaTarefa key={t.id} t={t} onClick={() => setViewId(t.id)} badge={<BadgePrioridade t={t} />} />
          ))}
        </CardLista>

        {/* Tarefas em Equipe */}
        <CardLista titulo="Tarefas em Equipe" vazio={equipe.length === 0}>
          {equipe.map((t) => {
            const label = vezLabel(t, nomeDe(t));
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => abrirEquipe(t)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {contexto(t)}{label ? ` · ${label}` : ''}
                  </p>
                </div>
                {tagEquipe(t)}
              </button>
            );
          })}
        </CardLista>
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
