/**
 * R3.c — guard em criarTarefa / atualizarTarefa:
 * rejeita quando sem etapas E responsaveis.length > 1;
 * aceita com 1 responsável ou com etapas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = {
  getFullList: vi.fn(),
  getOne: vi.fn(),
  getList: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/lib/pocketbase', () => ({
  pb: { collection: () => api, authStore: { record: { id: 'u1' } } },
}));

vi.mock('@/atividade/atividadeService', () => ({
  registrarHistorico: vi.fn(),
  diffCampos: () => [],
  addComentario: vi.fn(),
}));

vi.mock('@/notificacoes/notificacoesService', () => ({
  notificar: vi.fn().mockResolvedValue(undefined),
  idsGestao: vi.fn().mockResolvedValue([]),
}));

import { criarTarefa, atualizarTarefa } from '@/tarefas/tarefasService';
import type { EtapaTarefa } from '@/tarefas/types';

const etapa: EtapaTarefa = {
  id: 'e1', texto: 'Revisar', tipo: 'interna', feito: false,
};

describe('criarTarefa — guard R3.c', () => {
  beforeEach(() => vi.clearAllMocks());

  it('injeta 1 etapa padrão quando não vêm etapas (mesmo com 2+ responsaveis)', async () => {
    api.create.mockResolvedValue({ id: 't1', nome: 'T' });
    await criarTarefa({ nome: 'T', lado: 'wenox', responsaveis: ['u1', 'u2'] } as any);
    expect(api.create).toHaveBeenCalledTimes(1);
    const dados = api.create.mock.calls[0][0];
    expect(dados.etapas).toHaveLength(1);
    expect(dados.etapas[0].responsavel).toBe('u1');
  });

  it('aceita: 0 etapas e exatamente 1 responsavel', async () => {
    api.create.mockResolvedValue({ id: 't1', nome: 'T' });
    await expect(
      criarTarefa({ nome: 'T', lado: 'wenox', responsaveis: ['u1'] } as any),
    ).resolves.toMatchObject({ id: 't1' });
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it('aceita: 0 etapas e sem responsaveis', async () => {
    api.create.mockResolvedValue({ id: 't2', nome: 'T' });
    await expect(
      criarTarefa({ nome: 'T', lado: 'wenox', responsaveis: [] } as any),
    ).resolves.toMatchObject({ id: 't2' });
  });

  it('aceita: etapas presentes mesmo com 2+ responsaveis', async () => {
    api.create.mockResolvedValue({ id: 't3', nome: 'T3' });
    await expect(
      criarTarefa({
        nome: 'T3', lado: 'wenox', responsaveis: ['u1', 'u2'], etapas: [etapa],
      } as any),
    ).resolves.toMatchObject({ id: 't3' });
    expect(api.create).toHaveBeenCalledTimes(1);
  });
});

describe('atualizarTarefa — guard R3.c', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejeita: input resulta em 0 etapas + 2 responsaveis', async () => {
    api.getOne.mockResolvedValue({ id: 't4', etapas: [etapa], responsaveis: ['u1'] });
    await expect(
      atualizarTarefa('t4', { etapas: [], responsaveis: ['u1', 'u2'] }),
    ).rejects.toThrow('Tarefa sem etapas pode ter apenas 1 responsável');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('rejeita: antes.etapas=[] e input traz 2 responsaveis', async () => {
    api.getOne.mockResolvedValue({ id: 't5', etapas: [], responsaveis: ['u1'] });
    await expect(
      atualizarTarefa('t5', { responsaveis: ['u1', 'u2'] }),
    ).rejects.toThrow('Tarefa sem etapas pode ter apenas 1 responsável');
    expect(api.update).not.toHaveBeenCalled();
  });

  it('rejeita: antes.responsaveis tem 2 e input zera etapas', async () => {
    api.getOne.mockResolvedValue({ id: 't6', etapas: [etapa], responsaveis: ['u1', 'u2'] });
    await expect(
      atualizarTarefa('t6', { etapas: [] }),
    ).rejects.toThrow('Tarefa sem etapas pode ter apenas 1 responsável');
  });

  it('aceita: adiciona etapas ao estado que tinha 2 responsaveis', async () => {
    api.getOne.mockResolvedValue({ id: 't7', etapas: [], responsaveis: ['u1', 'u2'] });
    api.update.mockResolvedValue({ id: 't7', etapas: [etapa], responsaveis: ['u1', 'u2'] });
    await expect(
      atualizarTarefa('t7', { etapas: [etapa] }),
    ).resolves.toMatchObject({ id: 't7' });
  });

  it('aceita: 0 etapas + 1 responsavel', async () => {
    api.getOne.mockResolvedValue({ id: 't8', etapas: [], responsaveis: ['u1'] });
    api.update.mockResolvedValue({ id: 't8', etapas: [], responsaveis: ['u1'] });
    await expect(
      atualizarTarefa('t8', { responsaveis: ['u1'] }),
    ).resolves.toMatchObject({ id: 't8' });
  });

  it('ignora guard quando input não toca etapas nem responsaveis', async () => {
    api.getOne.mockResolvedValue({ id: 't9', etapas: [], responsaveis: ['u1', 'u2'] });
    api.update.mockResolvedValue({ id: 't9', nome: 'novo nome' });
    await expect(
      atualizarTarefa('t9', { nome: 'novo nome' }),
    ).resolves.toMatchObject({ id: 't9' });
    expect(api.update).toHaveBeenCalledTimes(1);
  });
});
