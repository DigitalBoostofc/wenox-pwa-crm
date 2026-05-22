import { useEffect, useState } from 'react';
import { listTarefas } from './tarefasService';
import type { Tarefa } from './types';
import { TabelaTarefas } from './TabelaTarefas';

export function TarefasTabProjeto({
  projetoId, clienteId,
}: {
  projetoId: string;
  clienteId?: string;
}) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [recarrega, setRecarrega] = useState(0);

  useEffect(() => {
    setCarregando(true);
    listTarefas({ projetoId })
      .then(setTarefas)
      .finally(() => setCarregando(false));
  }, [projetoId, recarrega]);

  if (carregando) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {tarefas.length} {tarefas.length === 1 ? 'tarefa' : 'tarefas'}
      </p>
      <TabelaTarefas
        tarefas={tarefas}
        onMudou={() => setRecarrega((n) => n + 1)}
        presetProjeto={projetoId}
        presetCliente={clienteId}
      />
    </div>
  );
}
