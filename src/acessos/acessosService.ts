import { pb } from '@/lib/pocketbase';
import { registrarHistorico, diffCampos } from '@/atividade/atividadeService';
import type { Acesso, AcessoInput } from './types';

const col = () => pb.collection('acessos');

export async function listAcessos(clienteId: string): Promise<Acesso[]> {
  const res = await col().getFullList({
    filter: `cliente = "${clienteId}"`,
    sort: 'plataforma',
    expand: 'responsavel',
  });
  return res as unknown as Acesso[];
}

export async function createAcesso(input: AcessoInput): Promise<Acesso> {
  const uid = pb.authStore?.record?.id;
  const rec = (await col().create({
    ...input,
    ...(uid ? { created_by: uid, updated_by: uid } : {}),
  })) as unknown as Acesso;
  await registrarHistorico(
    'acesso',
    rec.id,
    `Acesso "${rec.plataforma}" cadastrado`,
  );
  return rec;
}

export async function updateAcesso(
  id: string,
  input: Partial<AcessoInput>,
): Promise<Acesso> {
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
  })) as unknown as Acesso;

  // diffCampos NÃO inclui 'senha' (não está nos rótulos) → nunca vaza o valor
  const mudancas = diffCampos(antes, input as Record<string, unknown>);
  // troca de senha: registra o fato, nunca o valor
  if (
    'senha' in input &&
    antes &&
    input.senha !== (antes.senha as string | undefined)
  ) {
    mudancas.push('senha atualizada');
  }
  if (mudancas.length) {
    await registrarHistorico('acesso', id, `Alterou ${mudancas.join(' · ')}`);
  }
  return rec;
}

export async function removeAcesso(a: Acesso): Promise<void> {
  await col().delete(a.id);
}
