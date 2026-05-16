import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = { getFullList: vi.fn(), create: vi.fn() };
vi.mock('@/lib/pocketbase', () => ({
  pb: { collection: () => api, authStore: { record: { id: 'u1' } } },
}));

import {
  addComentario, listAtividade, diffCampos, registrarHistorico,
} from '@/atividade/atividadeService';

describe('atividadeService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('addComentario exige texto não-vazio', async () => {
    await expect(addComentario('cliente', 'c1', '   ')).rejects.toThrow(
      /coment/i,
    );
    expect(api.create).not.toHaveBeenCalled();
  });

  it('addComentario salva com autor do authStore', async () => {
    api.create.mockResolvedValue({});
    await addComentario('cliente', 'c1', 'troquei a senha');
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: 'cliente',
        ref_id: 'c1',
        texto: 'troquei a senha',
        autor: 'u1',
      }),
    );
  });

  it('listAtividade mescla comentários + histórico ordenado por data desc', async () => {
    api.getFullList
      .mockResolvedValueOnce([
        { id: 'k1', created: '2026-05-16 10:00:00Z', texto: 'oi', expand: {} },
      ])
      .mockResolvedValueOnce([
        { id: 'h1', created: '2026-05-16 12:00:00Z', acao: 'criou', expand: {} },
      ]);
    const r = await listAtividade('cliente', 'c1');
    expect(r.map((x) => x.id)).toEqual(['h1', 'k1']);
    expect(r[0].tipo).toBe('historico');
  });

  it('diffCampos descreve mudanças legíveis', () => {
    const d = diffCampos(
      { status: 'Ativo', telefone: '11' },
      { status: 'Inativo', telefone: '11' },
    );
    expect(d).toEqual(['status: Ativo → Inativo']);
  });

  it('registrarHistorico nunca lança mesmo se a API falhar', async () => {
    api.create.mockRejectedValueOnce(new Error('falhou'));
    await expect(
      registrarHistorico('cliente', 'c1', 'teste'),
    ).resolves.toBeUndefined();
  });
});
