/**
 * Fase A + Fase C — quadrosService:
 *   - criarTarefaSocialMedia: nome em maiúsculo sem ano, responsáveis = [socialId, designId], fallback
 *   - getRecorrenciaMes: retorna null em 404, relança outros erros
 *   - salvarRecorrenciaMes: UPSERT (cria quando ausente, atualiza quando existe), força ativa=true
 *   - desativarRecorrenciaMes: seta ativa=false, não apaga o registro
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/*
 * vi.hoisted garante que as variáveis sejam inicializadas ANTES de qualquer
 * factory de vi.mock ser avaliada (vi.mock é içado ao topo do arquivo).
 */
const { criarTarefaMock, rcolApi } = vi.hoisted(() => ({
  criarTarefaMock: vi.fn(),
  rcolApi: {
    getFirstListItem: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    collection: () => rcolApi,
    filter: (_tpl: string) => 'filter',
    authStore: { record: { id: 'u1' } },
    files: { getURL: () => '' },
  },
}));

vi.mock('@/tarefas/tarefasService', () => ({
  criarTarefa: criarTarefaMock,
  concluirEtapa: vi.fn(),
  getTarefa: vi.fn(),
}));

/* ---- imports (após vi.mock — Vitest hoista automaticamente) ---- */
import {
  criarTarefaSocialMedia,
  getRecorrenciaMes,
  salvarRecorrenciaMes,
  desativarRecorrenciaMes,
} from '@/quadros/quadrosService';

/* ======================================================== */
/* Fase A — criarTarefaSocialMedia                          */
/* ======================================================== */

describe('criarTarefaSocialMedia — nome da tarefa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    criarTarefaMock.mockResolvedValue({ id: 't1', nome: '' });
  });

  it('nome = MÊS.UPPER - CLIENTE.UPPER - SOCIAL MEDIA (sem ano)', async () => {
    await criarTarefaSocialMedia('c1', 6, 2025, { designId: 'd1', socialId: 's1' }, 'Click Vistoria');
    expect(criarTarefaMock).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'JUNHO - CLICK VISTORIA - SOCIAL MEDIA' }),
    );
  });

  it('nome em maiúsculo mesmo com cliente em caixa mista', async () => {
    await criarTarefaSocialMedia('c1', 1, 2025, { socialId: 's1' }, 'Minha Empresa Ltda');
    expect(criarTarefaMock).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'JANEIRO - MINHA EMPRESA LTDA - SOCIAL MEDIA' }),
    );
  });

  it('fallback sem nomeCliente usa formato antigo "Social Media — Mês/Ano"', async () => {
    await criarTarefaSocialMedia('c1', 6, 2025, { designId: 'd1', socialId: 's1' });
    expect(criarTarefaMock).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'Social Media — Junho/2025' }),
    );
  });

  it('fallback com nomeCliente vazio (string vazia) usa formato antigo', async () => {
    await criarTarefaSocialMedia('c1', 3, 2025, { socialId: 's1' }, '');
    expect(criarTarefaMock).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'Social Media — Março/2025' }),
    );
  });

  it('fallback com nomeCliente só espaços usa formato antigo', async () => {
    await criarTarefaSocialMedia('c1', 12, 2025, { socialId: 's1' }, '   ');
    expect(criarTarefaMock).toHaveBeenCalledWith(
      expect.objectContaining({ nome: 'Social Media — Dezembro/2025' }),
    );
  });
});

describe('criarTarefaSocialMedia — responsáveis da tarefa', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    criarTarefaMock.mockResolvedValue({ id: 't1', nome: '' });
  });

  it('responsaveis = [socialId, designId] quando ambos fornecidos', async () => {
    await criarTarefaSocialMedia('c1', 6, 2025, { designId: 'd1', socialId: 's1' }, 'Acme');
    const payload = criarTarefaMock.mock.calls[0][0];
    expect(payload.responsaveis).toEqual(['s1', 'd1']);
  });

  it('responsaveis = [designId] quando só design fornecido (sem social)', async () => {
    await criarTarefaSocialMedia('c1', 6, 2025, { designId: 'd1' }, 'Acme');
    const payload = criarTarefaMock.mock.calls[0][0];
    expect(payload.responsaveis).toEqual(['d1']);
  });

  it('responsaveis = [socialId] quando só social fornecido (sem design)', async () => {
    await criarTarefaSocialMedia('c1', 6, 2025, { socialId: 's1' }, 'Acme');
    const payload = criarTarefaMock.mock.calls[0][0];
    expect(payload.responsaveis).toEqual(['s1']);
  });

  it('responsaveis = [] quando responsaveis omitido', async () => {
    await criarTarefaSocialMedia('c1', 6, 2025, undefined, 'Acme');
    const payload = criarTarefaMock.mock.calls[0][0];
    expect(payload.responsaveis).toEqual([]);
  });
});

