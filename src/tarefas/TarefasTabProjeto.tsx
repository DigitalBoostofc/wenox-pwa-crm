import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { listTarefas, criarTarefa } from './tarefasService';
import type { Tarefa, TarefaInput } from './types';
import { TabelaTarefas } from './TabelaTarefas';
import type { NovaTarefaInline } from './TabelaTarefas';
import { listOpcoes } from '@/opcoes/opcoesService';
import type { Opcao } from '@/opcoes/types';

export function TarefasTabProjeto({
  projetoId, clienteId,
}: {
  projetoId: string;
  clienteId?: string;
}) {
  const history = useHistory();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [statuses, setStatuses] = useState<Opcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [recarrega, setRecarrega] = useState(0);

  useEffect(() => {
    listOpcoes('status_tarefa').then(setStatuses);
  }, []);

  useEffect(() => {
    setCarregando(true);
    listTarefas({ projetoId })
      .then(setTarefas)
      .finally(() => setCarregando(false));
  }, [projetoId, recarrega]);

  /** Cadastro inline — já nasce vinculada a este projeto e cliente. */
  async function criarInline(d: NovaTarefaInline) {
    await criarTarefa({
      nome: d.nome, status: d.status, prazo: d.prazo,
      projeto: projetoId, cliente: clienteId ?? '', lado: 'wenox',
    } as TarefaInput);
    setRecarrega((n) => n + 1);
  }

  if (carregando) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {tarefas.length} {tarefas.length === 1 ? 'tarefa' : 'tarefas'}
      </p>
      <TabelaTarefas
        contexto="projeto"
        tarefas={tarefas}
        statuses={statuses}
        onAbrir={(id) => history.push(`/tarefas/${id}`)}
        onCriar={criarInline}
      />
    </div>
  );
}
