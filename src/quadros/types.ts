import type { CSSProperties } from 'react';

/** Modelos do Kanban (réplica do Trello) — coleções quadros/listas/cartoes. */

export interface EtiquetaCartao { nome: string; cor: string }
export interface ItemChecklistCartao { texto: string; feito: boolean }
export interface ChecklistCartao { nome: string; itens: ItemChecklistCartao[] }
export interface AnexoCartao { nome?: string; url?: string; trello_url?: string; mime?: string; bytes?: number }

export interface Quadro {
  id: string;
  trello_id?: string;
  cliente?: string;
  nome: string;
  descricao?: string;
  url?: string;
  fundo_img?: string;
  fundo_cor?: string;
  fechado?: boolean;
  ordem?: number;
  created?: string;
  updated?: string;
  expand?: {
    cliente?: { id: string; nome?: string; nome_fantasia?: string; logo?: string; collectionId?: string; collectionName?: string };
  };
}

export interface Lista {
  id: string;
  trello_id?: string;
  quadro: string;
  nome: string;
  ordem?: number;
  fechada?: boolean;
}

export interface Cartao {
  id: string;
  trello_id?: string;
  quadro: string;
  lista?: string;
  nome: string;
  descricao?: string;
  ordem?: number;
  prazo?: string;
  concluido?: boolean;
  etiquetas?: EtiquetaCartao[];
  checklists?: ChecklistCartao[];
  anexos?: AnexoCartao[];
  membros?: string[];
  created?: string;
  updated?: string;
}

/** Primeira imagem do card (capa). */
export function capaCartao(c: Pick<Cartao, 'anexos'>): string | null {
  const a = (c.anexos ?? []).find((x) => (x.mime ?? '').startsWith('image') && x.url);
  return a?.url ?? null;
}

/** Progresso agregado dos checklists do card. */
export function progressoChecklist(c: Pick<Cartao, 'checklists'>): { feitos: number; total: number } {
  let feitos = 0, total = 0;
  for (const ch of c.checklists ?? []) {
    for (const i of ch.itens ?? []) { total++; if (i.feito) feitos++; }
  }
  return { feitos, total };
}

/** Estilo CSS de fundo do tile do quadro (imagem de capa ou gradiente das cores). */
export function fundoStyle(q: Pick<Quadro, 'fundo_img' | 'fundo_cor'>): CSSProperties {
  if (q.fundo_img) {
    return { backgroundImage: `url(${q.fundo_img})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  const cores = (q.fundo_cor ?? '').split(',').map((c) => c.trim()).filter(Boolean);
  if (cores.length >= 2) return { backgroundImage: `linear-gradient(135deg, ${cores[0]}, ${cores[1]})` };
  if (cores.length === 1) return { background: cores[0] };
  return { background: 'hsl(var(--secondary))' };
}

/** Trello color name → classes Tailwind (pill). */
export function corEtiquetaClass(cor?: string): string {
  const c = (cor ?? '').toLowerCase();
  if (c.includes('green') || c.includes('lime')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  if (c.includes('yellow')) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  if (c.includes('orange')) return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
  if (c.includes('red')) return 'bg-red-500/20 text-red-300 border-red-500/40';
  if (c.includes('purple') || c.includes('violet')) return 'bg-violet-500/20 text-violet-300 border-violet-500/40';
  if (c.includes('blue') || c.includes('sky')) return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  if (c.includes('pink')) return 'bg-pink-500/20 text-pink-300 border-pink-500/40';
  if (c.includes('black')) return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40';
  return 'bg-secondary text-muted-foreground border-border';
}
