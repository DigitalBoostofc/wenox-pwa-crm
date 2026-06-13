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

/** Parse datetime por partes (data + hora opcional), LOCAL, ignorando o Z. */
export function parsePrazo(prazo?: string): Date | null {
  if (!prazo) return null;
  const limpo = prazo.replace('T', ' ').replace('Z', '').trim();
  const [dataPart, horaPart] = limpo.split(/\s+/);
  const partes = dataPart.split('-').map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return null;
  const [ano, mes, dia] = partes;
  let h = 0, m = 0, s = 0;
  if (horaPart) {
    const hp = horaPart.split(':').map(Number);
    h = hp[0] ?? 0;
    m = hp[1] ?? 0;
    s = hp[2] ?? 0;
  }
  return new Date(ano, mes - 1, dia, h, m, s);
}

/** true se o prazo tem componente de hora != 00:00:00 */
export function temHoraPrazo(prazo?: string): boolean {
  if (!prazo) return false;
  const limpo = prazo.replace('T', ' ').replace('Z', '').trim();
  const horaPart = limpo.split(/\s+/)[1];
  if (!horaPart) return false;
  const hp = horaPart.split(':').map(Number);
  return (hp[0] ?? 0) !== 0 || (hp[1] ?? 0) !== 0 || (hp[2] ?? 0) !== 0;
}

/** Prazo-limite efetivo: se tem hora → datetime exato; senão → mesmo dia 23:59:59. */
export function prazoLimite(prazo?: string): Date | null {
  if (!prazo) return null;
  const d = parsePrazo(prazo);
  if (!d) return null;
  if (!temHoraPrazo(prazo)) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

/** Exibição: "dd/mm/aaaa" sem hora; "dd/mm/aaaa HH:MM" com hora; '' se vazio. */
export function prazoBR(prazo?: string): string {
  const d = parsePrazo(prazo);
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const aaaa = d.getFullYear();
  if (!temHoraPrazo(prazo)) return `${dd}/${mm}/${aaaa}`;
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${aaaa} ${hh}:${mi}`;
}

/** true quando o prazo já passou e a tarefa não está concluída. */
export function prazoVencido(prazo?: string, status?: string): boolean {
  if (tarefaConcluida(status)) return false;
  const limite = prazoLimite(prazo);
  if (!limite) return false;
  return limite.getTime() < Date.now();
}

export const LADO_LABEL: Record<string, string> = {
  wenox: 'Wenox',
  cliente: 'Cliente',
};
