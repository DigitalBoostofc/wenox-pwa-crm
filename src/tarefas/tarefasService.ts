import { pb } from '@/lib/pocketbase';
import {
  registrarHistorico, diffCampos, addComentario,
} from '@/atividade/atividadeService';
import { notificar, idsGestao } from '@/notificacoes/notificacoesService';
import type { Tarefa, TarefaInput, EtapaTarefa } from './types';
import { tarefaConcluida } from './format';
import { statusInicial, statusDoPapel } from './status';
import {
  temEtapas, etapaAtual, etapaAtualIndex, aguardandoAprovacaoCliente, statusDerivado,
  indexEtapaInternaAnterior,
} from './etapas';

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
  'id', 'collectionId', 'collectionName', 'nome', 'descricao', 'tipo', 'projeto',
  'cliente', 'lado', 'responsaveis', 'contato', 'status', 'aprovacao', 'prazo',
  'etiquetas', 'arquivada', 'ordem', 'created', 'updated', 'created_by', 'prioridade', 'checklist', 'recorrencia', 'concluida_em', 'etapas',
  'expand.projeto.id', 'expand.projeto.nome', 'expand.projeto.tipo',
  'expand.cliente.id', 'expand.cliente.collectionId', 'expand.cliente.collectionName',
  'expand.cliente.nome', 'expand.cliente.nome_fantasia', 'expand.cliente.logo',
  'expand.responsaveis.id', 'expand.responsaveis.nome', 'expand.responsaveis.email',
  'expand.responsaveis.foto', 'expand.responsaveis.collectionId', 'expand.responsaveis.collectionName',
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
      status: statusInicial(),
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
  if ((input.etapas?.length ?? 0) === 0 && (input.responsaveis?.length ?? 0) > 1) {
    throw new Error('Tarefa sem etapas pode ter apenas 1 responsável');
  }
  const uid = pb.authStore?.record?.id;
  // Se já nasce com etapas, o status é derivado do fluxo.
  const statusDerivadoInput = (input.etapas?.length ?? 0) > 0
    ? { status: statusDerivado(input.etapas!, input.aprovacao) }
    : {};
  const dados = { ...input, ...statusDerivadoInput, ...(uid ? { created_by: uid, updated_by: uid } : {}) };
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
  // Guard R3.c — validação direta no input (cobre bypass quando `antes` não pôde ser carregado).
  if (input.etapas?.length === 0 && (input.responsaveis?.length ?? 0) > 1) {
    throw new Error('Tarefa sem etapas pode ter apenas 1 responsável');
  }
  // Guard R3.c — validação no estado mergeado para updates parciais (um campo de cada vez).
  if (antes !== undefined && (input.etapas !== undefined || input.responsaveis !== undefined)) {
    const resultEtapas = (input.etapas !== undefined
      ? input.etapas
      : (antes.etapas as unknown[] | undefined) ?? []) as unknown[];
    const resultResp = (input.responsaveis !== undefined
      ? input.responsaveis
      : (antes.responsaveis as string[] | undefined) ?? []) as string[];
    if (resultEtapas.length === 0 && resultResp.length > 1) {
      throw new Error('Tarefa sem etapas pode ter apenas 1 responsável');
    }
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
  // Limpeza em cascata dos órfãos (comentarios/historico/notificacoes + desvínculo de listas)
  // é feita pelo hook server-side pb_hooks/tarefas_cascade.pb.js.
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

/* -------------------------------------------------------------------------- */
/*  Fluxo de etapas (Fase 2)                                                   */
/* -------------------------------------------------------------------------- */

/** Notifica o responsável da etapa atual (handoff "sua vez"). */
async function notificarVezDaEtapa(rec: Tarefa): Promise<void> {
  const atual = etapaAtual(rec.etapas);
  if (!atual || atual.tipo === 'aprovacao_cliente' || !atual.responsavel) return;
  try {
    await notificar([atual.responsavel], {
      tipo: 'atribuicao',
      titulo: `Sua vez na tarefa: ${rec.nome}`,
      mensagem: atual.texto,
      link: `/tarefas/${rec.id}`,
    });
  } catch { /* notificação é best-effort */ }
}

/**
 * Persiste as etapas derivando status + concluida_em, e faz o handoff
 * (notifica o novo responsável quando a etapa atual muda). `extra` permite
 * gravar campos adicionais (ex.: aprovacao) — usado no fluxo do cliente.
 */
export async function salvarEtapas(
  rec: Tarefa,
  etapas: EtapaTarefa[],
  extra: Record<string, unknown> = {},
  notificarHandoff = true,
): Promise<Tarefa> {
  const antesAtual = etapaAtual(rec.etapas);
  const aprovacao = ('aprovacao' in extra ? extra.aprovacao : rec.aprovacao) as string | undefined;
  const tudoFeito = etapas.length > 0 && etapaAtualIndex(etapas) === -1;
  const dados: Record<string, unknown> = {
    etapas,
    status: statusDerivado(etapas, aprovacao),
    concluida_em: tudoFeito ? carimboConclusao() : '',
    ...extra,
    ...(pb.authStore?.record?.id ? { updated_by: pb.authStore.record.id } : {}),
  };
  const atualizado = (await col().update(rec.id, dados)) as unknown as Tarefa;
  const depoisAtual = etapaAtual(etapas);
  if (notificarHandoff && depoisAtual && depoisAtual.id !== antesAtual?.id) {
    await notificarVezDaEtapa(atualizado);
  }
  if (tudoFeito && !tarefaConcluida(rec.status)) {
    await criarProximaOcorrencia(rec);
  }
  return atualizado;
}

/** Conclui uma etapa (pelo responsável/gestor) e avança o fluxo. */
export async function concluirEtapa(rec: Tarefa, etapaId: string): Promise<Tarefa> {
  const uid = pb.authStore?.record?.id ?? '';
  const alvo = rec.etapas?.find((e) => e.id === etapaId);
  const etapas = (rec.etapas ?? []).map((e) =>
    e.id === etapaId ? { ...e, feito: true, feito_por: uid, feito_em: carimboConclusao() } : e,
  );
  // Concluir uma etapa interna limpa eventual flag de alteração.
  const r = await salvarEtapas(rec, etapas, { aprovacao: '' });
  await registrarHistorico('tarefa', rec.id, `Concluiu a etapa: ${alvo?.texto ?? ''}`);
  return r;
}

/** Reabre (desmarca) uma etapa concluída. */
export async function reabrirEtapa(rec: Tarefa, etapaId: string): Promise<Tarefa> {
  const etapas = (rec.etapas ?? []).map((e) =>
    e.id === etapaId ? { ...e, feito: false, feito_por: '', feito_em: '' } : e,
  );
  return salvarEtapas(rec, etapas);
}

/** Responsável reenvia a etapa de aprovação para o cliente (após alteração). */
export async function reenviarAprovacao(rec: Tarefa): Promise<Tarefa> {
  const r = await salvarEtapas(rec, rec.etapas ?? [], { aprovacao: '' });
  await registrarHistorico('tarefa', rec.id, 'Reenviou para aprovação do cliente');
  return r;
}

/* -------------------------------------------------------------------------- */
/*  Veredito do cliente (com ou sem etapas)                                    */
/* -------------------------------------------------------------------------- */

/** Cliente aprova — avança a etapa de aprovação (se houver) ou a tarefa toda. */
export async function aprovarTarefa(id: string): Promise<Tarefa> {
  const rec = (await col().getOne(id)) as unknown as Tarefa;

  if (temEtapas(rec) && aguardandoAprovacaoCliente(rec)) {
    const atual = etapaAtual(rec.etapas)!;
    const etapas = rec.etapas!.map((e) =>
      e.id === atual.id ? { ...e, feito: true, feito_por: 'cliente', feito_em: carimboConclusao() } : e,
    );
    const r = await salvarEtapas(rec, etapas, { aprovacao: '' });
    await registrarHistorico('tarefa', id, `Cliente aprovou a etapa: ${atual.texto}`);
    try { await addComentario('tarefa', id, `✅ Cliente aprovou: ${atual.texto}`, false); } catch { /* */ }
    await notificar(await alvosAprovacao(r), {
      tipo: 'aprovacao',
      titulo: `Cliente aprovou: ${r.nome}`,
      link: `/tarefas/${id}`,
    });
    return r;
  }

  const rec2 = (await col().update(id, { aprovacao: 'aprovada' })) as unknown as Tarefa;
  await registrarHistorico('tarefa', id, 'Cliente aprovou a tarefa');
  try { await addComentario('tarefa', id, '✅ Cliente aprovou a tarefa.', false); } catch { /* */ }
  await notificar(await alvosAprovacao(rec2), {
    tipo: 'aprovacao',
    titulo: `Cliente aprovou: ${rec2.nome}`,
    link: `/tarefas/${id}`,
  });
  return rec2;
}

/** Cliente pede alteração — exige um texto explicando o que mudar. */
export async function pedirAlteracaoTarefa(
  id: string,
  texto: string,
): Promise<Tarefa> {
  const t = texto.trim();
  if (!t) throw new Error('Explique o que precisa ser alterado');
  const rec = (await col().getOne(id)) as unknown as Tarefa;

  if (temEtapas(rec) && aguardandoAprovacaoCliente(rec)) {
    // "Revisar": volta para a etapa interna anterior (quem fez o trabalho), que
    // vira a etapa atual e é notificado; status deriva para "Em alteração".
    const idxAprov = etapaAtualIndex(rec.etapas!);
    const idxVolta = indexEtapaInternaAnterior(rec.etapas!, idxAprov);
    const etapas = idxVolta >= 0
      ? rec.etapas!.map((e, i) => (i === idxVolta ? { ...e, feito: false, feito_por: '', feito_em: '' } : e))
      : rec.etapas!;
    const r = await salvarEtapas(rec, etapas, { aprovacao: 'alteracao' }, false);
    await registrarHistorico('tarefa', id, 'Cliente pediu revisão');
    try { await addComentario('tarefa', id, `🔁 Revisão solicitada: ${t}`, false); } catch { /* */ }
    const responsavelEtapa = idxVolta >= 0 ? etapas[idxVolta].responsavel : undefined;
    const alvos = responsavelEtapa ? [responsavelEtapa] : await alvosAprovacao(r);
    await notificar(alvos, {
      tipo: 'alteracao',
      titulo: `Cliente pediu revisão: ${r.nome}`,
      mensagem: t,
      link: `/tarefas/${id}`,
    });
    return r;
  }

  const rec2 = (await col().update(id, {
    aprovacao: 'alteracao',
    status: statusDoPapel('em_alteracao') ?? 'Em alteração',
  })) as unknown as Tarefa;
  await registrarHistorico('tarefa', id, 'Cliente pediu alteração');
  try { await addComentario('tarefa', id, `🔁 Alteração solicitada: ${t}`, false); } catch { /* */ }
  await notificar(await alvosAprovacao(rec2), {
    tipo: 'alteracao',
    titulo: `Cliente pediu alteração: ${rec2.nome}`,
    mensagem: t,
    link: `/tarefas/${id}`,
  });
  return rec2;
}
