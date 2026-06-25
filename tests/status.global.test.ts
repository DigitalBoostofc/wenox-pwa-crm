import { describe, it, expect } from 'vitest';
import {
  opcaoInicial, opcaoConcluido, opcaoEhConclusiva, opcaoIdPorNome,
  resolverOpcao, espelhoStatus, corOpcaoClass, grupoDaOpcao,
  opcoesEmOrdemDeColuna, CORES_STATUS,
  resolverOpcaoCard, statusPostDaOpcao, opcaoIdDoStatusPost,
} from '@/tarefas/status';

/* Sem config remota/localStorage no teste → usa DEFAULT_STATUS_GLOBAL (seed v1):
 * grupos g_a_fazer / g_andamento / g_concluido; opções op_* conhecidas. */

describe('status global — helpers (modelo grupos+opções)', () => {
  it('opcaoInicial é a 1ª opção na ordem de coluna (Não iniciado)', () => {
    expect(opcaoInicial()?.id).toBe('op_nao_iniciado');
  });

  it('opcaoConcluido é a 1ª opção do último grupo (Concluído)', () => {
    expect(opcaoConcluido()?.id).toBe('op_concluido');
  });

  it('opcaoEhConclusiva = true só para opções do último grupo', () => {
    expect(opcaoEhConclusiva('op_concluido')).toBe(true);
    expect(opcaoEhConclusiva('op_agendado')).toBe(true);   // mesmo grupo "feito"
    expect(opcaoEhConclusiva('op_postado')).toBe(true);
    expect(opcaoEhConclusiva('op_em_andamento')).toBe(false);
    expect(opcaoEhConclusiva('op_nao_iniciado')).toBe(false);
    expect(opcaoEhConclusiva(undefined)).toBe(false);
    expect(opcaoEhConclusiva('id_inexistente')).toBe(false);
  });

  it('opcaoIdPorNome resolve por nome (case-insensitive, trim)', () => {
    expect(opcaoIdPorNome('Em andamento')).toBe('op_em_andamento');
    expect(opcaoIdPorNome('  em ALTERAÇÃO ')).toBe('op_em_alteracao');
    expect(opcaoIdPorNome('inexistente')).toBeUndefined();
    expect(opcaoIdPorNome(undefined)).toBeUndefined();
  });

  it('resolverOpcao prefere o id; cai no nome legado', () => {
    expect(resolverOpcao('op_agendar')?.id).toBe('op_agendar');
    expect(resolverOpcao(undefined, 'Concluído')?.id).toBe('op_concluido');
    expect(resolverOpcao('id_ruim', 'Em andamento')?.id).toBe('op_em_andamento');
    expect(resolverOpcao(undefined, undefined)).toBeUndefined();
  });

  it('espelhoStatus devolve o id + o nome legado equivalente', () => {
    expect(espelhoStatus('op_em_alteracao')).toEqual({
      status_opcao: 'op_em_alteracao',
      status: 'Em alteração',
    });
  });

  it('corOpcaoClass usa a cor da opção', () => {
    expect(corOpcaoClass('op_em_andamento')).toBe(CORES_STATUS.azul);
    expect(corOpcaoClass('op_concluido')).toBe(CORES_STATUS.verde);
    expect(corOpcaoClass('id_inexistente')).toBe('');
  });

  it('grupoDaOpcao retorna o grupo dono da opção', () => {
    expect(grupoDaOpcao('op_postado')?.id).toBe('g_concluido');
    expect(grupoDaOpcao('op_nao_iniciado')?.id).toBe('g_a_fazer');
  });

  it('opcoesEmOrdemDeColuna respeita ordem de grupo e de opção', () => {
    const ids = opcoesEmOrdemDeColuna().map((o) => o.id);
    expect(ids[0]).toBe('op_nao_iniciado');         // 1º grupo, 1ª opção
    expect(ids[ids.length - 1]).toBe('op_postado'); // último grupo, última opção
    // todas as 9 opções do seed
    expect(ids).toHaveLength(9);
  });
});

describe('status global — espelho de POSTS (status_post)', () => {
  it('statusPostDaOpcao mapeia as 5 opções de post; vazio p/ não-post', () => {
    expect(statusPostDaOpcao('op_agendado')).toBe('agendado');
    expect(statusPostDaOpcao('op_em_alteracao')).toBe('em_alteracao');
    expect(statusPostDaOpcao('op_aguardando')).toBe(''); // não é opção de post
    expect(statusPostDaOpcao(undefined)).toBe('');
  });

  it('opcaoIdDoStatusPost faz o caminho inverso', () => {
    expect(opcaoIdDoStatusPost('agendado')).toBe('op_agendado');
    expect(opcaoIdDoStatusPost('postado')).toBe('op_postado');
    expect(opcaoIdDoStatusPost('')).toBeUndefined();
  });

  it('resolverOpcaoCard PREFERE o status_post conhecido (sinal mais fresco na transição)', () => {
    // n8n mudou status_post sem tocar status_opcao (defasado) → prevalece o legado
    expect(resolverOpcaoCard('op_em_producao', 'agendado')?.id).toBe('op_agendado');
    // ambos coerentes
    expect(resolverOpcaoCard('op_agendado', 'agendado')?.id).toBe('op_agendado');
    // só legado (card pré-F3)
    expect(resolverOpcaoCard(undefined, 'postado')?.id).toBe('op_postado');
  });

  it('resolverOpcaoCard cai no status_opcao quando o legado é vazio/desconhecido', () => {
    // opção manual não-post (status_post vazio) → preserva a escolha manual
    expect(resolverOpcaoCard('op_aguardando', '')?.id).toBe('op_aguardando');
    expect(resolverOpcaoCard('op_concluido', undefined)?.id).toBe('op_concluido');
    // nada resolve
    expect(resolverOpcaoCard('id_inexistente', '')).toBeUndefined();
  });
});
