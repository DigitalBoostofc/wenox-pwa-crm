import { pb } from '@/lib/pocketbase';

export interface AtividadeSocial {
  id: string;
  nome: string;
  projeto: string;
  status?: string;
  mes_referencia?: string;
  ordem?: number;
  responsaveis?: string[];
  observacoes?: string;
  created?: string;
  updated?: string;
  expand?: {
    responsaveis?: { id: string; nome?: string; email?: string }[];
  };
}

export type AtividadeSocialInput = Omit<
  AtividadeSocial,
  'id' | 'created' | 'updated' | 'expand'
>;

const col = () => pb.collection('atividades_social');

export async function listAtividadesSocial(
  projetoId: string,
): Promise<AtividadeSocial[]> {
  const res = await col().getList(1, 200, {
    filter: `projeto = "${projetoId}"`,
    sort: 'ordem,created',
    expand: 'responsaveis',
  });
  return res.items as unknown as AtividadeSocial[];
}

export async function criarAtividadeSocial(
  input: AtividadeSocialInput,
): Promise<AtividadeSocial> {
  return (await col().create(input)) as unknown as AtividadeSocial;
}

export async function atualizarAtividadeSocial(
  id: string,
  input: Partial<AtividadeSocialInput>,
): Promise<AtividadeSocial> {
  return (await col().update(id, input)) as unknown as AtividadeSocial;
}

export async function removerAtividadeSocial(id: string): Promise<void> {
  await col().delete(id);
}
