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
