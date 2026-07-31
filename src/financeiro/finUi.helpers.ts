/**
 * Helpers puros do Financeiro UI (sem componentes — evita react-refresh lint).
 */
import { brl } from './types';

const CAT_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#a855f7',
  '#ef4444',
  '#f97316',
  '#06b6d4',
  '#eab308',
  '#ec4899',
];

export function corCategoria(nome: string, i = 0): string {
  let h = 0;
  for (let k = 0; k < nome.length; k++) h = (h + nome.charCodeAt(k) * (k + 1)) % 997;
  return CAT_COLORS[(h + i) % CAT_COLORS.length];
}

export function balanceBar(receitas: number, despesas: number) {
  const t = Math.max(receitas + despesas, 1);
  return {
    rPct: (receitas / t) * 100,
    dPct: (despesas / t) * 100,
    labelR: brl(receitas),
    labelD: brl(despesas),
  };
}
