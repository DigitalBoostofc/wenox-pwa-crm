/**
 * Cobre:
 *   - atualizarConfigRecorrenciaMes: guard sem registro + payload sem ativa/ultimo_mes/ultimo_ano
 *   - editarMesLista: deleção seletiva de posts, quantidade/dias por padrão, guard sem OUTRAS,
 *                     atualização da tarefa (preserva feito/feito_por/feito_em, sem duplicata em
 *                     responsaveis), chamada final a atualizarConfigRecorrenciaMes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { cartoesApi, rcolApi, getTarefaMock, atualizarTarefaMock } = vi.hoisted(() => ({
  cartoesApi: {
    getFullList: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  rcolApi: {
    getFirstListItem: vi.fn(),
    update: vi.fn(),
  },
  getTarefaMock: vi.fn(),
  atualizarTarefaMock: vi.fn(),
}));

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    collection: (name: string) => {
      if (name === 'cartoes') return cartoesApi;
      if (name === 'recorrencias_mes') return rcolApi;
      return {};
    },
    filter: (_tpl: string) => 'filter',
    authStore: { record: { id: 'u1' } },
    files: { getURL: () => '' },
  },
}));

vi.mock('@/tarefas/tarefasService', () => ({
  getTarefa: getTarefaMock,
  atualizarTarefa: atualizarTarefaMock,
  criarTarefa: vi.fn(),
  concluirEtapa: vi.fn(),
}));

vi.mock('@/tarefas/status', () => ({
  statusInicial: () => 'Não iniciado',
  statusDoPapel: () => undefined,
  opcaoIdDoStatusPost: (sp: string) => (({
    em_producao: 'op_em_producao', agendar: 'op_agendar', agendado: 'op_agendado',
    postado: 'op_postado', em_alteracao: 'op_em_alteracao',
  } as Record<string, string>)[sp]),
}));

vi.mock('@/clientes/clientesService', () => ({ logoUrl: vi.fn() }));
vi.mock('@/quadros/modeloPost', () => ({ carregarModeloRemoto: vi.fn() }));

import { atualizarConfigRecorrenciaMes, editarMesLista } from '@/quadros/quadrosService';
import type { Lista } from '@/quadros/types';

/* ---------- helpers --------------------------------------------------- */

const LISTA_MES: Lista = {
  id: 'l1',
  quadro: 'q1',
  nome: 'Julho/2025',
  tipo: 'mes',
  mes: 7,
  ano: 2025,
};

const LISTA_MES_COM_TAREFA: Lista = { ...LISTA_MES, tarefa: 't1' };

/** Conjunto padrão de cards com CALENDÁRIO → posts → OUTRAS → extra */
function makeCards() {
  return [
    { id: 'c0', nome: 'CALENDÁRIO DE POSTS', ordem: 1, lista: 'l1', quadro: 'q1' },
    { id: 'c1', nome: '01 Ter: ', ordem: 2, lista: 'l1', quadro: 'q1', status_post: 'em_producao' },
    { id: 'c2', nome: '03 Qui: ', ordem: 3, lista: 'l1', quadro: 'q1', status_post: 'em_producao' },
    { id: 'c3', nome: 'OUTRAS ATIVIDADES', ordem: 4, lista: 'l1', quadro: 'q1' },
    { id: 'c4', nome: 'Relatório', ordem: 5, lista: 'l1', quadro: 'q1' },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  cartoesApi.delete.mockResolvedValue(undefined);
  cartoesApi.create.mockResolvedValue({ id: 'new-card' });
  cartoesApi.update.mockResolvedValue({});
  rcolApi.update.mockResolvedValue({ id: 'r1' });
  getTarefaMock.mockResolvedValue({ id: 't1', etapas: [], responsaveis: [] });
  atualizarTarefaMock.mockResolvedValue({});
});

/* ======================================================== */
/* atualizarConfigRecorrenciaMes                            */
/* ======================================================== */

describe('atualizarConfigRecorrenciaMes — sem registro', () => {
  it('retorna null quando não existe registro (404)', async () => {
    rcolApi.getFirstListItem.mockRejectedValue({ status: 404 });

    const result = await atualizarConfigRecorrenciaMes('q1', { padrao_posts: 'padrao8' });

    expect(result).toBeNull();
  });

  it('não chama update quando não existe registro', async () => {
    rcolApi.getFirstListItem.mockRejectedValue({ status: 404 });

    await atualizarConfigRecorrenciaMes('q1', { padrao_posts: 'padrao8' });

    expect(rcolApi.update).not.toHaveBeenCalled();
  });
});

