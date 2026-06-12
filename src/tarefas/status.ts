/** Status fixos do fluxo de tarefas (ordem = colunas do kanban). */
export const STATUS_TAREFA = ['A fazer', 'Fazendo', 'Aguardando aprovação', 'Em alteração', 'Concluído'] as const;
export type StatusTarefa = (typeof STATUS_TAREFA)[number];
export const STATUS_INICIAL: StatusTarefa = 'A fazer';
export const STATUS_CONCLUIDO: StatusTarefa = 'Concluído';
