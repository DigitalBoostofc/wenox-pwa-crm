/**
 * Cascata arquivar/restaurar/deletar lista → tarefa vinculada.
 *
 * Cobre:
 *   - arquivarLista: atualiza tarefa.arquivada=true (best-effort, não lança em erro)
 *   - restaurarLista: atualiza tarefa.arquivada=false (best-effort)
 *   - deletarListaComCards: deleta a tarefa vinculada após deletar a lista (best-effort, ignora 404)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const tarefasApi = { update: vi.fn(), delete: vi.fn() };
const listasApi = { getOne: vi.fn(), update: vi.fn(), delete: vi.fn(), getFullList: vi.fn() };
const cartoesApi = { getFullList: vi.fn(), delete: vi.fn() };

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    collection: (name: string) => {
      if (name === 'tarefas') return tarefasApi;
      if (name === 'listas') return listasApi;
      if (name === 'cartoes') return cartoesApi;
      return {};
    },
    filter: (_tpl: string, _params?: unknown) => 'filter',
    authStore: { record: { id: 'u1' } },
    files: { getURL: () => '' },
  },
}));

vi.mock('@/clientes/clientesService', () => ({ logoUrl: vi.fn() }));
vi.mock('@/quadros/modeloPost', () => ({ carregarModeloRemoto: vi.fn() }));
vi.mock('@/tarefas/tarefasService', () => ({
  criarTarefa: vi.fn(),
  concluirEtapa: vi.fn(),
  getTarefa: vi.fn(),
}));
vi.mock('@/tarefas/status', () => ({
  statusInicial: () => 'Não iniciado',
  statusDoPapel: () => undefined,
}));

import { arquivarLista, restaurarLista, deletarListaComCards } from '@/quadros/quadrosService';

beforeEach(() => {
  vi.clearAllMocks();
  listasApi.update.mockResolvedValue({ id: 'l1', nome: 'Lista', fechada: false });
  listasApi.delete.mockResolvedValue(undefined);
  tarefasApi.update.mockResolvedValue({});
  tarefasApi.delete.mockResolvedValue(undefined);
  cartoesApi.getFullList.mockResolvedValue([]);
});

/* ------------------------------------------------------------------ */
/* arquivarLista                                                        */
/* ------------------------------------------------------------------ */

describe('arquivarLista', () => {
  it('atualiza tarefa.arquivada=true quando lista tem tarefa vinculada', async () => {
    listasApi.getOne.mockResolvedValue({ id: 'l1', tarefa: 't1' });

    await arquivarLista('l1');

    expect(listasApi.update).toHaveBeenCalledWith('l1', { fechada: true });
    expect(tarefasApi.update).toHaveBeenCalledWith('t1', { arquivada: true });
  });

  it('não tenta atualizar tarefa quando lista não tem tarefa vinculada', async () => {
    listasApi.getOne.mockResolvedValue({ id: 'l1' });

    await arquivarLista('l1');

    expect(tarefasApi.update).not.toHaveBeenCalled();
  });

  it('não lança erro se o update da tarefa falhar (best-effort)', async () => {
    listasApi.getOne.mockResolvedValue({ id: 'l1', tarefa: 't1' });
    tarefasApi.update.mockRejectedValueOnce(new Error('network'));

    await expect(arquivarLista('l1')).resolves.toBeDefined();
    expect(listasApi.update).toHaveBeenCalledWith('l1', { fechada: true });
  });
});

/* ------------------------------------------------------------------ */
/* restaurarLista                                                       */
/* ------------------------------------------------------------------ */

describe('restaurarLista', () => {
  it('atualiza tarefa.arquivada=false quando lista tem tarefa vinculada', async () => {
    listasApi.getOne.mockResolvedValue({ id: 'l1', tarefa: 't1' });

    await restaurarLista('l1');

    expect(listasApi.update).toHaveBeenCalledWith('l1', { fechada: false });
    expect(tarefasApi.update).toHaveBeenCalledWith('t1', { arquivada: false });
  });

  it('não tenta atualizar tarefa quando lista não tem tarefa vinculada', async () => {
    listasApi.getOne.mockResolvedValue({ id: 'l1' });

    await restaurarLista('l1');

    expect(tarefasApi.update).not.toHaveBeenCalled();
  });

  it('não lança erro se o update da tarefa falhar (best-effort)', async () => {
    listasApi.getOne.mockResolvedValue({ id: 'l1', tarefa: 't1' });
    tarefasApi.update.mockRejectedValueOnce(new Error('network'));

    await expect(restaurarLista('l1')).resolves.toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/* deletarListaComCards                                                 */
/* ------------------------------------------------------------------ */

describe('deletarListaComCards', () => {
  it('deleta a tarefa vinculada após deletar a lista', async () => {
    listasApi.getOne.mockResolvedValue({ id: 'l1', tarefa: 't1' });

    await deletarListaComCards('l1');

    expect(listasApi.delete).toHaveBeenCalledWith('l1');
    expect(tarefasApi.delete).toHaveBeenCalledWith('t1');
  });

  it('não tenta deletar tarefa quando lista não tem tarefa vinculada', async () => {
    listasApi.getOne.mockResolvedValue({ id: 'l1' });

    await deletarListaComCards('l1');

    expect(tarefasApi.delete).not.toHaveBeenCalled();
  });

  it('ignora 404 ao deletar tarefa já removida (double-delete app+hook)', async () => {
    listasApi.getOne.mockResolvedValue({ id: 'l1', tarefa: 't1' });
    tarefasApi.delete.mockRejectedValueOnce(Object.assign(new Error('not found'), { status: 404 }));

    await expect(deletarListaComCards('l1')).resolves.toBeUndefined();
    expect(listasApi.delete).toHaveBeenCalledWith('l1');
  });

  it('deleta os cards antes da lista', async () => {
    listasApi.getOne.mockResolvedValue({ id: 'l1', tarefa: 't1' });
    const c1 = { id: 'c1' };
    cartoesApi.getFullList.mockResolvedValue([c1]);

    await deletarListaComCards('l1');

    expect(cartoesApi.delete).toHaveBeenCalledWith('c1');
    expect(listasApi.delete).toHaveBeenCalledWith('l1');
    expect(tarefasApi.delete).toHaveBeenCalledWith('t1');
  });
});