describe('atualizarConfigRecorrenciaMes — com registro existente', () => {
  beforeEach(() => {
    rcolApi.getFirstListItem.mockResolvedValue({
      id: 'r1',
      quadro: 'q1',
      ativa: true,
      ultimo_mes: 6,
      ultimo_ano: 2025,
    });
  });

  it('chama update com os 6 campos de config', async () => {
    await atualizarConfigRecorrenciaMes('q1', {
      padrao_posts: 'padrao8',
      qtd_custom: 8,
      dias_custom: [2, 4],
      design_id: 'd1',
      social_id: 's1',
      projeto_id: 'p1',
    });

    expect(rcolApi.update).toHaveBeenCalledWith('r1', {
      padrao_posts: 'padrao8',
      qtd_custom: 8,
      dias_custom: [2, 4],
      design_id: 'd1',
      social_id: 's1',
      projeto_id: 'p1',
    });
  });

  it('payload NÃO contém ativa', async () => {
    await atualizarConfigRecorrenciaMes('q1', { padrao_posts: 'padrao12' });

    const payload = rcolApi.update.mock.calls[0][1];
    expect(payload).not.toHaveProperty('ativa');
  });

  it('payload NÃO contém ultimo_mes', async () => {
    await atualizarConfigRecorrenciaMes('q1', { padrao_posts: 'padrao12' });

    const payload = rcolApi.update.mock.calls[0][1];
    expect(payload).not.toHaveProperty('ultimo_mes');
  });

  it('payload NÃO contém ultimo_ano', async () => {
    await atualizarConfigRecorrenciaMes('q1', { padrao_posts: 'padrao12' });

    const payload = rcolApi.update.mock.calls[0][1];
    expect(payload).not.toHaveProperty('ultimo_ano');
  });
});

/* ======================================================== */
/* editarMesLista — deleção seletiva de cards              */
/* ======================================================== */

describe('editarMesLista — deleção entre CALENDÁRIO e OUTRAS', () => {
  beforeEach(() => {
    cartoesApi.getFullList.mockResolvedValue(makeCards());
    rcolApi.getFirstListItem.mockRejectedValue({ status: 404 });
  });

  it('deleta c1 e c2 (posts entre os separadores)', async () => {
    await editarMesLista('q1', LISTA_MES, 'padrao8', 8, [2, 4]);

    const deletedIds = cartoesApi.delete.mock.calls.map((c: unknown[]) => c[0]);
    expect(deletedIds).toContain('c1');
    expect(deletedIds).toContain('c2');
  });

  it('NÃO deleta c0 (CALENDÁRIO DE POSTS)', async () => {
    await editarMesLista('q1', LISTA_MES, 'padrao8', 8, [2, 4]);

    const deletedIds = cartoesApi.delete.mock.calls.map((c: unknown[]) => c[0]);
    expect(deletedIds).not.toContain('c0');
  });

  it('NÃO deleta c3 (OUTRAS ATIVIDADES)', async () => {
    await editarMesLista('q1', LISTA_MES, 'padrao8', 8, [2, 4]);

    const deletedIds = cartoesApi.delete.mock.calls.map((c: unknown[]) => c[0]);
    expect(deletedIds).not.toContain('c3');
  });

  it('NÃO deleta c4 (card após OUTRAS)', async () => {
    await editarMesLista('q1', LISTA_MES, 'padrao8', 8, [2, 4]);

    const deletedIds = cartoesApi.delete.mock.calls.map((c: unknown[]) => c[0]);
    expect(deletedIds).not.toContain('c4');
  });
});

describe('editarMesLista — guard: sem CALENDÁRIO lança erro sem deletar', () => {
  beforeEach(() => {
    cartoesApi.getFullList.mockResolvedValue([
      { id: 'c1', nome: 'Post 1', ordem: 1, status_post: 'em_producao' },
      { id: 'c2', nome: 'Post 2', ordem: 2, status_post: 'em_producao' },
    ]);
    rcolApi.getFirstListItem.mockRejectedValue({ status: 404 });
  });

  it('lança erro quando não há cartão CALENDÁRIO', async () => {
    await expect(
      editarMesLista('q1', LISTA_MES, 'padrao8', 8, [2, 4]),
    ).rejects.toThrow('CALENDÁRIO DE POSTS');
  });

  it('NÃO chama removerCartao quando não há CALENDÁRIO', async () => {
    await expect(
      editarMesLista('q1', LISTA_MES, 'padrao8', 8, [2, 4]),
    ).rejects.toThrow();
    expect(cartoesApi.delete).not.toHaveBeenCalled();
  });
});

