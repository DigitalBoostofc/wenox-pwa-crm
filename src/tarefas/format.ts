/** Cor da pill/coluna de status — status é gerenciável, então mapeia
 *  por palavra-chave do nome (fallback neutro). */
export function statusTarefaClass(status?: string): string {
  const s = (status ?? '').toLowerCase();
  if (s.includes('conclu')) return 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400';
  if (s.includes('aprova')) return 'border-amber-500/50 bg-amber-500/15 text-amber-400';
  if (s.includes('altera')) return 'border-destructive/50 bg-destructive/15 text-destructive';
  if (s.includes('fazendo') || s.includes('andamento') || s.includes('execu'))
    return 'border-primary/50 bg-primary/15 text-primary';
  return 'border-border bg-secondary text-muted-foreground';
}

/** Uma tarefa conta como concluída quando o status contém "conclu". */
export function tarefaConcluida(status?: string): boolean {
  return (status ?? '').toLowerCase().includes('conclu');
}

/** true quando o prazo já passou e a tarefa não está concluída. */
export function prazoVencido(prazo?: string, status?: string): boolean {
  if (!prazo || tarefaConcluida(status)) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [ano, mes, dia] = prazo.slice(0, 10).split('-').map(Number);
  const prazoDate = new Date(ano, mes - 1, dia);
  return prazoDate.getTime() < hoje.getTime();
}

export const LADO_LABEL: Record<string, string> = {
  wenox: 'Wenox',
  cliente: 'Cliente',
};
