import { pb } from '@/lib/pocketbase';
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
  return (await col().create(input)) as unknown as Cliente;
}

export async function updateCliente(
  id: string,
  input: Partial<ClienteInput>
): Promise<Cliente> {
  return (await col().update(id, input)) as unknown as Cliente;
}

export async function deleteCliente(id: string): Promise<void> {
  await col().delete(id);
}
