/**
 * R3.b — EstagioTarefasBloco (dashboard): smoke render.
 * Verifica: heading presente, estado vazio mostra mensagem positiva,
 * com tarefas abertas exibe os nomes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DadosAgencia } from '@/dashboard/useDadosAgencia';

/* ---- Mocks ---- */

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    files: { getURL: () => '' },
    collection: () => ({}),
    authStore: { record: { id: 'u1' } },
  },
}));

vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push: vi.fn() }),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

const mockUseDados = vi.fn<[], DadosAgencia>();
vi.mock('@/dashboard/useDadosAgencia', () => ({
  useDadosAgencia: () => mockUseDados(),
}));

vi.mock('@/tarefas/TarefaSheet', () => ({
  TarefaSheet: () => null,
}));

vi.mock('@/clientes/clientesService', () => ({
  logoUrl: () => '',
}));

import { EstagioTarefasBloco } from '@/dashboard/blocosNegocio';
import type { Tarefa } from '@/tarefas/types';

/* ---- Helpers ---- */

function dadosPadrao(overrides: Partial<DadosAgencia> = {}): DadosAgencia {
  return {
    tarefas: [],
    projetos: [],
    clientes: [],
    usuarios: [],
    carregando: false,
    erro: '',
    refresh: vi.fn(),
    ...overrides,
  };
}

function tarefaAberta(id: string, nome: string): Tarefa {
  return { id, nome, status: 'Em andamento', responsaveis: [], etapas: [] };
}

/* ---- Testes ---- */

describe('EstagioTarefasBloco — R3.b', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza heading "Estágio das Tarefas"', () => {
    mockUseDados.mockReturnValue(dadosPadrao());
    render(<EstagioTarefasBloco />);
    expect(screen.getByRole('heading', { level: 2, name: /estágio das tarefas/i })).toBeInTheDocument();
  });

  it('estado vazio exibe "Nenhuma tarefa aberta."', () => {
    mockUseDados.mockReturnValue(dadosPadrao({ tarefas: [] }));
    render(<EstagioTarefasBloco />);
    expect(screen.getByText(/nenhuma tarefa aberta/i)).toBeInTheDocument();
  });

  it('com tarefas abertas exibe os nomes das tarefas', () => {
    mockUseDados.mockReturnValue(dadosPadrao({
      tarefas: [
        tarefaAberta('t1', 'Criar campanha de redes'),
        tarefaAberta('t2', 'Revisar contrato'),
      ],
    }));
    render(<EstagioTarefasBloco />);
    expect(screen.getByText('Criar campanha de redes')).toBeInTheDocument();
    expect(screen.getByText('Revisar contrato')).toBeInTheDocument();
  });

  it('link "Ver todas" aponta para /tarefas', () => {
    mockUseDados.mockReturnValue(dadosPadrao());
    render(<EstagioTarefasBloco />);
    expect(screen.getByRole('button', { name: /ver todas as tarefas/i })).toBeInTheDocument();
  });

  it('estado carregando exibe skeletons (sem tarefas visíveis)', () => {
    mockUseDados.mockReturnValue(dadosPadrao({ carregando: true, tarefas: [] }));
    render(<EstagioTarefasBloco />);
    // Heading ainda aparece
    expect(screen.getByRole('heading', { level: 2, name: /estágio das tarefas/i })).toBeInTheDocument();
    // Nenhuma tarefa deve aparecer
    expect(screen.queryByRole('button', { name: /abrir tarefa/i })).not.toBeInTheDocument();
  });

  it('tarefas concluídas não aparecem na lista', () => {
    mockUseDados.mockReturnValue(dadosPadrao({
      tarefas: [
        { id: 't1', nome: 'Aberta', status: 'Em andamento' },
        { id: 't2', nome: 'Concluída', status: 'Concluído' },
      ] as Tarefa[],
    }));
    render(<EstagioTarefasBloco />);
    expect(screen.getByText('Aberta')).toBeInTheDocument();
    expect(screen.queryByText('Concluída')).not.toBeInTheDocument();
  });

  it('tarefa com etapa de aprovacao_cliente mostra avatar "C"', () => {
    const tarefa: Tarefa = {
      id: 't3',
      nome: 'Aprovação pendente',
      status: 'Aguardando aprovação',
      etapas: [
        { id: 'e1', texto: 'Revisão interna', tipo: 'interna', feito: true },
        { id: 'e2', texto: 'Aprovação do cliente', tipo: 'aprovacao_cliente', feito: false },
      ],
    };
    mockUseDados.mockReturnValue(dadosPadrao({ tarefas: [tarefa] }));
    render(<EstagioTarefasBloco />);

    expect(
      screen.getByRole('generic', { name: /aguardando aprovação do cliente/i }),
    ).toBeInTheDocument();
  });
});
