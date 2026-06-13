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
 * - alguma feita → Fazendo; senão → A fazer
 */
export function statusDerivado(etapas: EtapaTarefa[], aprovacao?: string): string {
  const i = etapaAtualIndex(etapas);
  if (i === -1) return STATUS_CONCLUIDO;
  if (aprovacao === 'alteracao') return 'Em alteração';
  const atual = etapas[i];
  if (atual.tipo === 'aprovacao_cliente') return 'Aguardando aprovação';
  return etapas.some((e) => e.feito) ? 'Fazendo' : STATUS_INICIAL;
}

/** Gera um id curto e estável para uma nova etapa. */
export function novaEtapaId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch { /* */ }
  return `et_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}
