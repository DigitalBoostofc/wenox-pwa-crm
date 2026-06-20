import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { getCliente, deleteCliente } = vi.hoisted(() => ({
  getCliente: vi.fn(),
  deleteCliente: vi.fn(),
}));
const listProjetos = vi.hoisted(() => vi.fn());
const listTarefas = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock('@/clientes/clientesService', () => ({
  getCliente,
  deleteCliente,
  updateCliente: vi.fn(),
  logoUrl: () => '',
}));
vi.mock('@/projetos/projetosService', () => ({ listProjetos }));
vi.mock('@/tarefas/tarefasService', () => ({ listTarefas }));
vi.mock('@/atividade/atividadeService', () => ({
  listAtividade: vi.fn(async () => []),
  addComentario: vi.fn(),
  candidatosMencao: vi.fn(async () => ({ colaboradores: [], clientes: [] })),
  removerComentario: vi.fn(),
}));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'c1' }),
  useHistory: () => ({ push }),
}));
vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'o@w.com', role: 'Owner' } }),
}));

import { ClienteDetailPage } from '@/clientes/ClienteDetailPage';

const clienteBase = {
  id: 'c1', nome_fantasia: 'ACME', telefone: '11988887777',
  categoria: 'Cliente', status: 'Ativo', email: 'a@a.com',
};

describe('ClienteDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCliente.mockResolvedValue(clienteBase);
    listProjetos.mockResolvedValue([]);
    listTarefas.mockResolvedValue([]);
  });

  it('mostra dados e link de WhatsApp', async () => {
    render(<ClienteDetailPage />);
    expect(await screen.findByRole('heading', { name: /ACME/i })).toBeInTheDocument();
    const wpp = screen.getByRole('link', { name: /whatsapp/i });
    expect(wpp).toHaveAttribute('href', expect.stringContaining('wa.me/11988887777'));
  });

  describe('fluxo de apagar', () => {
    async function renderEAbrirDialog() {
      render(<ClienteDetailPage />);
      await screen.findByRole('heading', { name: /ACME/i });
      // um único botão "Apagar" no cabeçalho antes do diálogo abrir
      await userEvent.click(screen.getByRole('button', { name: /^Apagar$/i }));
    }

    it('cliente SEM projetos → diálogo simples; ao confirmar chama deleteCliente e navega', async () => {
      deleteCliente.mockResolvedValue(undefined);

      await renderEAbrirDialog();
      // aguarda listProjetos resolver e dialog mostrar conteúdo
      await screen.findByText('Apagar "ACME"');

      expect(screen.queryByText(/projetos ativos serão apagados/i)).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /apagar definitivamente/i }));

      await waitFor(() => expect(deleteCliente).toHaveBeenCalledWith('c1'));
      expect(push).toHaveBeenCalledWith('/clientes');
    });

    it('cliente com projetos TODOS Inativo → confirmação simples, sem aviso reforçado', async () => {
      listProjetos.mockResolvedValue([
        { id: 'p1', nome: 'Legado 2022', status: 'Inativo', cliente: 'c1' },
      ]);
      deleteCliente.mockResolvedValue(undefined);

      await renderEAbrirDialog();
      await screen.findByText('Apagar "ACME"');

      expect(screen.queryByText(/projetos ativos serão apagados/i)).not.toBeInTheDocument();
      // menciona que projetos inativos também serão removidos
      expect(screen.getByText(/projetos inativos também serão removidos/i)).toBeInTheDocument();
    });

    it('cliente com ≥1 projeto NÃO-Inativo → aviso reforçado listando ativos; só deleta após confirmar', async () => {
      listProjetos.mockResolvedValue([
        { id: 'p1', nome: 'Campanha Q1', status: 'Em andamento', cliente: 'c1' },
        { id: 'p2', nome: 'Legado 2022', status: 'Inativo', cliente: 'c1' },
      ]);
      deleteCliente.mockResolvedValue(undefined);

      await renderEAbrirDialog();
      expect(await screen.findByText(/atenção: projetos ativos serão apagados/i)).toBeInTheDocument();

      // verifica que somente o projeto ativo aparece na lista de aviso
      const listaAtivos = screen.getByRole('list', { name: /projetos que serão apagados/i });
      expect(within(listaAtivos).getByText('Campanha Q1')).toBeInTheDocument();
      expect(within(listaAtivos).queryByText('Legado 2022')).not.toBeInTheDocument();

      // deleteCliente não foi chamado antes da confirmação
      expect(deleteCliente).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: /apagar definitivamente/i }));
      await waitFor(() => expect(deleteCliente).toHaveBeenCalledWith('c1'));
      expect(push).toHaveBeenCalledWith('/clientes');
    });

    it('deleteCliente lança → exibe erro no diálogo, não navega', async () => {
      deleteCliente.mockRejectedValueOnce(new Error('Cascade falhou'));

      await renderEAbrirDialog();
      await screen.findByText('Apagar "ACME"');

      await userEvent.click(screen.getByRole('button', { name: /apagar definitivamente/i }));

      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent(/cascade falhou/i);
      expect(push).not.toHaveBeenCalled();
    });

    it('cancelar não chama deleteCliente', async () => {
      await renderEAbrirDialog();
      await screen.findByText('Apagar "ACME"');

      await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));

      expect(deleteCliente).not.toHaveBeenCalled();
    });
  });
});
