/**
 * Cobre QuadroBoardPage — feature "Editar lista de mês":
 *   - Item "Editar" aparece no DropdownMenu SÓ quando l.tipo === 'mes'
 *   - Abrir modal pré-preenche projeto e tipoQtd a partir do state recorrencia
 *   - Botão "Salvar" desabilitado enquanto não há projeto selecionado
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

/* ---- mocks de infraestrutura ---- */

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

vi.mock('@/components/layout/HeaderSlot', () => ({
  HeaderSlot: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/quadros/CartaoSheet', () => ({
  CartaoSheet: () => null,
}));

vi.mock('@/clientes/clientesService', () => ({
  logoUrl: () => '',
}));

/* ---- mocks dos serviços (hoisted) ---- */

const {
  getQuadroMock,
  listListasMock,
  listCartoesMock,
  getRecorrenciaMesMock,
  salvarRecorrenciaMesMock,
  desativarRecorrenciaMesMock,
  editarMesListaMock,
  listUsuariosMock,
  criarListaMesMock,
  getCardsTemplateMesMock,
  gerarPostsMesMock,
  vincularTarefaListaMock,
  criarTarefaSocialMediaMock,
  listProjetosMock,
} = vi.hoisted(() => ({
  getQuadroMock: vi.fn(),
  listListasMock: vi.fn(),
  listCartoesMock: vi.fn(),
  getRecorrenciaMesMock: vi.fn(),
  salvarRecorrenciaMesMock: vi.fn(),
  desativarRecorrenciaMesMock: vi.fn(),
  editarMesListaMock: vi.fn(),
  listUsuariosMock: vi.fn(),
  criarListaMesMock: vi.fn(),
  getCardsTemplateMesMock: vi.fn(),
  gerarPostsMesMock: vi.fn(),
  vincularTarefaListaMock: vi.fn(),
  criarTarefaSocialMediaMock: vi.fn(),
  listProjetosMock: vi.fn(),
}));

vi.mock('@/quadros/quadrosService', () => ({
  getQuadro: getQuadroMock,
  listListas: listListasMock,
  listCartoes: listCartoesMock,
  getRecorrenciaMes: getRecorrenciaMesMock,
  salvarRecorrenciaMes: salvarRecorrenciaMesMock,
  desativarRecorrenciaMes: desativarRecorrenciaMesMock,
  editarMesLista: editarMesListaMock,
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
  criarListaMes: criarListaMesMock,
  getCardsTemplateMes: getCardsTemplateMesMock,
  clonarCardTemplate: vi.fn(),
  gerarPostsMes: gerarPostsMesMock,
  vincularTarefaLista: vincularTarefaListaMock,
  criarTarefaSocialMedia: criarTarefaSocialMediaMock,
  MESES_PT: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ],
  DIAS_SEMANA_CURTO: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
}));

vi.mock('@/usuarios/usuariosService', () => ({
  listUsuarios: listUsuariosMock,
}));

vi.mock('@/projetos/projetosService', () => ({
  listProjetos: listProjetosMock,
}));

import { QuadroBoardPage } from '@/quadros/QuadroBoardPage';

/* ---- dados de fixture ---- */

const QUADRO_BASE = { id: 'q1', nome: 'Quadro Teste', cliente: 'c1' };

const LISTA_MES = {
  id: 'l1',
  nome: 'Julho/2025',
  tipo: 'mes' as const,
  mes: 7,
  ano: 2025,
  quadro: 'q1',
  ordem: 1,
};

const LISTA_NORMAL = {
  id: 'l2',
  nome: 'Backlog',
  tipo: '' as const,
  quadro: 'q1',
  ordem: 2,
};

const PROJETOS = [{ id: 'p1', nome: 'Projeto X', cliente: 'c1' }];

const RECORRENCIA_PADRAO12 = {
  id: 'r1',
  quadro: 'q1',
  ativa: true,
  padrao_posts: 'padrao12',
  qtd_custom: 10,
  dias_custom: [1, 3, 5],
  design_id: 'd1',
  social_id: 's1',
  projeto_id: 'p1',
  ultimo_mes: 6,
  ultimo_ano: 2025,
};

