import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Plus, ListChecks } from 'lucide-react';
import { listTarefas } from './tarefasService';
import type { Tarefa } from './types';
import { TarefaCard } from './TarefaCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export function TarefasTabProjeto({ projetoId }: { projetoId: string }) {
  const history = useHistory();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    listTarefas({ projetoId })
      .then(setTarefas)
      .finally(() => setCarregando(false));
  }, [projetoId]);

  if (carregando) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {tarefas.length} {tarefas.length === 1 ? 'tarefa' : 'tarefas'}
        </p>
        <Button size="sm" onClick={() => history.push(`/tarefas/nova?projeto=${projetoId}`)}>
          <Plus className="size-4" /> Nova tarefa
        </Button>
      </div>

      {tarefas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <ListChecks className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Este projeto ainda não tem tarefas.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tarefas.map((t) => (
            <TarefaCard
              key={t.id}
              t={t}
              onClick={() => history.push(`/tarefas/${t.id}`)}
              mostrarProjeto={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
