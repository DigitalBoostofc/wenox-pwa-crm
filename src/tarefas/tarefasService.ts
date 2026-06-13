import { pb } from '@/lib/pocketbase';
import {
  registrarHistorico, diffCampos, addComentario,
} from '@/atividade/atividadeService';
import { notificar, idsGestao } from '@/notificacoes/notificacoesService';
import type { Tarefa, TarefaInput } from './types';
import { tarefaConcluida } from './format';
import { STATUS_INICIAL } from './status';

const col = () => pb.collection('tarefas');

function carimboConclusao(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-') + ' ' + [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join(':');
}

const EXPAND = 'projeto,cliente,responsaveis,contato';
const CAMPOS_LISTA = [
  'id', 'collectionId', 'collectionName', 'nome', 'descricao', 'projeto',
  'cliente', 'lado', 'responsaveis', 'contato', 'status', 'aprovacao', 'prazo',
  'etiquetas', 'ordem', 'created', 'updated', 'prioridade', 'checklist', 'recorrencia', 'concluida_em',
  'expand.projeto.id', 'expand.projeto.nome', 'expand.projeto.tipo',
  'expand.cliente.id', 'expand.cliente.collectionId', 'expand.cliente.collectionName',
  'expand.cliente.nome', 'expand.cliente.nome_fantasia', 'expand.cliente.logo',
  'expand.responsaveis.id', 'expand.responsaveis.nome', 'expand.responsaveis.email',
  'expand.contato.id', 'expand.contato.nome', 'expand.contato.cargo',
].join(',');

/* -------------------------------------------------------------------------- */
/*  Recorrência                                                                */
/* -------------------------------------------------------------------------- */

/** Calcula o próximo prazo a partir das PARTES da data (sem desvio de fuso). */
function proximoPrazo(prazo: string, rec: string): string {
  const [ano, mes, dia] = prazo.slice(0, 10).split('-').map(Number);
  let d: Date;
  if (rec === 'semanal') {
    d = new Date(ano, mes - 1, dia + 7);
  } else if (rec === 'quinzenal') {
    d = new Date(ano, mes - 1, dia + 14);
  } else {
    // mensal: +1 mês, dia clampado ao último do mês alvo
    const mesAlvo0 = mes % 12; // próximo mês em índice 0
    const anoAlvo = mes === 12 ? ano + 1 : ano;
    const ultimoDia = new Date(anoAlvo, mesAlvo0 + 1, 0).getDate();
    d = new Date(anoAlvo, mesAlvo0, Math.min(dia, ultimoDia));
  }
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Cria a próxima ocorrência de uma tarefa recorrente. Engole erros para não
 *  interromper a conclusão da tarefa original. */
async function criarProximaOcorrencia(t: Tarefa): Promise<void> {
  if (!t.recorrencia || !t.prazo) return;
  try {
    const input: TarefaInput = {
      nome: t.nome,
      descricao: t.descricao,
      projeto: t.projeto ?? '',
      cliente: t.cliente ?? '',
      lado: t.lado ?? 'wenox',
      responsaveis: t.responsaveis ?? [],
      contato: t.contato ?? '',
      etiquetas: t.etiquetas ?? [],
      prioridade: t.prioridade,
      recorrencia: t.recorrencia,
      ordem: t.ordem ?? 0,
      checklist: (t.checklist ?? []).map((item) => ({ ...item, feito: false })),
      status: STATUS_INICIAL,
      prazo: proximoPrazo(t.prazo, t.recorrencia),
    };
    await criarTarefa(input);
    await registrarHistorico('tarefa', t.id, 'Recorrência: próxima ocorrência criada');
  } catch { /* recorrência nunca pode quebrar a conclusão */ }
}

/* -------------------------------------------------------------------------- */

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
  const dados: Record<string, unknown> = { ...input, ...(uid ? { updated_by: uid } : {}) };
  if (input.status !== undefined) {
    if (tarefaConcluida(input.status) && !tarefaConcluida(antes?.status as string | undefined)) {
      dados.concluida_em = carimboConclusao();
    } else if (!tarefaConcluida(input.status) && tarefaConcluida(antes?.status as string | undefined)) {
      dados.concluida_em = '';
    }
  }
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
  // Dispara recorrência na transição não-concluída → concluída via edição de campo.
  if (
    input.status !== undefined &&
    tarefaConcluida(input.status) &&
    antes && !tarefaConcluida(antes.status as string | undefined)
  ) {
    await criarProximaOcorrencia(antes as unknown as Tarefa);
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
  // Busca antes apenas quando o destino é concluído, para detectar transição.
  let antes: Tarefa | undefined;
  if (tarefaConcluida(status)) {
    try { antes = (await col().getOne(id)) as unknown as Tarefa; } catch { /* */ }
  }
  const rec = (await col().update(id, {
    status,
    concluida_em: tarefaConcluida(status) ? carimboConclusao() : '',
    ...(pb.authStore?.record?.id ? { updated_by: pb.authStore.record.id } : {}),
  })) as unknown as Tarefa;
  await registrarHistorico('tarefa', id, `Moveu para "${status}"`);
  if (antes && !tarefaConcluida(antes.status)) {
    await criarProximaOcorrencia(antes);
  }
  return rec;
}

/** Marca a tarefa como concluída. */
export async function concluirTarefa(id: string, statusConcluido: string): Promise<Tarefa> {
  let antes: Tarefa | undefined;
  try { antes = (await col().getOne(id)) as unknown as Tarefa; } catch { /* */ }
  const rec = (await col().update(id, {
    status: statusConcluido,
    concluida_em: carimboConclusao(),
    ...(pb.authStore?.record?.id ? { updated_by: pb.authStore.record.id } : {}),
  })) as unknown as Tarefa;
  await registrarHistorico('tarefa', id, 'Concluiu a tarefa');
  if (antes && !tarefaConcluida(antes.status)) {
    await criarProximaOcorrencia(antes);
  }
  return rec;
}

/** Reabre uma tarefa concluída. */
export async function reabrirTarefa(id: string, statusAberto: string): Promise<Tarefa> {
  const rec = (await col().update(id, {
    status: statusAberto,
    concluida_em: '',
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
