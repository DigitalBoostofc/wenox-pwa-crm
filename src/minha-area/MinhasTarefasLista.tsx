import { useMemo, useState } from 'react';
import { useDadosAgencia } from '@/dashboard/useDadosAgencia';
import { useAuth } from '@/auth/useAuth';
import { TarefasTabela } from '@/tarefas/TarefasTabela';
import { TarefaViewSheet } from '@/tarefas/TarefaViewSheet';
import { Skeleton } from '@/components/ui/skeleton';

export function MinhasTarefasLista({ somenteLeitura }: { somenteLeitura?: boolean }) {
  const { tarefas, carregando, refresh } = useDadosAgencia();
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const [viewId, setViewId] = useState<string | null>(null);

  const minhas = useMemo(
    () => tarefas.filter((t) => (t.responsaveis ?? []).includes(uid) && !t.arquivada),
    [tarefas, uid],
  );

  if (carregando) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="flex flex-col gap-4">
      <TarefasTabela
        tarefas={minhas}
        onAbrir={(id) => setViewId(id)}
        persistPrefix="wenox-minha-lista-v2"
        onMudou={refresh}
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
