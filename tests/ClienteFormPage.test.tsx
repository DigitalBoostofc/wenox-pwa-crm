import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { createCliente, getCliente, updateCliente, push } = vi.hoisted(() => ({
  createCliente: vi.fn(),
  getCliente: vi.fn(),
  updateCliente: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/clientes/clientesService', () => ({ createCliente, getCliente, updateCliente }));
vi.mock('@/opcoes/opcoesService', () => ({ listOpcoes: vi.fn(async () => []) }));
vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push }),
  useParams: () => ({}),
}));

import { ClienteFormPage } from '@/clientes/ClienteFormPage';

describe('ClienteFormPage (criar)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cria cliente e navega de volta', async () => {
    createCliente.mockResolvedValue({ id: 'novo' });
    render(<ClienteFormPage />);
    await userEvent.type(screen.getByLabelText(/nome fantasia/i), 'ACME');
    await userEvent.type(screen.getByLabelText(/telefone/i), '11988887777');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(createCliente).toHaveBeenCalledWith(
      expect.objectContaining({ nome_fantasia: 'ACME', telefone: '11988887777' })
    );
    expect(push).toHaveBeenCalledWith('/clientes');
  });

  it('exige nome fantasia', async () => {
    render(<ClienteFormPage />);
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(createCliente).not.toHaveBeenCalled();
    expect(screen.getByText(/nome fantasia é obrigatório/i)).toBeInTheDocument();
  });

  it('mostra a mensagem de erro quando o create falha', async () => {
    createCliente.mockRejectedValueOnce(new Error('Failed to create record.'));
    render(<ClienteFormPage />);
    await userEvent.type(screen.getByLabelText(/nome fantasia/i), 'ACME');
    await userEvent.type(screen.getByLabelText(/telefone/i), '11999990000');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(await screen.findByText(/failed to create record/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
