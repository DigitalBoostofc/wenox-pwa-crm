import { describe, it, expect, vi, beforeEach } from 'vitest';

const opcoesApi = { getFullList: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
const clientesApi = { getFullList: vi.fn() };

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    collection: (name: string) =>
      name === 'opcoes' ? opcoesApi : clientesApi,
  },
}));

import { removerOpcao, criarOpcao, contarUsoOpcao } from '@/opcoes/opcoesService';

describe('opcoesService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bloqueia remoção quando a opção está em uso por clientes', async () => {
    clientesApi.getFullList.mockResolvedValue([
      { origem: 'Indicação', status: 'Ativo', servicos: [] },
      { origem: 'Site', status: 'Ativo', servicos: ['Social Media'] },
    ]);
    await expect(
      removerOpcao({ id: 'o1', tipo: 'status', valor: 'Ativo', ordem: 1 }),
    ).rejects.toThrow(/não é possível remover/i);
    expect(opcoesApi.delete).not.toHaveBeenCalled();
  });

  it('remove quando ninguém usa a opção', async () => {
    clientesApi.getFullList.mockResolvedValue([
      { origem: 'Site', status: 'Ativo', servicos: [] },
    ]);
    opcoesApi.delete.mockResolvedValue(true);
    await removerOpcao({ id: 'o9', tipo: 'origem', valor: 'Parceria', ordem: 3 });
    expect(opcoesApi.delete).toHaveBeenCalledWith('o9');
  });

  it('conta uso em serviços (json array)', async () => {
    clientesApi.getFullList.mockResolvedValue([
      { servicos: ['Social Media', 'Web Design'] },
      { servicos: ['Web Design'] },
      { servicos: null },
    ]);
    expect(await contarUsoOpcao('servico', 'Web Design')).toBe(2);
  });

  it('criarOpcao calcula a próxima ordem', async () => {
    opcoesApi.getFullList.mockResolvedValue([
      { id: 'a', tipo: 'origem', valor: 'X', ordem: 1 },
      { id: 'b', tipo: 'origem', valor: 'Y', ordem: 4 },
    ]);
    opcoesApi.create.mockResolvedValue({ id: 'c', tipo: 'origem', valor: 'Z', ordem: 5 });
    await criarOpcao('origem', '  Z  ');
    expect(opcoesApi.create).toHaveBeenCalledWith({ tipo: 'origem', valor: 'Z', ordem: 5 });
  });
});
