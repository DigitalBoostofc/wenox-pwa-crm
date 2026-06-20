import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    col.tarefas.delete.mockResolvedValue(undefined);
  });

  it('chama pb.collection("tarefas").delete com o id exato', async () => {
    await removerTarefa('t1');
    expect(col.tarefas.delete).toHaveBeenCalledOnce();
    expect(col.tarefas.delete).toHaveBeenCalledWith('t1');
  });

  it('não toca em comentarios, historico, notificacoes ou listas — cascata é server-side', async () => {
    await removerTarefa('t1');
    expect(col.comentarios.getFullList).not.toHaveBeenCalled();
    expect(col.comentarios.delete).not.toHaveBeenCalled();
    expect(col.historico.getFullList).not.toHaveBeenCalled();
    expect(col.historico.delete).not.toHaveBeenCalled();
    expect(col.listas.getFullList).not.toHaveBeenCalled();
    expect(col.listas.update).not.toHaveBeenCalled();
    expect(col.notificacoes.getFullList).not.toHaveBeenCalled();
    expect(col.notificacoes.delete).not.toHaveBeenCalled();
  });

  it('propaga o erro se o delete primário da tarefa rejeitar', async () => {
    col.tarefas.delete.mockRejectedValue(new Error('404 Not Found'));
    await expect(removerTarefa('t1')).rejects.toThrow('404 Not Found');
  });
});
