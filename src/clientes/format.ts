import type { BadgeProps } from '@/components/ui/badge';

type BadgeVariant = BadgeProps['variant'];

/** Cor determinística do avatar a partir do nome. */
const CORES_AVATAR = [
  'bg-violet-500', 'bg-fuchsia-500', 'bg-cyan-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-blue-500', 'bg-indigo-500',
];
export function corAvatar(nome: string): string {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) | 0;
  return CORES_AVATAR[Math.abs(h) % CORES_AVATAR.length];
}

export function inicial(nome?: string): string {
  return (nome ?? '?').trim().charAt(0).toUpperCase() || '?';
}

/** Badge colorida por status (heurística + fallback). */
export function statusVariant(status?: string): BadgeVariant {
  const s = (status ?? '').toLowerCase();
  if (/(ativo|ativa|on)/.test(s)) return 'success';
  if (/(inativo|inativa|encerrad|cancelad|off)/.test(s)) return 'muted';
  if (/(pausad|espera|pendente)/.test(s)) return 'info';
  return 'default';
}

/** "Hoje" / "Há 1 dia" / "Há N dias" a partir de uma data ISO do PocketBase. */
export function haDias(dataIso?: string): string {
  if (!dataIso) return '';
  const t = new Date(dataIso.replace(' ', 'T')).getTime();
  if (Number.isNaN(t)) return '';
  const dias = Math.floor((Date.now() - t) / 86_400_000);
  if (dias <= 0) return 'Hoje';
  if (dias === 1) return 'Há 1 dia';
  return `Há ${dias} dias`;
}
