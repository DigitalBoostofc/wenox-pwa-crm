import { pb } from '@/lib/pocketbase';
import {
  registrarHistorico, diffCampos, addComentario,
} from '@/atividade/atividadeService';
import { notificar, idsGestao } from '@/notificacoes/notificacoesService';
import type { Tarefa, TarefaInput, EtapaTarefa } from './types';
import { tarefaConcluida } from './format';
import {
  opcaoInicial, opcaoConcluido, opcaoEhConclusiva, espelhoStatus,
  opcaoPorId, responsavelDaOpcao,
} from './status';
import {
  temEtapas, etapaAtual, etapaAtualIndex, aguardandoAprovacaoCliente,
  indexEtapaInternaAnterior, novaEtapaId,
} from './etapas';

const col = () => pb.collection('tarefas');

/** Conclusão no modelo manual: por opção (grupo "feito") ou, no legado, por nome. */
function estaConcluida(opcaoId?: string, statusNome?: string): boolean {
  if (opcaoId) return opcaoEhConclusiva(opcaoId);
  return tarefaConcluida(statusNome);
}

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
  'cliente', 'lado', 'responsaveis', 'contato', 'status', 'status_opcao', 'aprovacao', 'data_inicio', 'prazo',
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

/** Janela do mês de PRODUÇÃO (início = dia 1, fim = último dia) a partir de
 *  uma data base. Usada por tarefas Social Media (produção referente ao mês seguinte). */
