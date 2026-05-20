import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { createCliente, getCliente, updateCliente, push } = vi.hoisted(() => ({
  createCliente: vi.fn(),
  getCliente: vi.fn(),
  updateCliente: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/clientes/clientesService', async () => {
  const real = await vi.importActual<typeof import('@/clientes/clientesService')>(
    '@/clientes/clientesService',
  );
  return {
    ...real,
    createCliente,
    getCliente,
    updateCliente,
    logoUrl: () => '',
  };
});
vi.mock('@/opcoes/opcoesService', () => ({ listOpcoes: vi.fn(async () => []) }));
vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push }),
  useParams: () => ({}),
}));

import { ClienteFormPage } from '@/clientes/ClienteFormPage';

describe('ClienteFormPage (criar)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cria cliente com telefone e e-mail múltiplos, e navega de volta', async () => {
    createCliente.mockResolvedValue({ id: 'novo' });
    render(<ClienteFormPage />);
    await userEvent.type(screen.getByLabelText(/nome fantasia/i), 'ACME');

    // adiciona um telefone
    await userEvent.click(screen.getAllByRole('button', { name: /adicionar/i })[0]);
    await userEvent.type(screen.getByLabelText(/telefones 1 — tipo/i), 'Comercial');
    await userEvent.type(screen.getByLabelText(/telefones 1 — valor/i), '11988887777');

    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));

    expect(createCliente).toHaveBeenCalledWith(
      expect.objectContaining({
        nome_fantasia: 'ACME',
        telefone: '11988887777',
        telefones: [{ tipo: 'Comercial', valor: '11988887777' }],
      }),
      null,
    );
    expect(push).toHaveBeenCalledWith('/clientes');
  });

  it('exige ao menos nome ou nome fantasia', async () => {
    render(<ClienteFormPage />);
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(createCliente).not.toHaveBeenCalled();
    expect(screen.getByText(/informe ao menos um nome/i)).toBeInTheDocument();
  });

  it('aceita só o campo Nome (fantasia opcional)', async () => {
    createCliente.mockResolvedValue({ id: 'novo' });
    render(<ClienteFormPage />);
    await userEvent.type(screen.getByLabelText(/^nome$/i), 'João Silva');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(createCliente).toHaveBeenCalled();
  });

  it('mostra a mensagem de erro quando o create falha', async () => {
    createCliente.mockRejectedValueOnce(new Error('Failed to create record.'));
    render(<ClienteFormPage />);
    await userEvent.type(screen.getByLabelText(/nome fantasia/i), 'ACME');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));
    expect(await screen.findByText(/failed to create record/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
