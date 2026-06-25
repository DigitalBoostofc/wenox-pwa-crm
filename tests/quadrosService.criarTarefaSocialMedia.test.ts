import { describe, it, expect, vi, beforeEach } from 'vitest';

// pb mock — distingue coleção tarefas para capturar o update forçado de status.
const tarefasApi = { update: vi.fn() };
const otherApi = { create: vi.fn(), update: vi.fn(), getFullList: vi.fn(), getFirstListItem: vi.fn() };

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    collection: (name: string) => (name === 'tarefas' ? tarefasApi : otherApi),
    filter: (f: string) => f,
  },
}));

// Captura o payload passado a criarTarefa para verificar prazo e projeto.
let criarTarefaInput: Record<string, unknown> | null = null;
vi.mock('@/tarefas/tarefasService', () => ({
  criarTarefa: vi.fn(async (input: Record<string, unknown>) => {
    criarTarefaInput = input;
    return { id: 'tarefa-id-mock', ...input };
  }),
  concluirEtapa: vi.fn(),
  getTarefa: vi.fn(),
}));

vi.mock('@/tarefas/status', () => ({
  statusInicial: () => 'Não iniciado',
  statusDoPapel: (papel: string) => {
    if (papel === 'em_andamento') return 'Em andamento';
    if (papel === 'inicial') return 'Não iniciado';
    return undefined;
  },
  opcaoIdDoStatusPost: (sp: string) => (({
    em_producao: 'op_em_producao', agendar: 'op_agendar', agendado: 'op_agendado',
    postado: 'op_postado', em_alteracao: 'op_em_alteracao',
  } as Record<string, string>)[sp]),
}));

vi.mock('@/clientes/clientesService', () => ({ logoUrl: vi.fn() }));
vi.mock('@/quadros/modeloPost', () => ({ carregarModeloRemoto: vi.fn() }));

import { criarTarefaSocialMedia } from '@/quadros/quadrosService';

describe('criarTarefaSocialMedia — prazo, projeto e status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    criarTarefaInput = null;
    tarefasApi.update.mockResolvedValue({});
  });

  // Prazo = dia 30 do MÊS ANTERIOR ao gerado, com rollover de ano e clamp.
  it('prazo Agosto/2026 → 2026-07-30 (dia 30 de Julho, mês anterior)', async () => {
    await criarTarefaSocialMedia('cli1', 8, 2026);
    expect(criarTarefaInput?.prazo).toBe('2026-07-30');
  });

  it('prazo Julho/2026 → 2026-06-30 (dia 30 de Junho, mês anterior)', async () => {
    await criarTarefaSocialMedia('cli1', 7, 2026);
    expect(criarTarefaInput?.prazo).toBe('2026-06-30');
  });

  it('prazo Janeiro/2027 → 2026-12-30 (dia 30 de Dezembro, com rollover de ano)', async () => {
    await criarTarefaSocialMedia('cli1', 1, 2027);
    expect(criarTarefaInput?.prazo).toBe('2026-12-30');
  });

  it('prazo Março/2026 → 2026-02-28 (clampado para último dia de Fevereiro não-bissexto)', async () => {
    await criarTarefaSocialMedia('cli1', 3, 2026);
    expect(criarTarefaInput?.prazo).toBe('2026-02-28');
  });

  it('prazo Março/2024 → 2024-02-29 (clampado para último dia de Fevereiro bissexto)', async () => {
    await criarTarefaSocialMedia('cli1', 3, 2024);
    expect(criarTarefaInput?.prazo).toBe('2024-02-29');
  });

  it('grava projetoId no campo projeto quando fornecido', async () => {
    await criarTarefaSocialMedia('cli1', 7, 2026, undefined, undefined, 'proj-abc');
    expect(criarTarefaInput?.projeto).toBe('proj-abc');
  });

  it('grava string vazia no campo projeto quando projetoId omitido', async () => {
    await criarTarefaSocialMedia('cli1', 7, 2026);
    expect(criarTarefaInput?.projeto).toBe('');
  });

  it('força status Em andamento via update direto após criar tarefa', async () => {
    await criarTarefaSocialMedia('cli1', 7, 2026);
    expect(tarefasApi.update).toHaveBeenCalledWith('tarefa-id-mock', { status: 'Em andamento' });
  });

  it('não lança erro se o update de status falhar — tarefa ainda é retornada', async () => {
    tarefasApi.update.mockRejectedValueOnce(new Error('network'));
    const resultado = await criarTarefaSocialMedia('cli1', 7, 2026);
    expect(resultado.id).toBe('tarefa-id-mock');
  });
});
