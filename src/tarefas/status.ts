/** Status fixos do fluxo de tarefas (ordem = colunas do kanban). */
export const STATUS_TAREFA = ['Não iniciado', 'Em andamento', 'Aguardando aprovação', 'Em alteração', 'Concluído'] as const;
export type StatusTarefa = (typeof STATUS_TAREFA)[number];
export const STATUS_INICIAL: StatusTarefa = 'Não iniciado';
export const STATUS_CONCLUIDO: StatusTarefa = 'Concluído';
