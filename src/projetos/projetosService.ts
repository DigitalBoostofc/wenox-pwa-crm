import { pb } from '@/lib/pocketbase';
import { registrarHistorico, diffCampos } from '@/atividade/atividadeService';
import type { Projeto, ProjetoInput } from './types';

const col = () => pb.collection('projetos');

const CAMPOS_LISTA = [
  'id', 'collectionId', 'collectionName', 'nome', 'cliente', 'tipo', 'status',
  'etapa', 'etiquetas', 'responsaveis', 'data_inicio', 'data_entrega', 'created',
].join(',');

interface ListOpts {
  busca?: string;
  tipo?: string;
  clienteId?: string;
  etapa?: string;
  status?: string;
}

export async function listProjetos(o: ListOpts = {}): Promise<Projeto[]> {
  const filtros: string[] = [];
  const q = (o.busca ?? '').trim();
  if (q) {
    const safe = q.replace(/"/g, '');
    filtros.push(`(nome ~ "${safe}" || cliente.nome_fantasia ~ "${safe}" || cliente.nome ~ "${safe}")`);
  }
  if (o.tipo) filtros.push(`tipo = "${o.tipo.replace(/"/g, '')}"`);
  if (o.status) filtros.push(`status = "${o.status.replace(/"/g, '')}"`);
  if (o.clienteId) filtros.push(`cliente = "${o.clienteId}"`);
  if (o.etapa) filtros.push(`etapa = "${o.etapa.replace(/"/g, '')}"`);

  const opts: Record<string, unknown> = {
    sort: '-created',
    fields: CAMPOS_LISTA + ',expand.cliente.id,expand.cliente.collectionId,expand.cliente.collectionName,expand.cliente.nome,expand.cliente.nome_fantasia,expand.cliente.logo,expand.responsaveis.id,expand.responsaveis.nome,expand.responsaveis.email,expand.responsaveis.foto,expand.responsaveis.collectionId,expand.responsaveis.collectionName',
    expand: 'cliente,responsaveis',
  };
  if (filtros.length) opts.filter = filtros.join(' && ');
  const res = await col().getList(1, 200, opts);
  return res.items as unknown as Projeto[];
}

export async function getProjeto(id: string): Promise<Projeto> {
  return (await col().getOne(id, { expand: 'cliente,responsaveis' })) as unknown as Projeto;
}

export async function criarProjeto(input: ProjetoInput): Promise<Projeto> {
  const uid = pb.authStore?.record?.id;
  const dados = { ...input, ...(uid ? { created_by: uid, updated_by: uid } : {}) };
  const rec = (await col().create(dados)) as unknown as Projeto;
  await registrarHistorico('projeto', rec.id, 'Projeto criado');
  return rec;
}

export async function atualizarProjeto(
  id: string,
  input: Partial<ProjetoInput>,
): Promise<Projeto> {
  const uid = pb.authStore?.record?.id;
  let antes: Record<string, unknown> | undefined;
  try {
    antes = (await col().getOne(id)) as unknown as Record<string, unknown>;
  } catch {
    /* */
  }
  const dados = { ...input, ...(uid ? { updated_by: uid } : {}) };
  const rec = (await col().update(id, dados)) as unknown as Projeto;
  const mudancas = diffCampos(antes, input as Record<string, unknown>);
  if (mudancas.length) {
    await registrarHistorico('projeto', id, `Alterou ${mudancas.join(' · ')}`);
  }
  return rec;
}

export async function removerProjeto(id: string): Promise<void> {
  await col().delete(id);
}
