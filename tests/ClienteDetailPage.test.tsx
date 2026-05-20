import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { getCliente } = vi.hoisted(() => ({ getCliente: vi.fn() }));
vi.mock('@/clientes/clientesService', () => ({
  getCliente,
  updateCliente: vi.fn(),
  logoUrl: () => '',
}));
vi.mock('@/atividade/atividadeService', () => ({
  listAtividade: vi.fn(async () => []),
  addComentario: vi.fn(),
}));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'c1' }),
  useHistory: () => ({ push: vi.fn() }),
}));

import { ClienteDetailPage } from '@/clientes/ClienteDetailPage';

describe('ClienteDetailPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mostra dados e link de WhatsApp', async () => {
    getCliente.mockResolvedValue({
      id: 'c1', nome_fantasia: 'ACME', telefone: '11988887777',
      categoria: 'Cliente', status: 'Ativo', email: 'a@a.com',
    });
    render(<ClienteDetailPage />);
    expect(await screen.findByRole('heading', { name: /ACME/i })).toBeInTheDocument();
    const wpp = screen.getByRole('link', { name: /whatsapp/i });
    expect(wpp).toHaveAttribute('href', expect.stringContaining('wa.me/11988887777'));
  });
});
