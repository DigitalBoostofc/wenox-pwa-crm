import { pb } from '@/lib/pocketbase';
import { registrarHistorico, diffCampos } from '@/atividade/atividadeService';
import type { Cliente, ClienteInput } from './types';

const col = () => pb.collection('clientes');

export async function listClientes(busca: string): Promise<Cliente[]> {
  const opts: Record<string, unknown> = { sort: '-created' };
  const q = busca.trim();
  if (q) {
    const safe = q.replace(/"/g, '');
    opts.filter = `nome_fantasia ~ "${safe}" || razao_social ~ "${safe}"`;
  }
  const res = await col().getList(1, 100, opts);
  return res.items as unknown as Cliente[];
}

export async function getCliente(id: string): Promise<Cliente> {
  return (await col().getOne(id)) as unknown as Cliente;
}

export async function createCliente(input: ClienteInput): Promise<Cliente> {
  const uid = pb.authStore?.record?.id;
  const rec = (await col().create({
    ...input,
    ...(uid ? { created_by: uid, updated_by: uid } : {}),
  })) as unknown as Cliente;
  await registrarHistorico('cliente', rec.id, 'Cliente cadastrado');
  return rec;
}

export async function updateCliente(
  id: string,
  input: Partial<ClienteInput>
): Promise<Cliente> {
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
  })) as unknown as Cliente;
  const mudancas = diffCampos(antes, input as Record<string, unknown>);
  if (mudancas.length) {
    await registrarHistorico(
      'cliente',
      id,
      `Alterou ${mudancas.join(' · ')}`,
    );
  }
  return rec;
}

export async function deleteCliente(id: string): Promise<void> {
  await col().delete(id);
}
