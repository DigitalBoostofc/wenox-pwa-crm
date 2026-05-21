import { pb } from '@/lib/pocketbase';
import { criarUsuario, atualizarUsuario } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { registrarHistorico } from '@/atividade/atividadeService';

/** Busca a conta de acesso (role=Cliente) vinculada a um cliente. */
export async function getAcessoCliente(clienteId: string): Promise<Usuario | null> {
  try {
    const r = await pb.collection('usuarios').getFirstListItem(
      `role = "Cliente" && cliente = "${clienteId.replace(/"/g, '')}"`,
    );
    return r as unknown as Usuario;
  } catch {
    return null;
  }
}

/** Cria o login do cliente — conta usuarios role=Cliente vinculada ao cliente. */
export async function criarAcessoCliente(
  clienteId: string,
  dados: { nome: string; email: string; senha: string },
): Promise<Usuario> {
  const u = await criarUsuario(
    {
      nome: dados.nome.trim(),
      email: dados.email.trim(),
      role: 'Cliente',
      status: 'Ativo',
      cliente: clienteId,
    } as Omit<Usuario, 'id'>,
    dados.senha,
  );
  await registrarHistorico('cliente', clienteId, 'Acesso do cliente criado');
  return u;
}

/** Redefine a senha da conta de acesso do cliente. */
export async function resetarSenhaAcesso(
  usuarioId: string,
  senha: string,
): Promise<void> {
  await atualizarUsuario(usuarioId, {
    password: senha,
    passwordConfirm: senha,
  } as unknown as Partial<Omit<Usuario, 'id'>>);
}
