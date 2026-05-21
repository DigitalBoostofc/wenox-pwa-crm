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
} from '@/tarefas/tarefasService';

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
});
