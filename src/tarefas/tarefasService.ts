import { pb } from '@/lib/pocketbase';
import {
  registrarHistorico, diffCampos, addComentario,
} from '@/atividade/atividadeService';
import { notificar, idsGestao } from '@/notificacoes/notificacoesService';
import type { Tarefa, TarefaInput } from './types';

const col = () => pb.collection('tarefas');

const EXPAND = 'projeto,cliente,responsaveis,contato';
const CAMPOS_LISTA = [
  'id', 'collectionId', 'collectionName', 'nome', 'descricao', 'projeto',
  'cliente', 'lado', 'responsaveis', 'contato', 'status', 'aprovacao', 'prazo',
  'etiquetas', 'ordem', 'created',
  'expand.projeto.id', 'expand.projeto.nome', 'expand.projeto.tipo',
  'expand.cliente.id', 'expand.cliente.collectionId', 'expand.cliente.collectionName',
  'expand.cliente.nome', 'expand.cliente.nome_fantasia', 'expand.cliente.logo',
  'expand.responsaveis.id', 'expand.responsaveis.nome', 'expand.responsaveis.email',
  'expand.contato.id', 'expand.contato.nome', 'expand.contato.cargo',
].join(',');

interface ListOpts {
  busca?: string;
  projetoId?: string;
  clienteId?: string;
  status?: string;
  /** uid — quando definido, só tarefas onde o usuário é responsável. */
  responsavelId?: string;
  /** 'avulsas' = só tarefas sem projeto. */
  somenteAvulsas?: boolean;
}