function setupBase() {
  getQuadroMock.mockResolvedValue(QUADRO_BASE);
  listListasMock.mockResolvedValue([]);
  listCartoesMock.mockResolvedValue([]);
  getRecorrenciaMesMock.mockResolvedValue(null);
  listUsuariosMock.mockResolvedValue([]);
  listProjetosMock.mockResolvedValue(PROJETOS);
  editarMesListaMock.mockResolvedValue(undefined);
}

/* ======================================================== */
/* Item "Editar" no menu da lista                           */
/* ======================================================== */

describe('QuadroBoardPage — item "Editar" no dropdown da lista', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBase();
  });

  it('aparece quando l.tipo === "mes"', async () => {
    const user = userEvent.setup();
    listListasMock.mockResolvedValue([LISTA_MES]);
    render(<QuadroBoardPage id="q1" />);

    await screen.findByText('Julho/2025');

    const trigger = screen.getByRole('button', { name: 'Ações da lista' });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument();
    });
  });

  it('NÃO aparece quando l.tipo não é "mes"', async () => {
    const user = userEvent.setup();
    listListasMock.mockResolvedValue([LISTA_NORMAL]);
    render(<QuadroBoardPage id="q1" />);

    await screen.findByText('Backlog');

    const trigger = screen.getByRole('button', { name: 'Ações da lista' });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Renomear' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('menuitem', { name: 'Editar' })).not.toBeInTheDocument();
  });
});

/* ======================================================== */
/* Modal pré-preenchido com valores de recorrencia         */
/* ======================================================== */

describe('QuadroBoardPage — modal "Editar mês" pré-preenchido', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBase();
    listListasMock.mockResolvedValue([LISTA_MES]);
    getRecorrenciaMesMock.mockResolvedValue(RECORRENCIA_PADRAO12);
  });

  async function abrirModalEditar() {
    const user = userEvent.setup();
    render(<QuadroBoardPage id="q1" />);
    await screen.findByText('Julho/2025');

    const trigger = screen.getByRole('button', { name: 'Ações da lista' });
    await user.click(trigger);

    const editarItem = await screen.findByRole('menuitem', { name: 'Editar' });
    await user.click(editarItem);

    await screen.findByRole('dialog');
  }

  it('abre o dialog "Editar mês" ao clicar em Editar', async () => {
    await abrirModalEditar();
    expect(screen.getByText(/editar mês/i)).toBeInTheDocument();
  });

  it('pré-preenche projeto a partir de recorrencia.projeto_id', async () => {
    await abrirModalEditar();

    const selectProjeto = screen.getByLabelText(/projeto/i);
    // O projeto_id da recorrencia é 'p1', que é uma opção no select
    expect((selectProjeto as HTMLSelectElement).value).toBe('p1');
  });
});

/* ======================================================== */
/* Botão "Salvar" desabilitado sem projeto                  */
/* ======================================================== */

describe('QuadroBoardPage — botão "Salvar" no modal de edição', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBase();
    listListasMock.mockResolvedValue([LISTA_MES]);
    // recorrencia sem projeto_id → editProjetoSel inicia em ''
    getRecorrenciaMesMock.mockResolvedValue({
      id: 'r1',
      quadro: 'q1',
      ativa: true,
      padrao_posts: 'padrao8',
      ultimo_mes: 6,
      ultimo_ano: 2025,
    });
  });

  async function abrirModal() {
    const user = userEvent.setup();
    render(<QuadroBoardPage id="q1" />);
    await screen.findByText('Julho/2025');

    const trigger = screen.getByRole('button', { name: 'Ações da lista' });
    await user.click(trigger);

    const editarItem = await screen.findByRole('menuitem', { name: 'Editar' });
    await user.click(editarItem);

    await screen.findByRole('dialog');
  }

  it('botão "Salvar" está desabilitado quando editProjetoSel = ""', async () => {
    await abrirModal();

    const salvarBtn = screen.getByRole('button', { name: /salvar/i });
    expect(salvarBtn).toBeDisabled();
  });

  it('botão "Salvar" fica habilitado após selecionar projeto', async () => {
    await abrirModal();

    const selectProjeto = screen.getByLabelText(/projeto/i);
    fireEvent.change(selectProjeto, { target: { value: 'p1' } });

    const salvarBtn = screen.getByRole('button', { name: /salvar/i });
    expect(salvarBtn).not.toBeDisabled();
  });
});
