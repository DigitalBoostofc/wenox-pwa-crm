import { pb } from '@/lib/pocketbase';
import type { EtapaProjeto } from './types';

const col = () => pb.collection('etapas_projeto');

export async function listEtapas(tipo?: string): Promise<EtapaProjeto[]> {
  const opts: Record<string, unknown> = { sort: 'ordem,created' };
  if (tipo) {
    const safe = tipo.replace(/"/g, '');
    opts.filter = `tipo = "${safe}"`;
  }
  const res = await col().getFullList(opts);
  return res as unknown as EtapaProjeto[];
}

export async function criarEtapa(input: Omit<EtapaProjeto, 'id' | 'created' | 'updated'>): Promise<EtapaProjeto> {
  return (await col().create(input)) as unknown as EtapaProjeto;
}

export async function atualizarEtapa(id: string, input: Partial<EtapaProjeto>): Promise<EtapaProjeto> {
  return (await col().update(id, input)) as unknown as EtapaProjeto;
}

export async function removerEtapa(id: string): Promise<void> {
  await col().delete(id);
}

/** Reordena uma lista — recebe ids em nova ordem e grava `ordem` 1..N. */
export async function reordenarEtapas(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id, idx) => col().update(id, { ordem: idx + 1 })));
}
