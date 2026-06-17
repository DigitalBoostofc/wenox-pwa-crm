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

/**
 * Migra os registros que guardam o valor antigo como string literal para o novo
 * valor — espelha exatamente as coleções/campos que `contarUsoOpcao` consulta.
 * Sem isso, renomear uma opção em uso deixa os registros órfãos (perdem
 * filtro/categoria na UI e `contarUsoOpcao` passa a retornar 0 para o novo nome).
 */
async function migrarValorOpcao(
  tipo: TipoOpcao,
  antigo: string,
  novo: string,
): Promise<void> {
  if (antigo === novo) return;

  const atualizarCampo = async (
    colecao: string,
    campo: 'status' | 'categoria' | 'tipo' | 'origem',
  ): Promise<void> => {
    const regs = (await pb
      .collection(colecao)
      .getFullList({ fields: `id,${campo}` })) as unknown as Record<string, string>[];
    await Promise.all(
      regs
        .filter((r) => r[campo] === antigo)
        .map((r) => pb.collection(colecao).update(r.id, { [campo]: novo })),
    );
  };

  if (tipo === 'status_contato') return atualizarCampo('contatos', 'status');
  if (tipo === 'categoria_acesso') return atualizarCampo('acessos', 'categoria');
  if (tipo === 'categoria_documento') return atualizarCampo('documentos', 'categoria');
  if (tipo === 'tipo_projeto') return atualizarCampo('projetos', 'tipo');
  if (tipo === 'origem') return atualizarCampo('clientes', 'origem');
  if (tipo === 'status') return atualizarCampo('clientes', 'status');

  // tipo === 'servico': campo array em clientes.servicos — troca o item no array.
  const clientes = (await pb
    .collection('clientes')
    .getFullList({ fields: 'id,servicos' })) as unknown as { id: string; servicos?: string[] }[];
  await Promise.all(
    clientes
      .filter((c) => Array.isArray(c.servicos) && c.servicos.includes(antigo))
      .map((c) =>
        pb.collection('clientes').update(c.id, {
          servicos: (c.servicos ?? []).map((s) => (s === antigo ? novo : s)),
        }),
      ),
  );
}

export async function editarOpcao(
  id: string,
  valor: string,
): Promise<Opcao> {
  const v = valor.trim();
  if (!v) throw new Error('Informe um valor');
  const antiga = (await col().getOne(id)) as unknown as Opcao;
  const atualizada = (await col().update(id, { valor: v })) as unknown as Opcao;
  // Renomeou? Propaga o novo valor para os registros que referenciavam o antigo.
  if (antiga.valor !== v) {
    await migrarValorOpcao(antiga.tipo, antiga.valor, v);
  }
  return atualizada;
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
  if (tipo === 'categoria_documento') {
    const docs = (await pb
      .collection('documentos')
      .getFullList({ fields: 'categoria' })) as unknown as { categoria?: string }[];
    return docs.filter((d) => d.categoria === valor).length;
  }
  if (tipo === 'tipo_projeto') {
    const projetos = (await pb
      .collection('projetos')
      .getFullList({ fields: 'tipo' })) as unknown as { tipo?: string }[];
    return projetos.filter((p) => p.tipo === valor).length;
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