export function janelaMesProducao(base = new Date()): { data_inicio: string; prazo: string } {
  const ano = base.getFullYear();
  const mes = base.getMonth(); // 0-based = mês de produção (atual)
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const fmt = (d: number) => `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { data_inicio: fmt(1), prazo: fmt(ultimoDia) };
}

/** Cria a próxima ocorrência de uma tarefa recorrente. Engole erros para não
 *  interromper a conclusão da tarefa original.
 *  Social Media é gerada pelo robô n8n agendado (dia 1) — NÃO gera aqui p/ não duplicar. */
async function criarProximaOcorrencia(t: Tarefa): Promise<void> {
  if (t.tipo === 'Social Media') return;
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
  const filtros: string[] = ['arquivada != true'];
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
  // Toda tarefa nasce com pelo menos 1 etapa: se não vierem etapas, cria uma
  // etapa única ("Tarefa") atribuída ao 1º responsável (single-step).
  const etapas: EtapaTarefa[] = (input.etapas?.length ?? 0) > 0
    ? input.etapas!
    : [{ id: novaEtapaId(), texto: 'Tarefa', tipo: 'interna', responsavel: input.responsaveis?.[0], feito: false }];
  // Status MANUAL (F2): nasce na opção inicial (salvo se o form já trouxe uma).
  // As etapas viram checklist informativo — não derivam mais o status.
  // Social Media nasce recorrente mensal com janela do mês de produção (dia 1 → último dia),
  // referente ao mês seguinte. Novas ocorrências são criadas pelo robô n8n no dia 1.
  const smDefaults = input.tipo === 'Social Media' && !input.data_inicio ? janelaMesProducao() : null;
  const prazo = etapaAtual(etapas)?.prazo ?? input.prazo ?? smDefaults?.prazo ?? '';
  const opcaoId = input.status_opcao || opcaoInicial()?.id || '';
  const espelho = opcaoId ? espelhoStatus(opcaoId) : {};
  const dados = {
    ...input, etapas, prazo, ...espelho,
    ...(smDefaults ? { data_inicio: smDefaults.data_inicio, recorrencia: input.recorrencia || 'mensal' } : {}),
    ...(uid ? { created_by: uid, updated_by: uid } : {}),
  };
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
  // (Guard R3.c removido: etapas saíram do MVP — múltiplos responsáveis são livres.)
  const dados: Record<string, unknown> = { ...input, ...(uid ? { updated_by: uid } : {}) };
  const antesConcluida = estaConcluida(antes?.status_opcao as string | undefined, antes?.status as string | undefined);
  if (input.status_opcao !== undefined) {
    // Modelo manual: a opção é a fonte de verdade; espelha o nome e ajusta a conclusão.
    dados.status = espelhoStatus(input.status_opcao).status;
    const agoraConcluida = opcaoEhConclusiva(input.status_opcao);
    if (agoraConcluida && !antesConcluida) dados.concluida_em = carimboConclusao();
    else if (!agoraConcluida && antesConcluida) dados.concluida_em = '';
  } else if (input.status !== undefined) {
    if (tarefaConcluida(input.status) && !antesConcluida) {
      dados.concluida_em = carimboConclusao();
    } else if (!tarefaConcluida(input.status) && antesConcluida) {
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
  // Notifica o responsável designado do status quando a opção muda.
  if (input.status_opcao !== undefined && input.status_opcao !== (antes?.status_opcao as string | undefined)) {
    await notificarResponsavelDoStatus(id, rec.nome, input.status_opcao);
  } else if (
    input.status !== undefined &&
    input.status_opcao === undefined &&
    input.status !== (antes?.status as string | undefined)
  ) {
    const dest = responsavelDaOpcao(undefined, input.status);
    if (dest) {
      await notificar([dest], {
        tipo: 'atribuicao',
        titulo: `Tarefa em "${input.status}": ${rec.nome}`,
        mensagem: `A tarefa passou para o status ${input.status}.`,
        link: `/tarefas/${id}`,
      });
    }
  }
  // Dispara recorrência na transição não-concluída → concluída via edição de campo.
  const agoraConcluida = input.status_opcao !== undefined
    ? opcaoEhConclusiva(input.status_opcao)
    : (input.status !== undefined ? tarefaConcluida(input.status) : undefined);
  if (agoraConcluida === true && antes && !antesConcluida) {
    await criarProximaOcorrencia(antes as unknown as Tarefa);
  }
  return rec;
}

/** Notifica o membro designado na opção de status (best-effort). */
async function notificarResponsavelDoStatus(
  tarefaId: string,
  nomeTarefa: string,
  opcaoId: string,
): Promise<void> {
  const op = opcaoPorId(opcaoId);
  const dest = op?.responsavel;
  if (!dest) return;
  const rotulo = op?.nome || 'novo status';
  await notificar([dest], {
    tipo: 'atribuicao',
    titulo: `Tarefa em "${rotulo}": ${nomeTarefa}`,
    mensagem: `A tarefa passou para o status ${rotulo}.`,
    link: `/tarefas/${tarefaId}`,
  });
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

/** Move a tarefa para uma OPÇÃO de status (Kanban manual) e registra histórico.
 *  Fonte de verdade = status_opcao; grava o espelho legado `status` (nome). */
export async function moverTarefaOpcao(id: string, opcaoId: string): Promise<Tarefa> {
  const concl = opcaoEhConclusiva(opcaoId);
  let antes: Tarefa | undefined;
  try { antes = (await col().getOne(id)) as unknown as Tarefa; } catch { /* */ }
  const esp = espelhoStatus(opcaoId);
  const rec = (await col().update(id, {
    ...esp,
    concluida_em: concl ? carimboConclusao() : '',
    ...(pb.authStore?.record?.id ? { updated_by: pb.authStore.record.id } : {}),
  })) as unknown as Tarefa;
  await registrarHistorico('tarefa', id, `Moveu para "${esp.status}"`);
  if (antes?.status_opcao !== opcaoId) {
    await notificarResponsavelDoStatus(id, rec.nome, opcaoId);
  }
  if (concl && antes && !estaConcluida(antes.status_opcao, antes.status)) {
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
    status_opcao: opcaoConcluido()?.id ?? '',
    concluida_em: carimboConclusao(),
    ...(pb.authStore?.record?.id ? { updated_by: pb.authStore.record.id } : {}),
  })) as unknown as Tarefa;
  await registrarHistorico('tarefa', id, 'Concluiu a tarefa');
  if (antes && !estaConcluida(antes.status_opcao, antes.status)) {
    await criarProximaOcorrencia(antes);
  }
  return rec;
}

/** Reabre uma tarefa concluída. */
export async function reabrirTarefa(id: string, statusAberto: string): Promise<Tarefa> {
  const rec = (await col().update(id, {
    status: statusAberto,
    status_opcao: opcaoInicial()?.id ?? '',
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
 * Persiste as etapas (checklist informativo — F2) e faz o handoff (notifica o
 * novo responsável quando a etapa atual muda). As etapas NÃO derivam mais o
 * status nem a conclusão da tarefa (status é manual). `extra` permite gravar
 * campos adicionais (ex.: aprovacao) — usado no fluxo do cliente.
 */
export async function salvarEtapas(
  rec: Tarefa,
  etapas: EtapaTarefa[],
  extra: Record<string, unknown> = {},
  notificarHandoff = true,
): Promise<Tarefa> {
  const antesAtual = etapaAtual(rec.etapas);
  // Prazo da tarefa = prazo da etapa atual (com fallback p/ o prazo existente
  // quando a etapa não tem data — não zera tarefas sem deadline por etapa).
  const prazoAtual = etapaAtual(etapas)?.prazo ?? rec.prazo ?? '';
  const dados: Record<string, unknown> = {
    etapas,
    prazo: prazoAtual,
    ...extra,
    ...(pb.authStore?.record?.id ? { updated_by: pb.authStore.record.id } : {}),
  };
  const atualizado = (await col().update(rec.id, dados)) as unknown as Tarefa;
  const depoisAtual = etapaAtual(etapas);
  if (notificarHandoff && depoisAtual && depoisAtual.id !== antesAtual?.id) {
    await notificarVezDaEtapa(atualizado);
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

  // Status é manual (F2): o pedido de alteração marca a flag de aprovação
  // (informativa), sem forçar uma opção de status.
  const rec2 = (await col().update(id, {
    aprovacao: 'alteracao',
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
