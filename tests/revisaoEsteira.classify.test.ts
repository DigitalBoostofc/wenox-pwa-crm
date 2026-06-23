/**
 * Testes das funções puras de indexação por-post da esteira de revisão
 * (src/quadros/types.ts): papelDaEtapa (fallback posicional), sessionIndex e classify.
 * Espelham o backend — ver docs/esteira-revisao-layout-contract.md §9.
 */
import { describe, it, expect } from 'vitest';
import { papelDaEtapa, sessionIndex, classify } from '@/quadros/types';
import type { Papel } from '@/quadros/types';

type E = { papel?: Papel; texto?: string; feito: boolean; veredito?: 'aprovado' | 'reprovado'; motivo?: string };

/** Etapa de teste (texto default '' p/ exercitar o fallback por papel/posição). */
const e = (papel: Papel | undefined, feito: boolean, extra: Partial<E> = {}): E => ({
  papel,
  texto: '',
  feito,
  ...extra,
});

// Esteira inicial de 5 etapas, parametrizada por quais estão feitas.
const esteira5 = (feitos: number, extra: Partial<E>[] = []): E[] =>
  (['copy', 'layout', 'revisao', 'aprovacao_cliente', 'agendamento'] as Papel[]).map((papel, i) =>
    e(papel, i < feitos, extra[i] ?? {}),
  );

describe('papelDaEtapa — fallback por papel, texto e POSICIONAL', () => {
  it('usa o campo papel quando presente (vence o texto)', () => {
    expect(papelDaEtapa({ papel: 'agendamento', texto: 'qualquer' })).toBe('agendamento');
  });

  it('deriva do texto quando não há papel', () => {
    expect(papelDaEtapa({ texto: 'Copy' })).toBe('copy');
    expect(papelDaEtapa({ texto: 'Revisão Layout 3' })).toBe('revisao_layout');
    expect(papelDaEtapa({ texto: 'Aprovação do cliente 2' })).toBe('aprovacao_cliente');
  });

  it('texto desconhecido sem índice → default conservador "revisao"', () => {
    expect(papelDaEtapa({ texto: '???' })).toBe('revisao');
  });

  it('texto desconhecido COM índice → POSICIONAL POS[i]', () => {
    expect(papelDaEtapa({ texto: '???' }, 0)).toBe('copy');
    expect(papelDaEtapa({ texto: '???' }, 1)).toBe('layout');
    expect(papelDaEtapa({ texto: '???' }, 3)).toBe('aprovacao_cliente');
    expect(papelDaEtapa({ texto: '???' }, 4)).toBe('agendamento');
  });

  it('índice fora do mapa posicional → default "revisao"', () => {
    expect(papelDaEtapa({ texto: '???' }, 9)).toBe('revisao');
  });
});

describe('sessionIndex — idx acionável por sessão', () => {
  it('esteira de 5, sessão revisao → idx 2 (== idxEtapa global do caminho feliz)', () => {
    expect(sessionIndex(esteira5(2), 'revisao')).toBe(2);
  });

  it('sessão agendamento, 4 feitas → idx 4', () => {
    expect(sessionIndex(esteira5(4), 'agendamento')).toBe(4);
  });

  it('post ainda em produção (1ª não-feita é copy) → -1 (não acionável)', () => {
    expect(sessionIndex(esteira5(0), 'revisao')).toBe(-1);
  });

  it('1ª não-feita é gate de OUTRA sessão → -1', () => {
    // revisao já feita; pendente = aprovacao_cliente; sessão = revisao
    expect(sessionIndex(esteira5(3), 'revisao')).toBe(-1);
  });

  it('esteira concluída (tudo feito) → -1', () => {
    expect(sessionIndex(esteira5(5), 'agendamento')).toBe(-1);
  });

  it('reprovado estrutural (revisao_layout pendente) → -1 (NÃO postar)', () => {
    const ec: E[] = [
      e('copy', true),
      e('layout', true),
      e('revisao', true, { veredito: 'reprovado', motivo: 'trocar cor' }),
      e('revisao_layout', false),
      e('revisao', false, { texto: 'Revisão interna 2' }),
    ];
    expect(sessionIndex(ec, 'revisao')).toBe(-1);
  });
});

describe('classify — estado do post na sessão', () => {
  it('PENDENTE: gate da sessão é a 1ª não-feita', () => {
    expect(classify(esteira5(2), 'revisao')).toEqual({ state: 'PENDENTE', idx: 2 });
  });

  it('EM_PRODUCAO: 1ª não-feita é etapa não-gate (copy/layout)', () => {
    expect(classify(esteira5(0), 'revisao')).toEqual({ state: 'EM_PRODUCAO' });
  });

  it('ADIANTE: 1ª não-feita é gate de outra sessão', () => {
    expect(classify(esteira5(3), 'revisao')).toEqual({ state: 'ADIANTE' });
  });

  it('CONCLUIDO: nenhuma etapa pendente', () => {
    expect(classify(esteira5(5), 'agendamento')).toEqual({ state: 'CONCLUIDO' });
  });

  it('REPROVADO: revisao_layout logo após o gate DESTA sessão reprovado (com motivo)', () => {
    const ec: E[] = [
      e('copy', true),
      e('layout', true),
      e('revisao', true, { veredito: 'reprovado', motivo: 'trocar cor' }),
      e('revisao_layout', false),
      e('revisao', false, { texto: 'Revisão interna 2' }),
    ];
    expect(classify(ec, 'revisao')).toEqual({ state: 'REPROVADO', idx: 2, motivo: 'trocar cor' });
  });

  it('RETRABALHO_OUTRO: revisao_layout de retrabalho de OUTRA sessão', () => {
    // o gate reprovado acima da revisao_layout é aprovacao_cliente, não revisao
    const ec: E[] = [
      e('copy', true),
      e('layout', true),
      e('revisao', true, { veredito: 'aprovado' }),
      e('aprovacao_cliente', true, { veredito: 'reprovado', motivo: 'cliente pediu' }),
      e('revisao_layout', false),
      e('aprovacao_cliente', false, { texto: 'Aprovação do cliente 2' }),
    ];
    expect(classify(ec, 'revisao')).toEqual({ state: 'RETRABALHO_OUTRO' });
    // mas para a sessão de aprovacao_cliente, o mesmo card é REPROVADO
    expect(classify(ec, 'aprovacao_cliente')).toEqual({
      state: 'REPROVADO',
      idx: 3,
      motivo: 'cliente pediu',
    });
  });
});
