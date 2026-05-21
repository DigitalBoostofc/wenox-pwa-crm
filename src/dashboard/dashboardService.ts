import { pb } from '@/lib/pocketbase';
import { listClientes } from '@/clientes/clientesService';
import { listProjetos } from '@/projetos/projetosService';
import { listTarefas } from '@/tarefas/tarefasService';
import { tarefaConcluida, prazoVencido } from '@/tarefas/format';
import type { Tarefa } from '@/tarefas/types';

export interface ResumoDashboard {
  totalClientes: number;
  totalProjetos: number;
  projetosAndamento: number;
  tarefasAbertas: number;
  tarefasVencidas: number;
  aguardandoAprovacao: Tarefa[];
  minhasTarefas: Tarefa[];
}

/** Carrega os números e listas do Dashboard a partir dos dados visíveis
 *  para o usuário logado (as collection rules já escopam por papel). */
export async function carregarDashboard(): Promise<ResumoDashboard> {
  const uid = pb.authStore?.record?.id;
  const [clientes, projetos, tarefas] = await Promise.all([
    listClientes(''),
    listProjetos({}),
    listTarefas({}),
  ]);

  const abertas = tarefas.filter((t) => !tarefaConcluida(t.status));

  const aguardandoAprovacao = tarefas
    .filter(
      (t) =>
        (t.status ?? '').toLowerCase().includes('aprova') &&
        t.aprovacao !== 'aprovada',
    )
    .slice(0, 6);

  const minhasTarefas = abertas
    .filter((t) => !!uid && (t.responsaveis ?? []).includes(uid))
    .sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'))
    .slice(0, 6);

  return {
    totalClientes: clientes.length,
    totalProjetos: projetos.length,
    projetosAndamento: projetos.filter((p) => p.status && p.status !== 'Inativo').length,
    tarefasAbertas: abertas.length,
    tarefasVencidas: tarefas.filter((t) => prazoVencido(t.prazo, t.status)).length,
    aguardandoAprovacao,
    minhasTarefas,
  };
}
