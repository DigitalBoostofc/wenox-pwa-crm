import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { listClientes } = vi.hoisted(() => ({ listClientes: vi.fn() }));
vi.mock('@/clientes/clientesService', () => ({ listClientes, logoUrl: () => '' }));
vi.mock('react-router-dom', () => ({ useHistory: () => ({ push: vi.fn() }) }));
vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'o@o.com', role: 'Owner' }, login: vi.fn(), logout: vi.fn() }),
}));

import { ClientesListPage } from '@/clientes/ClientesListPage';
import { HeaderSlotProvider, HeaderSlotTarget } from '@/components/layout/HeaderSlot';

/** A página projeta a barra de busca no Header via HeaderSlot — o teste
 *  precisa do provider + target pra o portal renderizar. */
function renderComHeader(ui: React.ReactElement) {
  return render(
    <HeaderSlotProvider>
      <HeaderSlotTarget />
      {ui}
    </HeaderSlotProvider>,
  );
}

describe('ClientesListPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista clientes ao montar', async () => {
    listClientes.mockResolvedValue([
      { id: '1', nome_fantasia: 'ACME', status: 'Ativo', telefone: '11', categoria: 'Cliente' },
    ]);
    renderComHeader(<ClientesListPage />);
    expect(await screen.findByText('ACME')).toBeInTheDocument();
    expect(listClientes).toHaveBeenCalledWith('');
  });

  it('refaz a busca ao digitar', async () => {
    listClientes.mockResolvedValue([]);
    renderComHeader(<ClientesListPage />);
    await waitFor(() => expect(listClientes).toHaveBeenCalled());
    await userEvent.type(screen.getByPlaceholderText(/buscar/i), 'acme');
    await waitFor(() =>
      expect(listClientes).toHaveBeenLastCalledWith('acme')
    );
  });
});
