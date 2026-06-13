import { useEffect, useState } from 'react';
import { listTarefas, concluirTarefa, reabrirTarefa } from './tarefasService';
import type { Tarefa } from './types';
import { MinhaSemanaList } from './MinhaSemanaList';
import { QuickAddTarefa } from './QuickAddTarefa';
import { TarefaSheet } from './TarefaSheet';
import { STATUS_CONCLUIDO, STATUS_INICIAL } from './status';

export function TarefasTabProjeto({
  projetoId, clienteId,
}: {
  projetoId: string;
  clienteId?: string;
}) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [recarrega, setRecarrega] = useState(0);
  const [erro, setErro] = useState('');
  const [sheetId, setSheetId] = useState<string | null>(null);

  useEffect(() => {
    setCarregando(true);
    listTarefas({ projetoId })
      .then((res) => { setTarefas(res); setErro(''); })
      .catch(() => setErro('Não foi possível carregar as tarefas.'))
      .finally(() => setCarregando(false));
  }, [projetoId, recarrega]);

  async function handleConcluir(id: string) {
    setTarefas((lst) => lst.map((t) => (t.id === id ? { ...t, status: STATUS_CONCLUIDO } : t)));
    try {
      await concluirTarefa(id, STATUS_CONCLUIDO);
      setRecarrega((n) => n + 1);
    } catch {
      setErro('Não foi possível concluir a tarefa.');
      setRecarrega((n) => n + 1);
    }
  }

  async function handleReabrir(id: string) {
    setTarefas((lst) => lst.map((t) => (t.id === id ? { ...t, status: STATUS_INICIAL } : t)));
    try {
      await reabrirTarefa(id, STATUS_INICIAL);
      setRecarrega((n) => n + 1);
    } catch {
      setErro('Não foi possível reabrir a tarefa.');
      setRecarrega((n) => n + 1);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {erro}
        </p>
      )}

      <QuickAddTarefa
        onCriada={(id) => { setRecarrega((n) => n + 1); setSheetId(id); }}
        presetProjeto={projetoId}
        presetCliente={clienteId}
      />

      {carregando ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <MinhaSemanaList
            tarefas={tarefas}
            onAbrir={(id) => setSheetId(id)}
            onConcluir={handleConcluir}
            onReabrir={handleReabrir}
          />
          {tarefas.length > 0 && (
            <p className="text-right text-xs text-muted-foreground">
              {tarefas.length} {tarefas.length === 1 ? 'tarefa' : 'tarefas'}
            </p>
          )}
        </>
      )}

      <TarefaSheet
        tarefaId={sheetId}
        aberto={sheetId !== null}
        onClose={() => setSheetId(null)}
        onMudou={() => setRecarrega((n) => n + 1)}
      />
    </div>
  );
}
