import type { BadgeProps } from '@/components/ui/badge';

type BadgeVariant = BadgeProps['variant'];

/** Status fixos do projeto. Mantemos a ordem que o Leonardo definiu:
 *  Desenvolvimento (foco) → Manutenção → Ativo → Inativo. */
export const STATUS_PROJETO = [
  'Desenvolvimento',
  'Manutenção',
  'Ativo',
  'Inativo',
] as const;
export type StatusProjeto = (typeof STATUS_PROJETO)[number];

export function statusProjetoVariant(status?: string): BadgeVariant {
  switch (status) {
    case 'Desenvolvimento': return 'warning';   // amarelo
    case 'Manutenção':      return 'default';   // roxo (primary)
    case 'Ativo':           return 'success';   // verde
    case 'Inativo':         return 'destructive'; // vermelho
    default:                return 'muted';
  }
}

/** Classes da pill de filtro selecionada — espelha o badge do status. */
export function pillStatusProjetoClass(status: string): string {
  switch (status) {
    case 'Desenvolvimento':
      return 'border-amber-500/50 bg-amber-500/15 text-amber-400';
    case 'Manutenção':
      return 'border-primary/50 bg-primary/15 text-primary';
    case 'Ativo':
      return 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400';
    case 'Inativo':
      return 'border-destructive/50 bg-destructive/15 text-destructive';
    default:
      return 'border-primary/50 bg-primary/15 text-primary';
  }
}
