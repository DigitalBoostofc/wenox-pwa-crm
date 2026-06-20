/**
 * R1.B — VinculosQuadrosPage: smoke render para estados carregando/vazio/erro.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

/* ---- Mocks ---- */

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={String(to)} {...rest}>{children}</a>
  ),
}));

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    files: { getURL: () => '' },
    collection: () => ({}),
    authStore: { record: { id: 'u1' } },
  },
}));

const { sugerirVinculos } = vi.hoisted(() => ({
  sugerirVinculos: vi.fn(),
}));
vi.mock('@/quadros/quadrosService', () => ({
  sugerirVinculos,
  vincularQuadro: vi.fn(),
  clonarQuadroTemplate: vi.fn(),
}));

import { VinculosQuadrosPage } from '@/quadros/VinculosQuadrosPage';

const RESULTADO_VAZIO = {
  sugestoes: [],
  ambiguidades: [],
  quadrosSemCliente: [],
  clientesSemQuadro: [],
  todosClientes: [],
};

/* ---- Testes ---- */

describe('VinculosQuadrosPage — R1.B smoke', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza heading "Saúde dos vínculos"', async () => {
    sugerirVinculos.mockResolvedValue(RESULTADO_VAZIO);
    render(<VinculosQuadrosPage />);
    expect(screen.getByRole('heading', { name: /saúde dos vínculos/i })).toBeInTheDocument();
  });

  it('exibe "Carregando…" enquanto carrega', () => {
    sugerirVinculos.mockReturnValue(new Promise(() => {})); // nunca resolve
    render(<VinculosQuadrosPage />);
    expect(screen.getByText(/carregando…/i)).toBeInTheDocument();
  });

  it('estado vazio: exibe "Tudo certo!" quando não há problemas', async () => {
    sugerirVinculos.mockResolvedValue(RESULTADO_VAZIO);
    render(<VinculosQuadrosPage />);
    expect(await screen.findByText(/tudo certo!/i)).toBeInTheDocument();
  });

  it('estado de erro: exibe o erro e botão "Tentar novamente"', async () => {
    sugerirVinculos.mockRejectedValue(new Error('Falha de rede'));
    render(<VinculosQuadrosPage />);
    expect(await screen.findByText(/falha de rede/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it('botão de recarregar está presente', async () => {
    sugerirVinculos.mockResolvedValue(RESULTADO_VAZIO);
    render(<VinculosQuadrosPage />);
    await screen.findByText(/tudo certo!/i);
    expect(screen.getByRole('button', { name: /recarregar dados/i })).toBeInTheDocument();
  });

  it('link de voltar aponta para /config', async () => {
    sugerirVinculos.mockResolvedValue(RESULTADO_VAZIO);
    render(<VinculosQuadrosPage />);
    const link = await screen.findByRole('link', { name: /voltar para configurações/i });
    expect(link).toHaveAttribute('href', '/config');
  });

  it('com sugestões exibe bloco "Vínculos sugeridos"', async () => {
    sugerirVinculos.mockResolvedValue({
      ...RESULTADO_VAZIO,
      sugestoes: [
        {
          quadro: { id: 'q1', nome: 'Quadro ACME' },
          cliente: { id: 'c1', nome: 'ACME', nome_fantasia: 'ACME' },
        },
      ],
    });
    render(<VinculosQuadrosPage />);

    await waitFor(() => {
      expect(screen.getByText(/vínculos sugeridos/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Quadro ACME')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vincular quadro ACME/i })).toBeInTheDocument();
  });

  it('com clientes sem quadro exibe bloco "Clientes sem quadro"', async () => {
    sugerirVinculos.mockResolvedValue({
      ...RESULTADO_VAZIO,
      clientesSemQuadro: [{ id: 'c1', nome: 'BetaCorp', nome_fantasia: '' }],
    });
    render(<VinculosQuadrosPage />);

    await waitFor(() => {
      expect(screen.getByText(/clientes sem quadro/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /gerar quadro para betacorp/i })).toBeInTheDocument();
  });
});
