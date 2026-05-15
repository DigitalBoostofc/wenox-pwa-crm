import { pb } from '@/lib/pocketbase';

export interface MembroEquipe {
  id: string;
  cliente: string;
  usuario: string;
  area?: string;
  status: string;
  expand?: { usuario?: { id: string; nome: string; email: string } };
}

const col = () => pb.collection('equipe_cliente');

export async function listEquipe(clienteId: string): Promise<MembroEquipe[]> {
  const r = await col().getList(1, 200, {
    filter: `cliente = "${clienteId}"`,
    expand: 'usuario',
  });
  return r.items as unknown as MembroEquipe[];
}

export async function addMembro(
  clienteId: string,
  usuarioId: string,
  area: string
): Promise<MembroEquipe> {
  return (await col().create({
    cliente: clienteId,
    usuario: usuarioId,
    area,
    status: 'Ativo',
  })) as unknown as MembroEquipe;
}

export async function removeMembro(id: string): Promise<void> {
  await col().delete(id);
}
