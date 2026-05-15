import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { listOpcoes, criarOpcao, editarOpcao, reordenarOpcao, removerOpcao } =
  vi.hoisted(() => ({
    listOpcoes: vi.fn(),
    criarOpcao: vi.fn(),
    editarOpcao: vi.fn(),
    reordenarOpcao: vi.fn(),
    removerOpcao: vi.fn(),
  }));

vi.mock('@/opcoes/opcoesService', () => ({
  listOpcoes, criarOpcao, editarOpcao, reordenarOpcao, removerOpcao,
}));
vi.mock('react-router-dom', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));

import { ParametrosPage } from '@/opcoes/ParametrosPage';

describe('ParametrosPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista opções e mostra erro quando remoção é bloqueada', async () => {
    listOpcoes.mockImplementation(async (tipo: string) =>
      tipo === 'status' ? [{ id: 's1', tipo: 'status', valor: 'Ativo', ordem: 1 }] : [],
    );
    removerOpcao.mockRejectedValueOnce(
      new Error('Não é possível remover "Ativo": 1 cliente(s) ainda usam esta opção.'),
    );

    render(<ParametrosPage />);
    expect(await screen.findByText('Ativo')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /remover ativo/i }));
    await waitFor(() =>
      expect(screen.getByText(/não é possível remover/i)).toBeInTheDocument(),
    );
  });
});
