import { useSyncExternalStore } from 'react';

/* -------------------------------------------------------------------------- */
/*  Modelo global de cards de post para Social Media                           */
/*  Guardado na coleção `configuracoes` (chave="modelo_post_global"),          */
/*  legível por todos e gravável por gestores. Cache local p/ render imediato. */
/* -------------------------------------------------------------------------- */

export interface ModeloPostCard {
  nome: string;
  descricao?: string;
  formato?: string;
  redes?: string[];
}

export interface ModeloPost {
  cards: ModeloPostCard[];
}

/* ----------------------------- cache + store ----------------------------- */

const KEY = 'wenox-modelo-post-v1';

function lerCache(): ModeloPost {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const parsed = JSON.parse(s) as unknown;
      if (parsed && typeof parsed === 'object' && 'cards' in parsed && Array.isArray((parsed as ModeloPost).cards)) {
        return parsed as ModeloPost;
      }
    }
  } catch { /* */ }
  return { cards: [] };
}

let _modelo: ModeloPost = lerCache();
const listeners = new Set<() => void>();

function setModelo(m: ModeloPost): void {
  _modelo = { cards: Array.isArray(m?.cards) ? m.cards : [] };
  try { localStorage.setItem(KEY, JSON.stringify(_modelo)); } catch { /* */ }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function snapshot(): ModeloPost { return _modelo; }

export function getModelo(): ModeloPost { return _modelo; }

export function useModelo(): ModeloPost {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/* --------------------------- persistência (PB) --------------------------- */

const CHAVE = 'modelo_post_global';
interface RegistroConfig { id: string; valor?: { cards: ModeloPostCard[] } }

export async function carregarModeloRemoto(): Promise<ModeloPost> {
  const { pb } = await import('@/lib/pocketbase');
  try {
    const rec = (await pb
      .collection('configuracoes')
      .getFirstListItem(`chave="${CHAVE}"`)) as unknown as RegistroConfig;
    if (rec?.valor && typeof rec.valor === 'object' && Array.isArray(rec.valor.cards)) {
      setModelo({ cards: rec.valor.cards });
    }
  } catch { /* sem registro / offline → mantém cache */ }
  return _modelo;
}

export async function salvarModeloRemoto(cards: ModeloPostCard[]): Promise<void> {
  const { pb } = await import('@/lib/pocketbase');
  setModelo({ cards });
  const col = pb.collection('configuracoes');
  const existente = (await col
    .getFirstListItem(`chave="${CHAVE}"`)
    .catch(() => null)) as unknown as RegistroConfig | null;
  if (existente) await col.update(existente.id, { valor: _modelo });
  else await col.create({ chave: CHAVE, valor: _modelo });
}