describe('editarMesLista — guard: OUTRAS ausente usa cards.length', () => {
  it('deleta até o fim sem ir além dos cards existentes', async () => {
    cartoesApi.getFullList.mockResolvedValue([
      { id: 'c0', nome: 'CALENDÁRIO DE POSTS', ordem: 1 },
      { id: 'c1', nome: 'Post 1', ordem: 2, status_post: 'em_producao' },
      { id: 'c2', nome: 'Post 2', ordem: 3, status_post: 'em_producao' },
    ]);
    rcolApi.getFirstListItem.mockRejectedValue({ status: 404 });

    await editarMesLista('q1', LISTA_MES, 'padrao8', 8, [2, 4]);

    const deletedIds = cartoesApi.delete.mock.calls.map((c: unknown[]) => c[0]);
    expect(deletedIds).toContain('c1');
    expect(deletedIds).toContain('c2');
    expect(deletedIds).not.toContain('c0');
  });
});

/* ======================================================== */
/* editarMesLista — quantidade/dias por padrão             */
/* ======================================================== */

describe('editarMesLista — padrao8 → [2,4] / 8 posts (Julho 2025)', () => {
  beforeEach(() => {
    cartoesApi.getFullList.mockResolvedValue([
      { id: 'c0', nome: 'CALENDÁRIO DE POSTS', ordem: 1 },
    ]);
    rcolApi.getFirstListItem.mockRejectedValue({ status: 404 });
  });

  it('gera exatamente 8 posts (Ter+Qui de Julho/2025)', async () => {
    await editarMesLista('q1', LISTA_MES, 'padrao8', 8, [2, 4]);

    expect(cartoesApi.create.mock.calls).toHaveLength(8);
  });

  it('todos os posts têm data_post em Terça(2) ou Quinta(4)', async () => {
    await editarMesLista('q1', LISTA_MES, 'padrao8', 8, [2, 4]);

    for (const [payload] of cartoesApi.create.mock.calls) {
      const date = new Date((payload as { data_post: string }).data_post);
      expect([2, 4]).toContain(date.getDay());
    }
  });
});

describe('editarMesLista — padrao12 → [1,3,5] / 12 posts (Julho 2025)', () => {
  beforeEach(() => {
    cartoesApi.getFullList.mockResolvedValue([
      { id: 'c0', nome: 'CALENDÁRIO DE POSTS', ordem: 1 },
    ]);
    rcolApi.getFirstListItem.mockRejectedValue({ status: 404 });
  });

  it('gera exatamente 12 posts (Seg+Qua+Sex de Julho/2025)', async () => {
    await editarMesLista('q1', LISTA_MES, 'padrao12', 12, [1, 3, 5]);

    expect(cartoesApi.create.mock.calls).toHaveLength(12);
  });
});

describe('editarMesLista — personalizado → dias/qtd', () => {
  beforeEach(() => {
    cartoesApi.getFullList.mockResolvedValue([
      { id: 'c0', nome: 'CALENDÁRIO DE POSTS', ordem: 1 },
    ]);
    rcolApi.getFirstListItem.mockRejectedValue({ status: 404 });
  });

  it('usa diasCustom e qtdCustom (domingo / qtd=3 → 3 posts)', async () => {
    // Julho 2025 tem 4 domingos (6,13,20,27) → primeiros 3
    await editarMesLista('q1', LISTA_MES, 'personalizado', 3, [0]);

    expect(cartoesApi.create.mock.calls).toHaveLength(3);
    for (const [payload] of cartoesApi.create.mock.calls) {
      const date = new Date((payload as { data_post: string }).data_post);
      expect(date.getDay()).toBe(0);
    }
  });
});

/* ======================================================== */
/* editarMesLista — atualização da tarefa vinculada        */
/* ======================================================== */

