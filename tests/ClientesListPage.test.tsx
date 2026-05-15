import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { listClientes } = vi.hoisted(() => ({ listClientes: vi.fn() }));
vi.mock('@/clientes/clientesService', () => ({ listClientes }));
vi.mock('react-router-dom', () => ({ useHistory: () => ({ push: vi.fn() }) }));

import { ClientesListPage } from '@/clientes/ClientesListPage';

describe('ClientesListPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista clientes ao montar', async () => {
    listClientes.mockResolvedValue([
      { id: '1', nome_fantasia: 'ACME', status: 'Ativo', telefone: '11', categoria: 'Cliente' },
    ]);
    render(<ClientesListPage />);
    expect(await screen.findByText('ACME')).toBeInTheDocument();
    expect(listClientes).toHaveBeenCalledWith('');
  });

  it('refaz a busca ao digitar', async () => {
    listClientes.mockResolvedValue([]);
    render(<ClientesListPage />);
    await waitFor(() => expect(listClientes).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText(/buscar/i), 'acme');
    await waitFor(() =>
      expect(listClientes).toHaveBeenLastCalledWith('acme')
    );
  });
});
