import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = {
  getFullList: vi.fn(), getOne: vi.fn(), getList: vi.fn(),
  create: vi.fn(), update: vi.fn(), delete: vi.fn(),
};
const hist: { entidade: string; ref: string; acao: string }[] = [];

vi.mock('@/lib/pocketbase', () => ({
  pb: { collection: () => api, authStore: { record: { id: 'u1' } } },
}));
vi.mock('@/atividade/atividadeService', async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    registrarHistorico: vi.fn(async (e: string, r: string, a: string) => {
      hist.push({ entidade: e, ref: r, acao: a });
    }),
  };
});

import {
  criarTarefa, moverTarefaStatus, listTarefas,
  aprovarTarefa, pedirAlteracaoTarefa,
  moverTarefaOpcao, concluirTarefa, reabrirTarefa, salvarEtapas, atualizarTarefa,
} from '@/tarefas/tarefasService';
import type { Tarefa, EtapaTarefa } from '@/tarefas/types';

describe('tarefasService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hist.length = 0;
  });

  it('criar registra histórico com entidade "tarefa"', async () => {
    api.create.mockResolvedValue({ id: 't1', nome: 'Aprovar layout' });
    await criarTarefa({ nome: 'Aprovar layout', lado: 'wenox' } as never);
    expect(hist[0].entidade).toBe('tarefa');
    expect(hist[0].acao).toMatch(/criada/i);
  });

  it('mover de status registra o status alvo no histórico', async () => {
    api.update.mockResolvedValue({ id: 't1', status: 'Concluído' });
    await moverTarefaStatus('t1', 'Concluído');
    expect(hist[0].acao).toMatch(/Concluído/);
    expect(api.update).toHaveBeenCalledWith('t1', expect.objectContaining({ status: 'Concluído' }));
  });

  it('listar sempre exclui arquivadas (sem opts)', async () => {
    api.getList.mockResolvedValue({ items: [] });
    await listTarefas();
    const opts = api.getList.mock.calls[0][2];
    expect(opts.filter).toContain('arquivada != true');
  });

  it('listar sempre exclui arquivadas mesmo com outros filtros', async () => {
    api.getList.mockResolvedValue({ items: [] });
    await listTarefas({ somenteAvulsas: true });
    const opts = api.getList.mock.calls[0][2];
    expect(opts.filter).toContain('arquivada != true');
    expect(opts.filter).toContain('projeto = ""');
  });

  it('listar com somenteAvulsas filtra tarefas sem projeto', async () => {
    api.getList.mockResolvedValue({ items: [] });
    await listTarefas({ somenteAvulsas: true });
    const opts = api.getList.mock.calls[0][2];
    expect(opts.filter).toContain('projeto = ""');
  });

  it('listar por responsável escopa pelo uid', async () => {
    api.getList.mockResolvedValue({ items: [] });
    await listTarefas({ responsavelId: 'u9' });
    const opts = api.getList.mock.calls[0][2];
    expect(opts.filter).toContain('responsaveis.id ?= "u9"');
  });

  it('aprovar registra veredito "aprovada"', async () => {
    api.update.mockResolvedValue({ id: 't1', aprovacao: 'aprovada' });
    await aprovarTarefa('t1');
    expect(api.update).toHaveBeenCalledWith('t1', { aprovacao: 'aprovada' });
    expect(hist[0].acao).toMatch(/aprovou/i);
  });

  it('pedir alteração exige texto e marca a flag (status é manual)', async () => {
    api.update.mockResolvedValue({ id: 't1', aprovacao: 'alteracao' });
    await expect(pedirAlteracaoTarefa('t1', '  ')).rejects.toThrow();
    await pedirAlteracaoTarefa('t1', 'trocar a cor do banner');
    // F2: status passou a ser manual — o pedido de alteração só marca a flag
    // informativa de aprovação, sem forçar uma opção de status.
    expect(api.update).toHaveBeenCalledWith('t1', {
      aprovacao: 'alteracao',
    });
  });
});

describe('tarefasService — status manual (F2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hist.length = 0;
  });

  it('criarTarefa nasce na opção inicial + espelho legado', async () => {
    api.create.mockResolvedValue({ id: 't1', nome: 'X' });
    await criarTarefa({ nome: 'X', lado: 'wenox' } as never);
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ status_opcao: 'op_nao_iniciado', status: 'Não iniciado' }),
    );
  });

  it('salvarEtapas NÃO escreve status nem concluida_em (checklist informativo)', async () => {
    api.update.mockResolvedValue({ id: 't1' });
    const rec = { id: 't1', etapas: [{ id: 'e1', texto: 'a', tipo: 'interna', feito: false }] } as Tarefa;
    const etapas: EtapaTarefa[] = [{ id: 'e1', texto: 'a', tipo: 'interna', feito: true }];
    await salvarEtapas(rec, etapas);
    const payload = api.update.mock.calls[0][1];
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('concluida_em');
    expect(payload).toHaveProperty('etapas');
  });

  it('moverTarefaOpcao grava opção + espelho; conclui quando opção é do último grupo', async () => {
    api.getOne.mockResolvedValue({ id: 't1' });
    api.update.mockResolvedValue({ id: 't1' });
    await moverTarefaOpcao('t1', 'op_concluido');
    const payload = api.update.mock.calls[0][1];
    expect(payload).toMatchObject({ status_opcao: 'op_concluido', status: 'Concluído' });
    expect(payload.concluida_em).toBeTruthy();
  });

  it('moverTarefaOpcao para opção não-conclusiva zera concluida_em', async () => {
    api.update.mockResolvedValue({ id: 't1' });
    await moverTarefaOpcao('t1', 'op_em_andamento');
    const payload = api.update.mock.calls[0][1];
    expect(payload).toMatchObject({ status_opcao: 'op_em_andamento', status: 'Em andamento', concluida_em: '' });
  });

  it('concluirTarefa grava a opção de conclusão', async () => {
    api.getOne.mockResolvedValue({ id: 't1' });
    api.update.mockResolvedValue({ id: 't1' });
    await concluirTarefa('t1', 'Concluído');
    const payload = api.update.mock.calls[0][1];
    expect(payload).toMatchObject({ status: 'Concluído', status_opcao: 'op_concluido' });
    expect(payload.concluida_em).toBeTruthy();
  });

  it('reabrirTarefa volta para a opção inicial e zera concluida_em', async () => {
    api.update.mockResolvedValue({ id: 't1' });
    await reabrirTarefa('t1', 'Não iniciado');
    expect(api.update.mock.calls[0][1]).toMatchObject({
      status: 'Não iniciado', status_opcao: 'op_nao_iniciado', concluida_em: '',
    });
  });

  it('atualizarTarefa com status_opcao espelha o nome e marca concluida_em', async () => {
    api.getOne.mockResolvedValue({ id: 't1', status: 'Em andamento', status_opcao: 'op_em_andamento' });
    api.update.mockResolvedValue({ id: 't1' });
    await atualizarTarefa('t1', { status_opcao: 'op_concluido' });
    const payload = api.update.mock.calls[0][1];
    expect(payload).toMatchObject({ status_opcao: 'op_concluido', status: 'Concluído' });
    expect(payload.concluida_em).toBeTruthy();
  });
});
