import { pb } from '@/lib/pocketbase';
import { listUsuarios, atualizarUsuario } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import type { Projeto } from '@/projetos/types';

export { listUsuarios as listMembros };

export async function getMembro(id: string): Promise<Usuario> {
  const r = await pb.collection('usuarios').getOne(id);
  return r as unknown as Usuario;
}

export async function listProjetosMembro(userId: string): Promise<Projeto[]> {
  const r = await pb.collection('projetos').getList(1, 200, {
    filter: `responsaveis ~ "${userId}"`,
    expand: 'cliente',
    sort: '-created',
  });
  return r.items as unknown as Projeto[];
}

export { atualizarUsuario as atualizarMembro };
