/**
 * fix/tarefa-area-tipo — criarTarefaSocialMedia grava tipo='Social Media'
 * e lógica do filtro de área em TarefasListPage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { criarTarefaMock, rcolApi } = vi.hoisted(() => ({
  criarTarefaMock: vi.fn(),
  rcolApi: {
    getFirstListItem: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    getList: vi.fn(),
    getFullList: vi.fn(),
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

import { criarTarefaSocialMedia } from '@/quadros/quadrosService';

/* ============================================================ */
/* criarTarefaSocialMedia — campo tipo                          */
/* ============================================================ */

describe('criarTarefaSocialMedia — campo tipo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    criarTarefaMock.mockResolvedValue({ id: 't1', nome: '' });
  });

  it('grava tipo="Social Media" no payload', async () => {
    await criarTarefaSocialMedia('c1', 7, 2025, { designId: 'd1', socialId: 's1' }, 'Click Vistoria');
    expect(criarTarefaMock).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'Social Media' }),
    );
  });

  it('tipo="Social Media" presente mesmo sem nomeCliente', async () => {
    await criarTarefaSocialMedia('c1', 6, 2025, { socialId: 's1' });
    expect(criarTarefaMock).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'Social Media' }),
    );
  });

  it('tipo="Social Media" presente sem responsáveis', async () => {
    await criarTarefaSocialMedia('c1', 1, 2025);
    expect(criarTarefaMock).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'Social Media' }),
    );
  });
});

/* ============================================================ */
/* Lógica do filtro de área (extraída de TarefasListPage)       */
/* ============================================================ */

/** Replica exatamente a lógica da linha 180 de TarefasListPage.tsx */
function filtrarPorTipo(
  tarefas: Array<{ tipo?: string; projeto?: string; expand?: { projeto?: { tipo?: string } } }>,
  tipoAtivo: string,
) {
  if (!tipoAtivo) return tarefas;
  return tarefas.filter((t) =>
    t.tipo ? t.tipo === tipoAtivo : (!t.projeto || t.expand?.projeto?.tipo === tipoAtivo),
  );
}

describe('filtro de área — tarefa COM tipo explícito', () => {
  const tarefaSM = { id: 't1', tipo: 'Social Media', projeto: '' };
  const tarefaDesign = { id: 't2', tipo: 'Design', projeto: '' };

  it('aparece em Social Media quando tipo="Social Media"', () => {
    const res = filtrarPorTipo([tarefaSM], 'Social Media');
    expect(res.map(t => t.id)).toContain('t1');
  });

  it('NÃO aparece em Design quando tipo="Social Media"', () => {
    const res = filtrarPorTipo([tarefaSM], 'Design');
    expect(res.map(t => t.id)).not.toContain('t1');
  });

  it('NÃO aparece em outras áreas (ex.: Sites)', () => {
    const res = filtrarPorTipo([tarefaSM], 'Sites');
    expect(res).toHaveLength(0);
  });

  it('tarefa com tipo="Design" aparece em Design', () => {
    const res = filtrarPorTipo([tarefaDesign], 'Design');
    expect(res.map(t => t.id)).toContain('t2');
  });

  it('tarefa com tipo="Design" NÃO aparece em Social Media', () => {
    const res = filtrarPorTipo([tarefaDesign], 'Social Media');
    expect(res).toHaveLength(0);
  });
});

describe('filtro de área — tarefa SEM tipo (comportamento antigo preservado)', () => {
  const tarefaAvulsa = { id: 'av1', projeto: '' };
  const tarefaComProjSM = { id: 'pj1', projeto: 'proj1', expand: { projeto: { tipo: 'Social Media' } } };
  const tarefaComProjDesign = { id: 'pj2', projeto: 'proj2', expand: { projeto: { tipo: 'Design' } } };

  it('avulsa (sem projeto) aparece em qualquer área quando sem tipo', () => {
    expect(filtrarPorTipo([tarefaAvulsa], 'Social Media')).toHaveLength(1);
    expect(filtrarPorTipo([tarefaAvulsa], 'Design')).toHaveLength(1);
    expect(filtrarPorTipo([tarefaAvulsa], 'Sites')).toHaveLength(1);
  });

  it('com projeto Social Media aparece em Social Media', () => {
    const res = filtrarPorTipo([tarefaComProjSM], 'Social Media');
    expect(res.map(t => t.id)).toContain('pj1');
  });

  it('com projeto Social Media NÃO aparece em Design', () => {
    const res = filtrarPorTipo([tarefaComProjSM], 'Design');
    expect(res).toHaveLength(0);
  });

  it('com projeto Design aparece em Design', () => {
    const res = filtrarPorTipo([tarefaComProjDesign], 'Design');
    expect(res.map(t => t.id)).toContain('pj2');
  });
});

describe('filtro de área — sem filtro ativo', () => {
  const tarefas = [
    { id: 't1', tipo: 'Social Media', projeto: '' },
    { id: 't2', projeto: 'p1', expand: { projeto: { tipo: 'Design' } } },
    { id: 't3', projeto: '' },
  ];

  it('retorna todas as tarefas quando tipoAtivo é vazio', () => {
    expect(filtrarPorTipo(tarefas, '')).toHaveLength(3);
  });
});
