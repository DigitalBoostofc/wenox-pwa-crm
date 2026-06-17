import { describe, it, expect, vi, beforeEach } from 'vitest';

const getList = vi.fn();

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    collection: () => ({ getList }),
  },
}));

import { getWaConfig } from '@/automacoes/whatsappService';

const VAZIO_EXPECTED = {
  subdomain: '',
  token: '',
  instance_name: 'wenox',
  numero: '',
  status: 'desconectado',
  janela_inicio: '08:00',
  janela_fim: '19:00',
  dias_uteis: [1, 2, 3, 4, 5],
  ativo: false,
};

describe('getWaConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna config VAZIO quando a coleção está vazia (instalação nova)', async () => {
    getList.mockResolvedValue({ items: [] });

    const result = await getWaConfig();

    expect(result).toMatchObject(VAZIO_EXPECTED);
    expect(result.id).toBeUndefined();
  });

  it('retorna config mapeada quando há um registro na coleção', async () => {
    const rec = {
      id: 'cfg1',
      subdomain: 'minha-empresa',
      token: 'tok-abc',
      instance_name: 'wenox-prod',
      numero: '5511999990000',
      status: 'conectado',
      janela_inicio: '09:00',
      janela_fim: '18:00',
      dias_uteis: [1, 2, 3, 4, 5, 6],
      ativo: true,
    };
    getList.mockResolvedValue({ items: [rec] });

    const result = await getWaConfig();

    expect(result).toEqual({
      id: 'cfg1',
      subdomain: 'minha-empresa',
      token: 'tok-abc',
      instance_name: 'wenox-prod',
      numero: '5511999990000',
      status: 'conectado',
      janela_inicio: '09:00',
      janela_fim: '18:00',
      dias_uteis: [1, 2, 3, 4, 5, 6],
      ativo: true,
    });
  });

  it('propaga erro quando getList rejeita (rede caída / 403 permissão) — F-203', async () => {
    const networkError = new Error('Network Error: failed to fetch');
    getList.mockRejectedValue(networkError);

    await expect(getWaConfig()).rejects.toThrow('Network Error: failed to fetch');
  });
});
