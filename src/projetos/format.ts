import type { BadgeProps } from '@/components/ui/badge';

type BadgeVariant = BadgeProps['variant'];

export const TIPO_SOCIAL_MEDIA = 'Social Media';

/** Status fixos do projeto. Mantemos a ordem que o Leonardo definiu:
 *  Desenvolvimento (foco) → Manutenção → Ativo → Inativo. */
export const STATUS_PROJETO = [
  'Desenvolvimento',
  'Manutenção',
  'Ativo',
  'Inativo',
] as const;
export type StatusProjeto = (typeof STATUS_PROJETO)[number];

/** Status exclusivos de projetos Social Media (recorrentes). */
export const STATUS_SOCIAL_MEDIA = [
  'Ativo', 'Onboarding', 'Pendente', 'Offboarding', 'Inativo',
] as const;
export type StatusSocialMedia = (typeof STATUS_SOCIAL_MEDIA)[number];

/** Status das atividades dentro de um projeto Social Media. */
export const STATUS_ATIVIDADE_SOCIAL = [
  'Copy', 'Layout', 'Aprovação', 'Alteração', 'Agendamento', 'Publicação',
] as const;

export function statusProjetoVariant(status?: string): BadgeVariant {
  switch (status) {
    case 'Desenvolvimento': return 'warning';
    case 'Manutenção':      return 'default';
    case 'Ativo':           return 'success';
    case 'Inativo':         return 'destructive';
    default:                return 'muted';
  }
}

export function statusSocialMediaVariant(status?: string): BadgeVariant {
  switch (status) {
    case 'Ativo':        return 'success';
    case 'Onboarding':   return 'default';
    case 'Pendente':     return 'warning';
    case 'Offboarding':  return 'muted';
    case 'Inativo':      return 'destructive';
    default:             return 'muted';
  }
}

export function statusAtividadeSocialVariant(status?: string): BadgeVariant {
  switch (status) {
    case 'Copy':        return 'warning';
    case 'Layout':      return 'default';
    case 'Aprovação':   return 'muted';
    case 'Alteração':   return 'destructive';
    case 'Agendamento': return 'success';
    case 'Publicação':  return 'success';
    default:            return 'muted';
  }
}

/** Retorna o variant correto considerando o tipo do projeto. */
export function statusVariantParaTipo(tipo?: string, status?: string): BadgeVariant {
  if (tipo === TIPO_SOCIAL_MEDIA) return statusSocialMediaVariant(status);
  return statusProjetoVariant(status);
}

/** Retorna os status válidos para o tipo de projeto. */
export function statusesParaTipo(tipo?: string): readonly string[] {
  if (tipo === TIPO_SOCIAL_MEDIA) return STATUS_SOCIAL_MEDIA;
  return STATUS_PROJETO;
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

export function pillStatusSocialMediaClass(status: string): string {
  switch (status) {
    case 'Ativo':        return 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400';
    case 'Onboarding':   return 'border-primary/50 bg-primary/15 text-primary';
    case 'Pendente':     return 'border-amber-500/50 bg-amber-500/15 text-amber-400';
    case 'Offboarding':  return 'border-border bg-secondary text-muted-foreground';
    case 'Inativo':      return 'border-destructive/50 bg-destructive/15 text-destructive';
    default:             return 'border-primary/50 bg-primary/15 text-primary';
  }
}

/** Pill class correta considerando o tipo do projeto. */
export function pillStatusParaTipoClass(tipo: string | undefined, status: string): string {
  if (tipo === TIPO_SOCIAL_MEDIA) return pillStatusSocialMediaClass(status);
  return pillStatusProjetoClass(status);
}
