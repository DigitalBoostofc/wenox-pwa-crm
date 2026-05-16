import { pb } from '@/lib/pocketbase';
import { registrarHistorico, diffCampos } from '@/atividade/atividadeService';
import type { Contato, ContatoInput } from './types';

const col = () => pb.collection('contatos');

export async function listContatos(clienteId: string): Promise<Contato[]> {
  const res = await col().getFullList({
    filter: `cliente = "${clienteId}"`,
    sort: 'nome',
  });
  return res as unknown as Contato[];
}

export async function createContato(input: ContatoInput): Promise<Contato> {
  const uid = pb.authStore?.record?.id;
  const rec = (await col().create({
    ...input,
    ...(uid ? { created_by: uid, updated_by: uid } : {}),
  })) as unknown as Contato;
  await registrarHistorico('contato', rec.id, `Contato "${rec.nome}" cadastrado`);
  return rec;
}

export async function updateContato(
  id: string,
  input: Partial<ContatoInput>,
): Promise<Contato> {
  const uid = pb.authStore?.record?.id;
  let antes: Record<string, unknown> | undefined;
  try {
    antes = (await col().getOne(id)) as unknown as Record<string, unknown>;
  } catch {
    /* sem 'antes' não há diff */
  }
  const rec = (await col().update(id, {
    ...input,
    ...(uid ? { updated_by: uid } : {}),
  })) as unknown as Contato;
  const mudancas = diffCampos(antes, input as Record<string, unknown>);
  if (mudancas.length) {
    await registrarHistorico('contato', id, `Alterou ${mudancas.join(' · ')}`);
  }
  return rec;
}

export async function removeContato(c: Contato): Promise<void> {
  await col().delete(c.id);
}
