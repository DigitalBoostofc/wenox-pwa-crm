/**
 * R3.d — MeuDiaBloco: hero "Sua vez agora" aparece com as tarefas certas;
 * estado vazio exibe mensagem positiva "Tudo em dia!".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DadosAgencia } from '@/dashboard/useDadosAgencia';
import type { Tarefa } from '@/tarefas/types';

/* ---- Mocks ---- */

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    files: { getURL: () => '' },
    collection: () => ({ getOne: vi.fn() }),
    authStore: { record: { id: 'u1' } },
  },
}));

// sem router real — blocos.tsx importa useHistory mas MeuDiaBloco não chama
vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push: vi.fn() }),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', nome: 'Leo', email: 'leo@wenox.com' } }),
}));

const mockUseDados = vi.fn<[], DadosAgencia>();
vi.mock('@/dashboard/useDadosAgencia', () => ({
  useDadosAgencia: () => mockUseDados(),
}));

vi.mock('@/tarefas/tarefasService', () => ({
  concluirTarefa: vi.fn().mockResolvedValue({}),
  reabrirTarefa: vi.fn().mockResolvedValue({}),
  criarTarefa: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/tarefas/TarefaSheet', () => ({ TarefaSheet: () => null }));
vi.mock('@/tarefas/TarefaViewSheet', () => ({ TarefaViewSheet: () => null }));
vi.mock('@/tarefas/QuickAddTarefa', () => ({
  QuickAddTarefa: () => <div data-testid="quick-add" />,
}));
vi.mock('@/tarefas/MinhaSemanaList', () => ({
  MinhaSemanaList: () => null,
  parsePrazo: (s?: string) => (s ? new Date(s) : null),
}));
vi.mock('@/minha-area/MeusDadosSheet', () => ({ MeusDadosSheet: () => null }));

// blocosDesempenho usa useDadosAgencia internamente — já está mockado
vi.mock('@/dashboard/blocosDesempenho', () => ({
  PainelDesempenho: () => null,
  resumoDeMembro: () => ({}),
}));

import { MeuDiaBloco } from '@/minha-area/blocos';

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

function tarefaDoUsuario(id: string, nome: string, extra: Partial<Tarefa> = {}): Tarefa {
  return {
    id,
    nome,
    status: 'Em andamento',
    responsaveis: ['u1'],
    etapas: [],
    ...extra,
  };
}

/* ---- Testes ---- */

describe('MeuDiaBloco — R3.d hero "Sua vez agora"', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza heading "Meu Dia"', () => {
    mockUseDados.mockReturnValue(dadosPadrao());
    render(<MeuDiaBloco />);
    expect(screen.getByRole('heading', { level: 2, name: /meu dia/i })).toBeInTheDocument();
  });

  it('renderiza heading "Sua vez agora"', () => {
    mockUseDados.mockReturnValue(dadosPadrao());
    render(<MeuDiaBloco />);
    expect(screen.getByRole('heading', { level: 3, name: /sua vez agora/i })).toBeInTheDocument();
  });

  it('estado vazio exibe "Tudo em dia!"', () => {
    mockUseDados.mockReturnValue(dadosPadrao({ tarefas: [] }));
    render(<MeuDiaBloco />);
    expect(screen.getByText(/tudo em dia!/i)).toBeInTheDocument();
  });

  it('estado vazio exibe mensagem de suporte "Nenhuma tarefa aguardando"', () => {
    mockUseDados.mockReturnValue(dadosPadrao({ tarefas: [] }));
    render(<MeuDiaBloco />);
    expect(screen.getByText(/nenhuma tarefa aguardando por você/i)).toBeInTheDocument();
  });

  it('exibe nome da tarefa que é vez do usuário (sem etapas)', () => {
    mockUseDados.mockReturnValue(dadosPadrao({
      tarefas: [tarefaDoUsuario('t1', 'Publicar post no Instagram')],
    }));
    render(<MeuDiaBloco />);
    expect(screen.getByText('Publicar post no Instagram')).toBeInTheDocument();
  });

  it('exibe múltiplas tarefas da vez do usuário', () => {
    mockUseDados.mockReturnValue(dadosPadrao({
      tarefas: [
        tarefaDoUsuario('t1', 'Tarefa Alpha'),
        tarefaDoUsuario('t2', 'Tarefa Beta'),
      ],
    }));
    render(<MeuDiaBloco />);
    expect(screen.getByText('Tarefa Alpha')).toBeInTheDocument();
    expect(screen.getByText('Tarefa Beta')).toBeInTheDocument();
  });

  it('tarefa concluída não aparece em "Sua vez agora"', () => {
    mockUseDados.mockReturnValue(dadosPadrao({
      tarefas: [
        tarefaDoUsuario('t1', 'Ativa'),
        tarefaDoUsuario('t2', 'Concluída', { status: 'Concluído' }),
      ],
    }));
    render(<MeuDiaBloco />);
    expect(screen.getByText('Ativa')).toBeInTheDocument();
    expect(screen.queryByText('Concluída')).not.toBeInTheDocument();
  });

  it('tarefa de outro usuário não aparece para u1', () => {
    mockUseDados.mockReturnValue(dadosPadrao({
      tarefas: [
        { id: 't1', nome: 'Tarefa de u2', status: 'Em andamento', responsaveis: ['u2'] },
      ] as Tarefa[],
    }));
    render(<MeuDiaBloco />);
    expect(screen.queryByText('Tarefa de u2')).not.toBeInTheDocument();
    expect(screen.getByText(/tudo em dia!/i)).toBeInTheDocument();
  });

  it('estado carregando exibe skeletons sem tarefas visíveis', () => {
    mockUseDados.mockReturnValue(dadosPadrao({ carregando: true }));
    render(<MeuDiaBloco />);
    // heading ainda presente
    expect(screen.getByRole('heading', { level: 2, name: /meu dia/i })).toBeInTheDocument();
    // nenhum card de tarefa
    expect(screen.queryByRole('button', { name: /abrir tarefa/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/tudo em dia!/i)).not.toBeInTheDocument();
  });

  it('não exibe Quick Add quando somenteLeitura=true', () => {
    mockUseDados.mockReturnValue(dadosPadrao());
    render(<MeuDiaBloco somenteLeitura />);
    expect(screen.queryByTestId('quick-add')).not.toBeInTheDocument();
  });

  it('exibe Quick Add quando somenteLeitura=false (padrão)', () => {
    mockUseDados.mockReturnValue(dadosPadrao());
    render(<MeuDiaBloco />);
    expect(screen.getByTestId('quick-add')).toBeInTheDocument();
  });
});