export async function listTarefas(o: ListOpts = {}): Promise<Tarefa[]> {
  const filtros: string[] = [];
  const q = (o.busca ?? '').trim();
  if (q) {
    const safe = q.replace(/"/g, '');
    filtros.push(`(nome ~ "${safe}" || projeto.nome ~ "${safe}")`);
  }
  if (o.projetoId) filtros.push(`projeto = "${o.projetoId.replace(/"/g, '')}"`);
  if (o.clienteId) filtros.push(`cliente = "${o.clienteId.replace(/"/g, '')}"`);
  if (o.status) filtros.push(`status = "${o.status.replace(/"/g, '')}"`);
  if (o.responsavelId)
    filtros.push(`responsaveis.id ?= "${o.responsavelId.replace(/"/g, '')}"`);
  if (o.somenteAvulsas) filtros.push('projeto = ""');

  const opts: Record<string, unknown> = {
    sort: 'ordem,-created',
    fields: CAMPOS_LISTA,
    expand: EXPAND,
  };
  if (filtros.length) opts.filter = filtros.join(' && ');
  const res = await col().getList(1, 300, opts);
  return res.items as unknown as Tarefa[];
}

export async function getTarefa(id: string): Promise<Tarefa> {
  return (await col().getOne(id, { expand: EXPAND })) as unknown as Tarefa;
}

export async function criarTarefa(input: TarefaInput): Promise<Tarefa> {
  const uid = pb.authStore?.record?.id;
  const dados = { ...input, ...(uid ? { created_by: uid, updated_by: uid } : {}) };
  const rec = (await col().create(dados)) as unknown as Tarefa;
  await registrarHistorico('tarefa', rec.id, 'Tarefa criada');
  await notificar(input.responsaveis ?? [], {
    tipo: 'atribuicao',
    titulo: `Você foi atribuído à tarefa: ${rec.nome}`,
    link: `/tarefas/${rec.id}`,
  });
  return rec;
}

export async function atualizarTarefa(
  id: string,
  input: Partial<TarefaInput>,
): Promise<Tarefa> {
  const uid = pb.authStore?.record?.id;
  let antes: Record<string, unknown> | undefined;
  try {
    antes = (await col().getOne(id)) as unknown as Record<string, unknown>;
  } catch {
    /* */
  }
  const dados = { ...input, ...(uid ? { updated_by: uid } : {}) };
  const rec = (await col().update(id, dados)) as unknown as Tarefa;
  const mudancas = diffCampos(antes, input as Record<string, unknown>);
  if (mudancas.length) {
    await registrarHistorico('tarefa', id, `Alterou ${mudancas.join(' · ')}`);
  }
  // Notifica quem foi recém-adicionado como responsável.
  if (input.responsaveis) {
    const antesResp = (antes?.responsaveis as string[] | undefined) ?? [];
    const novos = input.responsaveis.filter((r) => !antesResp.includes(r));
    await notificar(novos, {
      tipo: 'atribuicao',
      titulo: `Você foi atribuído à tarefa: ${rec.nome}`,
      link: `/tarefas/${id}`,
    });
  }
  return rec;
}

export async function removerTarefa(id: string): Promise<void> {
  await col().delete(id);
}

/** Move uma tarefa para outro status (Kanban) e registra histórico. */
export async function moverTarefaStatus(
  id: string,
  status: string,
): Promise<Tarefa> {
  const rec = (await col().update(id, {
    status,
    ...(pb.authStore?.record?.id ? { updated_by: pb.authStore.record.id } : {}),
  })) as unknown as Tarefa;
  await registrarHistorico('tarefa', id, `Moveu para "${status}"`);
  return rec;
}

/** Marca a tarefa como concluída. */
export async function concluirTarefa(id: string, statusConcluido: string): Promise<Tarefa> {
  const rec = (await col().update(id, {
    status: statusConcluido,
    ...(pb.authStore?.record?.id ? { updated_by: pb.authStore.record.id } : {}),
  })) as unknown as Tarefa;
  await registrarHistorico('tarefa', id, 'Concluiu a tarefa');
  return rec;
}

/** Reabre uma tarefa concluída. */
export async function reabrirTarefa(id: string, statusAberto: string): Promise<Tarefa> {
  const rec = (await col().update(id, {
    status: statusAberto,
    ...(pb.authStore?.record?.id ? { updated_by: pb.authStore.record.id } : {}),
  })) as unknown as Tarefa;
  await registrarHistorico('tarefa', id, 'Reabriu a tarefa');
  return rec;
}

/** Equipe a notificar sobre o veredito de uma tarefa: responsáveis + gestão. */
async function alvosAprovacao(rec: Tarefa): Promise<string[]> {
  return [...(rec.responsaveis ?? []), ...(await idsGestao())];
}

/** Cliente aprova a tarefa — registra veredito + comentário no feed. */
export async function aprovarTarefa(id: string): Promise<Tarefa> {
  const rec = (await col().update(id, { aprovacao: 'aprovada' })) as unknown as Tarefa;
  await registrarHistorico('tarefa', id, 'Cliente aprovou a tarefa');
  try { await addComentario('tarefa', id, '✅ Cliente aprovou a tarefa.', false); } catch { /* */ }
  await notificar(await alvosAprovacao(rec), {
    tipo: 'aprovacao',
    titulo: `Cliente aprovou: ${rec.nome}`,
    link: `/tarefas/${id}`,
  });
  return rec;
}

/** Cliente pede alteração — exige um texto explicando o que mudar. */
export async function pedirAlteracaoTarefa(
  id: string,
  texto: string,
): Promise<Tarefa> {
  const t = texto.trim();
  if (!t) throw new Error('Explique o que precisa ser alterado');
  const rec = (await col().update(id, {
    aprovacao: 'alteracao',
    status: 'Em alteração',
  })) as unknown as Tarefa;
  await registrarHistorico('tarefa', id, 'Cliente pediu alteração');
  try { await addComentario('tarefa', id, `🔁 Alteração solicitada: ${t}`, false); } catch { /* */ }
  await notificar(await alvosAprovacao(rec), {
    tipo: 'alteracao',
    titulo: `Cliente pediu alteração: ${rec.nome}`,
    mensagem: t,
    link: `/tarefas/${id}`,
  });
  return rec;
}
