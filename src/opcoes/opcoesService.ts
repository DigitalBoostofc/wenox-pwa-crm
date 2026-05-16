import { pb } from '@/lib/pocketbase';
import type { Cliente } from '@/clientes/types';
import type { Opcao, TipoOpcao } from './types';

const col = () => pb.collection('opcoes');

export async function listOpcoes(tipo?: TipoOpcao): Promise<Opcao[]> {
  const opts: Record<string, unknown> = { sort: 'tipo,ordem' };
  if (tipo) opts.filter = `tipo = "${tipo}"`;
  const res = await col().getFullList(opts);
  return res as unknown as Opcao[];
}

export async function criarOpcao(
  tipo: TipoOpcao,
  valor: string,
): Promise<Opcao> {
  const v = valor.trim();
  if (!v) throw new Error('Informe um valor');
  const existentes = await listOpcoes(tipo);
  const ordem = existentes.length
    ? Math.max(...existentes.map((o) => o.ordem ?? 0)) + 1
    : 1;
  return (await col().create({ tipo, valor: v, ordem })) as unknown as Opcao;
}

export async function editarOpcao(
  id: string,
  valor: string,
): Promise<Opcao> {
  const v = valor.trim();
  if (!v) throw new Error('Informe um valor');
  return (await col().update(id, { valor: v })) as unknown as Opcao;
}

export async function reordenarOpcao(
  id: string,
  ordem: number,
): Promise<Opcao> {
  return (await col().update(id, { ordem })) as unknown as Opcao;
}

/** Quantos registros usam este valor neste tipo de opção. */
export async function contarUsoOpcao(
  tipo: TipoOpcao,
  valor: string,
): Promise<number> {
  if (tipo === 'status_contato') {
    const contatos = (await pb
      .collection('contatos')
      .getFullList({ fields: 'status' })) as unknown as { status?: string }[];
    return contatos.filter((c) => c.status === valor).length;
  }
  if (tipo === 'categoria_acesso') {
    const acessos = (await pb
      .collection('acessos')
      .getFullList({ fields: 'categoria' })) as unknown as { categoria?: string }[];
    return acessos.filter((a) => a.categoria === valor).length;
  }
  const clientes = (await pb
    .collection('clientes')
    .getFullList({ fields: 'origem,status,servicos' })) as unknown as Cliente[];
  return clientes.filter((c) => {
    if (tipo === 'origem') return c.origem === valor;
    if (tipo === 'status') return c.status === valor;
    return Array.isArray(c.servicos) && c.servicos.includes(valor);
  }).length;
}

/** Remove a opção, mas bloqueia se algum cliente ainda a estiver usando. */
export async function removerOpcao(op: Opcao): Promise<void> {
  const uso = await contarUsoOpcao(op.tipo, op.valor);
  if (uso > 0) {
    throw new Error(
      `Não é possível remover "${op.valor}": ${uso} registro(s) ainda usam esta opção.`,
    );
  }
  await col().delete(op.id);
}