describe('editarMesLista — atualiza tarefa vinculada', () => {
  beforeEach(() => {
    cartoesApi.getFullList.mockResolvedValue([
      { id: 'c0', nome: 'CALENDÁRIO DE POSTS', ordem: 1 },
    ]);
    rcolApi.getFirstListItem.mockRejectedValue({ status: 404 });
    getTarefaMock.mockResolvedValue({
      id: 't1',
      etapas: [
        { id: 'e1', texto: 'Copy', tipo: 'interna', feito: true, feito_por: 'u1', feito_em: '2025-07-01 10:00:00', responsavel: 'old' },
        { id: 'e2', texto: 'Layout', tipo: 'interna', feito: false },
        { id: 'e3', texto: 'Revisão interna', tipo: 'interna', feito: false },
      ],
      responsaveis: ['old-social'],
    });
  });

  it('chama atualizarTarefa com etapas que preservam feito=true da e1', async () => {
    await editarMesLista('q1', LISTA_MES_COM_TAREFA, 'padrao8', 8, [2, 4], 'd1', 's1', 'p1');

    const [, payload] = atualizarTarefaMock.mock.calls[0];
    const e1 = payload.etapas.find((e: { id: string }) => e.id === 'e1');
    expect(e1.feito).toBe(true);
  });

  it('preserva feito_por e feito_em da etapa concluída', async () => {
    await editarMesLista('q1', LISTA_MES_COM_TAREFA, 'padrao8', 8, [2, 4], 'd1', 's1', 'p1');

    const [, payload] = atualizarTarefaMock.mock.calls[0];
    const e1 = payload.etapas.find((e: { id: string }) => e.id === 'e1');
    expect(e1.feito_por).toBe('u1');
    expect(e1.feito_em).toBe('2025-07-01 10:00:00');
  });

  it('seta responsavel via responsavelEtapa (Layout→Design, Copy→Social)', async () => {
    await editarMesLista('q1', LISTA_MES_COM_TAREFA, 'padrao8', 8, [2, 4], 'd1', 's1', 'p1');

    const [, payload] = atualizarTarefaMock.mock.calls[0];
    const eCopy = payload.etapas.find((e: { texto: string }) => e.texto === 'Copy');
    const eLayout = payload.etapas.find((e: { texto: string }) => e.texto === 'Layout');
    expect(eCopy.responsavel).toBe('s1');
    expect(eLayout.responsavel).toBe('d1');
  });

  it('responsaveis = [social, design] sem duplicata quando IDs diferentes', async () => {
    await editarMesLista('q1', LISTA_MES_COM_TAREFA, 'padrao8', 8, [2, 4], 'd1', 's1', 'p1');

    const [, payload] = atualizarTarefaMock.mock.calls[0];
    expect(payload.responsaveis).toEqual(['s1', 'd1']);
  });

  it('responsaveis sem duplicata quando socialId === designId', async () => {
    await editarMesLista('q1', LISTA_MES_COM_TAREFA, 'padrao8', 8, [2, 4], 'same', 'same', 'p1');

    const [, payload] = atualizarTarefaMock.mock.calls[0];
    expect(payload.responsaveis).toEqual(['same']);
  });

  it('atualiza projeto na tarefa', async () => {
    await editarMesLista('q1', LISTA_MES_COM_TAREFA, 'padrao8', 8, [2, 4], 'd1', 's1', 'proj-x');

    const [, payload] = atualizarTarefaMock.mock.calls[0];
    expect(payload.projeto).toBe('proj-x');
  });

  it('não lança se lista não tem tarefa vinculada', async () => {
    await expect(
      editarMesLista('q1', LISTA_MES, 'padrao8', 8, [2, 4], 'd1', 's1', 'p1'),
    ).resolves.toBeUndefined();
  });
});

/* ======================================================== */
/* editarMesLista — chama atualizarConfigRecorrenciaMes    */
/* ======================================================== */

describe('editarMesLista — chama atualizarConfigRecorrenciaMes ao final', () => {
  beforeEach(() => {
    cartoesApi.getFullList.mockResolvedValue([
      { id: 'c0', nome: 'CALENDÁRIO DE POSTS', ordem: 1 },
    ]);
  });

  it('chama update na recorrencia quando registro existe', async () => {
    rcolApi.getFirstListItem.mockResolvedValue({
      id: 'r1', quadro: 'q1', ativa: true, ultimo_mes: 6, ultimo_ano: 2025,
    });

    await editarMesLista('q1', LISTA_MES, 'padrao8', 8, [2, 4], 'd1', 's1', 'p1');

    expect(rcolApi.update).toHaveBeenCalledWith('r1', expect.objectContaining({
      padrao_posts: 'padrao8',
    }));
  });

  it('não lança quando registro de recorrencia não existe (404)', async () => {
    rcolApi.getFirstListItem.mockRejectedValue({ status: 404 });

    await expect(
      editarMesLista('q1', LISTA_MES, 'padrao8', 8, [2, 4]),
    ).resolves.toBeUndefined();
  });
});
