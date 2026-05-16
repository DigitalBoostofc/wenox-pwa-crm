import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = { getFullList: vi.fn(), getOne: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
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

import { updateAcesso, createAcesso } from '@/acessos/acessosService';

describe('acessosService — histórico sem vazar senha', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hist.length = 0;
  });

  it('troca de senha registra o fato, nunca o valor', async () => {
    api.getOne.mockResolvedValue({ senha: 'segredo-antigo', plataforma: 'Meta' });
    api.update.mockResolvedValue({ id: 'a1', plataforma: 'Meta' });
    await updateAcesso('a1', { senha: 'NOVA-senha-secreta' });
    const acoes = hist.map((h) => h.acao).join(' | ');
    expect(acoes).toMatch(/senha atualizada/i);
    expect(acoes).not.toContain('segredo-antigo');
    expect(acoes).not.toContain('NOVA-senha-secreta');
  });

  it('cadastro registra histórico com a plataforma', async () => {
    api.create.mockResolvedValue({ id: 'a2', plataforma: 'Google Ads' });
    await createAcesso({ cliente: 'c1', plataforma: 'Google Ads' } as never);
    expect(hist[0].acao).toMatch(/Google Ads/);
    expect(hist[0].entidade).toBe('acesso');
  });
});