/* ======================================================== */
/* Fase C — getRecorrenciaMes                               */
/* ======================================================== */

describe('getRecorrenciaMes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna o registro quando encontrado', async () => {
    const rec = { id: 'r1', quadro: 'q1', ativa: true, ultimo_mes: 6, ultimo_ano: 2025 };
    rcolApi.getFirstListItem.mockResolvedValue(rec);
    const result = await getRecorrenciaMes('q1');
    expect(result).toEqual(rec);
  });

  it('retorna null em erro 404', async () => {
    rcolApi.getFirstListItem.mockRejectedValue({ status: 404 });
    const result = await getRecorrenciaMes('q1');
    expect(result).toBeNull();
  });

  it('relança erros que não são 404', async () => {
    rcolApi.getFirstListItem.mockRejectedValue({ status: 500 });
    await expect(getRecorrenciaMes('q1')).rejects.toMatchObject({ status: 500 });
  });
});

/* ======================================================== */
/* Fase C — salvarRecorrenciaMes (UPSERT)                   */
/* ======================================================== */

describe('salvarRecorrenciaMes — UPSERT', () => {
  beforeEach(() => vi.clearAllMocks());

  const cfgBase = { quadro: 'q1', ativa: false as boolean, ultimo_mes: 6, ultimo_ano: 2025 };

  it('cria novo registro quando não existe (getFirstListItem 404)', async () => {
    rcolApi.getFirstListItem.mockRejectedValue({ status: 404 });
    rcolApi.create.mockResolvedValue({ id: 'r1', ...cfgBase, ativa: true });

    await salvarRecorrenciaMes(cfgBase);

    expect(rcolApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ ativa: true, ultimo_mes: 6, ultimo_ano: 2025, quadro: 'q1' }),
    );
    expect(rcolApi.update).not.toHaveBeenCalled();
  });

  it('força ativa=true mesmo quando o input tem ativa=false (create)', async () => {
    rcolApi.getFirstListItem.mockRejectedValue({ status: 404 });
    rcolApi.create.mockResolvedValue({ id: 'r1', ...cfgBase, ativa: true });

    await salvarRecorrenciaMes({ ...cfgBase, ativa: false });

    expect(rcolApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ ativa: true }),
    );
  });

  it('atualiza registro existente quando já existe', async () => {
    const existente = { id: 'r1', quadro: 'q1', ativa: false, ultimo_mes: 5, ultimo_ano: 2025 };
    rcolApi.getFirstListItem.mockResolvedValue(existente);
    rcolApi.update.mockResolvedValue({ ...existente, ativa: true, ultimo_mes: 6 });

    await salvarRecorrenciaMes(cfgBase);

    expect(rcolApi.update).toHaveBeenCalledWith('r1', expect.objectContaining({ ativa: true }));
    expect(rcolApi.create).not.toHaveBeenCalled();
  });

  it('força ativa=true mesmo quando o input tem ativa=false (update)', async () => {
    const existente = { id: 'r2', quadro: 'q1', ativa: true, ultimo_mes: 5, ultimo_ano: 2025 };
    rcolApi.getFirstListItem.mockResolvedValue(existente);
    rcolApi.update.mockResolvedValue({ ...existente, ativa: true });

    await salvarRecorrenciaMes({ ...cfgBase, ativa: false });

    expect(rcolApi.update).toHaveBeenCalledWith('r2', expect.objectContaining({ ativa: true }));
  });

  it('grava ultimo_mes e ultimo_ano fornecidos no payload', async () => {
    rcolApi.getFirstListItem.mockRejectedValue({ status: 404 });
    rcolApi.create.mockResolvedValue({ id: 'r1', quadro: 'q1', ativa: true, ultimo_mes: 7, ultimo_ano: 2026 });

    await salvarRecorrenciaMes({ quadro: 'q1', ativa: false, ultimo_mes: 7, ultimo_ano: 2026 });

    expect(rcolApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ ultimo_mes: 7, ultimo_ano: 2026 }),
    );
  });
});

/* ======================================================== */
/* Fase C — desativarRecorrenciaMes                         */
/* ======================================================== */

describe('desativarRecorrenciaMes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('seta ativa=false no registro existente (não apaga)', async () => {
    const existente = { id: 'r1', quadro: 'q1', ativa: true, ultimo_mes: 6, ultimo_ano: 2025 };
    rcolApi.getFirstListItem.mockResolvedValue(existente);
    rcolApi.update.mockResolvedValue({ ...existente, ativa: false });

    await desativarRecorrenciaMes('q1');

    expect(rcolApi.update).toHaveBeenCalledWith('r1', { ativa: false });
  });

  it('não chama update quando registro não existe (404)', async () => {
    rcolApi.getFirstListItem.mockRejectedValue({ status: 404 });

    await desativarRecorrenciaMes('q1');

    expect(rcolApi.update).not.toHaveBeenCalled();
  });
});
