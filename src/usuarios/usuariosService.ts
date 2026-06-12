import { pb } from '@/lib/pocketbase';
import type { Usuario } from './types';

const col = () => pb.collection('usuarios');

export async function listUsuarios(): Promise<Usuario[]> {
  const r = await col().getList(1, 200, { sort: 'nome' });
  return r.items as unknown as Usuario[];
}

/** URL pública da foto do usuário ('' se não tiver). */
export function fotoUrl(
  u: Pick<Usuario, 'id' | 'foto' | 'collectionId' | 'collectionName'>,
  thumb?: string,
): string {
  if (!u?.foto) return '';
  return pb.files.getURL(
    u as unknown as Record<string, unknown>,
    u.foto,
    thumb ? { thumb } : undefined,
  );
}

/** Monta o corpo — FormData quando há foto nova, JSON caso contrário. */
function corpo(dados: Record<string, unknown>, foto?: File | null) {
  if (!foto) {
    const { foto: _omit, ...resto } = dados;
    void _omit;
    return resto;
  }
  const fd = new FormData();
  for (const [k, v] of Object.entries(dados)) {
    if (v === undefined || v === null || k === 'foto') continue;
    fd.append(k, String(v));
  }
  fd.append('foto', foto);
  return fd;
}

export async function criarUsuario(
  u: Omit<Usuario, 'id'>,
  senha: string,
  foto?: File | null,
): Promise<Usuario> {
  const dados = {
    ...u,
    password: senha,
    passwordConfirm: senha,
    emailVisibility: true,
  };
  return (await col().create(corpo(dados, foto))) as unknown as Usuario;
}

export async function atualizarUsuario(
  id: string,
  patch: Partial<Omit<Usuario, 'id'>>,
  foto?: File | null,
): Promise<Usuario> {
  return (await col().update(id, corpo(patch, foto))) as unknown as Usuario;
}

/**
 * Admin/Owner define uma nova senha para outro usuário, sem precisar da senha
 * atual. Só funciona com a "Manage rule" configurada na coleção `usuarios`
 * (Owner/Admin) — caso contrário o PocketBase recusa por falta do oldPassword.
 */
export async function definirSenhaUsuario(
  id: string,
  novaSenha: string,
): Promise<Usuario> {
  return (await col().update(id, {
    password: novaSenha,
    passwordConfirm: novaSenha,
  })) as unknown as Usuario;
}

/**
 * Usuário logado troca a própria senha. O PocketBase exige a senha atual.
 * A troca invalida o token, então re-autenticamos para manter a sessão viva.
 */
export async function trocarMinhaSenha(
  email: string,
  senhaAtual: string,
  novaSenha: string,
): Promise<void> {
  const id = pb.authStore.record?.id;
  if (!id) throw new Error('Sem sessão ativa.');
  await col().update(id, {
    oldPassword: senhaAtual,
    password: novaSenha,
    passwordConfirm: novaSenha,
  });
  // Token antigo deixa de valer após a troca — renova a sessão.
  await col().authWithPassword(email, novaSenha);
}
