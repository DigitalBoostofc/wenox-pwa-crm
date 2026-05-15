import { pb } from '@/lib/pocketbase';
import type { Usuario } from './types';

const col = () => pb.collection('usuarios');

export async function listUsuarios(): Promise<Usuario[]> {
  const r = await col().getList(1, 200, { sort: 'nome' });
  return r.items as unknown as Usuario[];
}

export async function criarUsuario(
  u: Omit<Usuario, 'id'>,
  senha: string
): Promise<Usuario> {
  return (await col().create({
    ...u,
    password: senha,
    passwordConfirm: senha,
    emailVisibility: true,
  })) as unknown as Usuario;
}

export async function atualizarUsuario(
  id: string,
  patch: Partial<Omit<Usuario, 'id'>>
): Promise<Usuario> {
  return (await col().update(id, patch)) as unknown as Usuario;
}
