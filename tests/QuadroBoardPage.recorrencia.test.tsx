/**
 * Fase B — QuadroBoardPage: toggle de recorrência mensal + selo "ativa".
 *
 * Toggle (dentro do Dialog "Adicionar mês"):
 *   - renderiza com role="switch" aria-checked=false
 *   - ao clicar, aria-checked=true e nota "Todo dia 01..." aparece
 *
 * Selo (header do board):
 *   - aparece quando getRecorrenciaMes retorna { ativa: true }
 *   - botão × tem aria-label "Desativar recorrência mensal"
 *   - clicar no × dispara desativarRecorrenciaMes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

/* ---- Mocks de infraestrutura ---- */

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={String(to)}>{children}</a>
  ),
}));

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    files: { getURL: () => '' },
    collection: () => ({}),
    filter: () => '',
    authStore: { record: { id: 'u1' } },
  },
}));

/* HeaderSlot renderiza children diretamente para que o badge fique acessível */
vi.mock('@/components/layout/HeaderSlot', () => ({
  HeaderSlot: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/quadros/CartaoSheet', () => ({
  CartaoSheet: () => null,
}));

vi.mock('@/clientes/clientesService', () => ({
  logoUrl: () => '',
}));

/* ---- Mocks dos serviços (hoisted para uso no corpo dos testes) ---- */

const {
  getQuadroMock,
  listListasMock,
  listCartoesMock,
  getRecorrenciaMesMock,
  salvarRecorrenciaMesMock,
  desativarRecorrenciaMesMock,
  listUsuariosMock,
} = vi.hoisted(() => ({
  getQuadroMock: vi.fn(),
  listListasMock: vi.fn(),
  listCartoesMock: vi.fn(),
  getRecorrenciaMesMock: vi.fn(),
  salvarRecorrenciaMesMock: vi.fn(),
  desativarRecorrenciaMesMock: vi.fn(),
  listUsuariosMock: vi.fn(),
}));

vi.mock('@/quadros/quadrosService', () => ({
  getQuadro: getQuadroMock,
  listListas: listListasMock,
  listCartoes: listCartoesMock,
  getRecorrenciaMes: getRecorrenciaMesMock,
  salvarRecorrenciaMes: salvarRecorrenciaMesMock,
  desativarRecorrenciaMes: desativarRecorrenciaMesMock,
  /* funções chamadas apenas por interações não exercitadas nestes testes */
  moverCartao: vi.fn(),
  criarCartao: vi.fn(),
  criarLista: vi.fn(),
  atualizarLista: vi.fn(),
  arquivarLista: vi.fn(),
  listCartoesArquivados: vi.fn(),
  arquivarCartao: vi.fn(),
  listListasArquivadas: vi.fn(),
  restaurarLista: vi.fn(),
  removerCartao: vi.fn(),
  deletarListaComCards: vi.fn(),
  criarListaMes: vi.fn(),
  getCardsTemplateMes: vi.fn(),
  clonarCardTemplate: vi.fn(),
  gerarPostsMes: vi.fn(),
  vincularTarefaLista: vi.fn(),
  criarTarefaSocialMedia: vi.fn(),
  /* constantes usadas no JSX do Dialog */
  MESES_PT: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ],
  DIAS_SEMANA_CURTO: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
}));

vi.mock('@/usuarios/usuariosService', () => ({
  listUsuarios: listUsuariosMock,
}));

/* ---- import do componente (após todos os vi.mock) ---- */
import { QuadroBoardPage } from '@/quadros/QuadroBoardPage';

/* ---- helpers ---- */

const QUADRO_BASE = { id: 'q1', nome: 'Quadro Teste', cliente: 'c1' };

function setupBase() {
  getQuadroMock.mockResolvedValue(QUADRO_BASE);
  listListasMock.mockResolvedValue([]);
  listCartoesMock.mockResolvedValue([]);
  getRecorrenciaMesMock.mockResolvedValue(null);
  listUsuariosMock.mockResolvedValue([]);
}

/* ======================================================== */
/* Toggle "Recorrência mensal" (dentro do Dialog)           */
/* ======================================================== */

describe('QuadroBoardPage — toggle Recorrência mensal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBase();
  });

  it('renderiza toggle com role="switch" e aria-checked=false', async () => {
    render(<QuadroBoardPage id="q1" />);

    /* aguarda carregamento do quadro (loading state some) */
    const addMesBtn = await screen.findByRole('button', { name: /adicionar mês/i });
    fireEvent.click(addMesBtn);

    const toggle = await screen.findByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('ao clicar no toggle, aria-checked vira true', async () => {
    render(<QuadroBoardPage id="q1" />);

    const addMesBtn = await screen.findByRole('button', { name: /adicionar mês/i });
    fireEvent.click(addMesBtn);

    const toggle = await screen.findByRole('switch');
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('ao ativar o toggle, exibe nota "Todo dia 01..."', async () => {
    render(<QuadroBoardPage id="q1" />);

    const addMesBtn = await screen.findByRole('button', { name: /adicionar mês/i });
    fireEvent.click(addMesBtn);

    const toggle = await screen.findByRole('switch');
    fireEvent.click(toggle);

    expect(screen.getByText(/todo dia 01/i)).toBeInTheDocument();
  });
});

/* ======================================================== */
/* Selo "Recorrência mensal ativa" (header do board)        */
/* ======================================================== */

describe('QuadroBoardPage — selo "Recorrência mensal ativa"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBase();
    getRecorrenciaMesMock.mockResolvedValue({
      id: 'r1',
      quadro: 'q1',
      ativa: true,
      ultimo_mes: 6,
      ultimo_ano: 2025,
    });
    desativarRecorrenciaMesMock.mockResolvedValue(undefined);
  });

  it('aparece quando getRecorrenciaMes retorna { ativa: true }', async () => {
    render(<QuadroBoardPage id="q1" />);
    expect(await screen.findByText('Recorrência mensal ativa')).toBeInTheDocument();
  });

  it('não aparece quando getRecorrenciaMes retorna null', async () => {
    getRecorrenciaMesMock.mockResolvedValue(null);
    render(<QuadroBoardPage id="q1" />);
    /* aguarda o quadro carregar para ter certeza do estado final */
    await screen.findByRole('button', { name: /adicionar mês/i });
    expect(screen.queryByText('Recorrência mensal ativa')).not.toBeInTheDocument();
  });

  it('botão × tem aria-label "Desativar recorrência mensal"', async () => {
    render(<QuadroBoardPage id="q1" />);
    const btn = await screen.findByRole('button', { name: 'Desativar recorrência mensal' });
    expect(btn).toBeInTheDocument();
  });

  it('clicar no × dispara desativarRecorrenciaMes com o id do quadro', async () => {
    window.confirm = vi.fn().mockReturnValue(true);

    render(<QuadroBoardPage id="q1" />);
    const btn = await screen.findByRole('button', { name: 'Desativar recorrência mensal' });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(desativarRecorrenciaMesMock).toHaveBeenCalledWith('q1');
    });
  });
});
