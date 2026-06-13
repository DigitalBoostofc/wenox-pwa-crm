import type { EtapaTarefa, Tarefa } from './types';
import { STATUS_INICIAL, STATUS_CONCLUIDO } from './status';

/* -------------------------------------------------------------------------- */
/*  Motor de etapas (funções puras) — fluxo sequencial com handoff            */
/* -------------------------------------------------------------------------- */

export function temEtapas(t?: Pick<Tarefa, 'etapas'>): boolean {
  return (t?.etapas?.length ?? 0) > 0;
}

/** Índice da etapa atual = primeira não concluída. -1 = todas feitas (ou vazio). */
export function etapaAtualIndex(etapas?: EtapaTarefa[]): number {
  if (!etapas?.length) return -1;
  return etapas.findIndex((e) => !e.feito);
}

export function etapaAtual(etapas?: EtapaTarefa[]): EtapaTarefa | null {
  const i = etapaAtualIndex(etapas);
  return i >= 0 ? etapas![i] : null;
}

/** true quando a etapa atual da tarefa é uma aprovação de cliente pendente. */
export function aguardandoAprovacaoCliente(t?: Pick<Tarefa, 'etapas'>): boolean {
  const e = etapaAtual(t?.etapas);
  return !!e && e.tipo === 'aprovacao_cliente';
}

export function progressoEtapas(etapas?: EtapaTarefa[]): { feitas: number; total: number } {
  const total = etapas?.length ?? 0;
  const feitas = (etapas ?? []).filter((e) => e.feito).length;
  return { feitas, total };
}

/**
 * Status derivado das etapas (só quando a tarefa TEM etapas).
 * - todas feitas → Concluído
 * - aprovacao = 'alteracao' → Em alteração
 * - etapa atual é aprovacao_cliente → Aguardando aprovação
 * - alguma feita → Em andamento; senão → Não iniciado
 */
export function statusDerivado(etapas: EtapaTarefa[], aprovacao?: string): string {
  const i = etapaAtualIndex(etapas);
  if (i === -1) return STATUS_CONCLUIDO;
  if (aprovacao === 'alteracao') return 'Em alteração';
  const atual = etapas[i];
  if (atual.tipo === 'aprovacao_cliente') return 'Aguardando aprovação';
  return etapas.some((e) => e.feito) ? 'Em andamento' : STATUS_INICIAL;
}

/** Tarefa em equipe = mais de um responsável (independe da qtd de etapas). */
export function tarefaEmEquipe(t?: Pick<Tarefa, 'responsaveis'>): boolean {
  return (t?.responsaveis?.length ?? 0) > 1;
}

/** É a vez deste usuário agir: etapa atual é interna e pertence a ele. */
export function ehVezDoUsuario(t: Pick<Tarefa, 'etapas'>, uid: string): boolean {
  const e = etapaAtual(t.etapas);
  return !!e && e.tipo === 'interna' && e.responsavel === uid;
}

/** Índice da etapa interna anterior a `aPartirDe` (para o "Revisar" voltar). -1 se não houver. */
export function indexEtapaInternaAnterior(etapas: EtapaTarefa[], aPartirDe: number): number {
  for (let i = aPartirDe - 1; i >= 0; i--) {
    if (etapas[i].tipo === 'interna') return i;
  }
  return -1;
}

/** Rótulo de "de quem é a vez" — usado na seção Aguardando. */
export function vezLabel(t: Pick<Tarefa, 'etapas'>, nomeDe: (id: string) => string): string {
  if (!temEtapas(t)) return '';
  const e = etapaAtual(t.etapas);
  if (!e) return '';
  if (e.tipo === 'aprovacao_cliente') return 'Aguardando aprovação do cliente';
  return e.responsavel ? `Vez de ${nomeDe(e.responsavel)}` : 'Etapa sem responsável';
}

/** Gera um id curto e estável para uma nova etapa. */
export function novaEtapaId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch { /* */ }
  return `et_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}
