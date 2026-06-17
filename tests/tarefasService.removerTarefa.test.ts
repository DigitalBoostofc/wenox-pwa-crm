import { describe, it, expect, vi, beforeEach } from 'vitest';

// Per-collection mock factories — needed because removerTarefa calls pb.collection()
// with distinct names (tarefas, comentarios, historico, listas, notificacoes).
const mkApi = () => ({
  getFullList: vi.fn(),
  getOne: vi.fn(),
  getList: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
});

const col = {
  tarefas: mkApi(),
  comentarios: mkApi(),
  historico: mkApi(),
  listas: mkApi(),
  notificacoes: mkApi(),
} as Record<string, ReturnType<typeof mkApi>>;

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    collection: (name: string) => col[name] ?? col.tarefas,
    // Reproduce PocketBase's filter substitution so assertions on filter strings work.
    filter: (tpl: string, params: Record<string, unknown> = {}) =>
      Object.entries(params).reduce(
        (s, [k, v]) => s.replaceAll(`{:${k}}`, String(v)),
        tpl,
      ),
    authStore: { record: { id: 'u1' } },
  },
}));

vi.mock('@/atividade/atividadeService', () => ({
  registrarHistorico: vi.fn().mockResolvedValue(undefined),
  diffCampos: vi.fn().mockReturnValue([]),
  addComentario: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/notificacoes/notificacoesService', () => ({
  notificar: vi.fn().mockResolvedValue(undefined),
  idsGestao: vi.fn().mockResolvedValue([]),
}));

import { removerTarefa } from '@/tarefas/tarefasService';

describe('removerTarefa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: todas as operações resolvem com sucesso.
    col.tarefas.delete.mockResolvedValue(undefined);
    col.comentarios.getFullList.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    col.comentarios.delete.mockResolvedValue(undefined);
    col.historico.getFullList.mockResolvedValue([{ id: 'h1' }]);
    col.historico.delete.mockResolvedValue(undefined);
    col.listas.getFullList.mockResolvedValue([{ id: 'l1' }]);
    col.listas.update.mockResolvedValue(undefined);
    col.notificacoes.getFullList.mockResolvedValue([{ id: 'n1' }]);
    col.notificacoes.delete.mockResolvedValue(undefined);
  });

  // ─── Caminho feliz ─────────────────────────────────────────────────────────

  it('apaga a tarefa primária pelo id', async () => {
    await removerTarefa('t1');
    expect(col.tarefas.delete).toHaveBeenCalledOnce();
    expect(col.tarefas.delete).toHaveBeenCalledWith('t1');
  });

  it('apaga comentários filtrando por entidade="tarefa" e ref_id=id', async () => {
    await removerTarefa('t1');
    expect(col.comentarios.getFullList).toHaveBeenCalledOnce();
    expect(col.comentarios.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: 'entidade = "tarefa" && ref_id = t1',
        fields: 'id',
      }),
    );
    expect(col.comentarios.delete).toHaveBeenCalledWith('c1');
    expect(col.comentarios.delete).toHaveBeenCalledWith('c2');
  });

  it('apaga histórico filtrando por entidade="tarefa" e ref_id=id', async () => {
    await removerTarefa('t1');
    expect(col.historico.getFullList).toHaveBeenCalledOnce();
    expect(col.historico.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: 'entidade = "tarefa" && ref_id = t1',
        fields: 'id',
      }),
    );
    expect(col.historico.delete).toHaveBeenCalledWith('h1');
  });

  it('desvincula listas via update({ tarefa: "" }) — NÃO deleta a lista', async () => {
    await removerTarefa('t1');
    expect(col.listas.getFullList).toHaveBeenCalledOnce();
    expect(col.listas.update).toHaveBeenCalledWith('l1', { tarefa: '' });
    expect(col.listas.delete).not.toHaveBeenCalled();
  });

  it('apaga notificações cujo link é /tarefas/{id}', async () => {
    await removerTarefa('t1');
    expect(col.notificacoes.getFullList).toHaveBeenCalledOnce();
    expect(col.notificacoes.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'link = /tarefas/t1', fields: 'id' }),
    );
    expect(col.notificacoes.delete).toHaveBeenCalledWith('n1');
  });

  // ─── Resiliência (o ponto do fix) ──────────────────────────────────────────

  it('getFullList de comentários rejeitando NÃO impede a limpeza das demais coleções', async () => {
    col.comentarios.getFullList.mockRejectedValue(new Error('403 Forbidden'));

    await expect(removerTarefa('t1')).resolves.toBeUndefined();

    // Histórico, listas e notificacoes devem continuar normalmente.
    expect(col.historico.getFullList).toHaveBeenCalledOnce();
    expect(col.historico.delete).toHaveBeenCalledWith('h1');
    expect(col.listas.getFullList).toHaveBeenCalledOnce();
    expect(col.listas.update).toHaveBeenCalledWith('l1', { tarefa: '' });
    expect(col.notificacoes.getFullList).toHaveBeenCalledOnce();
    expect(col.notificacoes.delete).toHaveBeenCalledWith('n1');
  });

  it('delete de item de histórico rejeitando (Promise.allSettled) NÃO impede limpeza de listas e notificacoes', async () => {
    col.historico.delete.mockRejectedValue(new Error('403 Forbidden'));

    await expect(removerTarefa('t1')).resolves.toBeUndefined();

    expect(col.listas.getFullList).toHaveBeenCalledOnce();
    expect(col.notificacoes.getFullList).toHaveBeenCalledOnce();
  });

  it('múltiplas coleções rejeitando: removerTarefa ainda resolve sem lançar', async () => {
    col.comentarios.getFullList.mockRejectedValue(new Error('sem permissão'));
    col.historico.getFullList.mockRejectedValue(new Error('sem permissão'));
    col.listas.getFullList.mockRejectedValue(new Error('sem permissão'));
    col.notificacoes.getFullList.mockRejectedValue(new Error('sem permissão'));

    await expect(removerTarefa('t1')).resolves.toBeUndefined();
  });

  // ─── Delete primário falha ──────────────────────────────────────────────────

  it('delete primário rejeitado propaga o erro para quem chamou', async () => {
    col.tarefas.delete.mockRejectedValue(new Error('404 Not Found'));

    await expect(removerTarefa('t1')).rejects.toThrow('404 Not Found');
  });

  it('se o delete primário falha, a limpeza em cascata NÃO é executada', async () => {
    col.tarefas.delete.mockRejectedValue(new Error('404 Not Found'));

    await expect(removerTarefa('t1')).rejects.toThrow();

    expect(col.comentarios.getFullList).not.toHaveBeenCalled();
    expect(col.historico.getFullList).not.toHaveBeenCalled();
    expect(col.listas.getFullList).not.toHaveBeenCalled();
    expect(col.notificacoes.getFullList).not.toHaveBeenCalled();
  });
});
