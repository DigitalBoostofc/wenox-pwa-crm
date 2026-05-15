import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '@/pages/LoginPage';

const loginMock = vi.fn(async () => {});
vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ user: null, login: loginMock, logout: vi.fn() }),
}));

describe('LoginPage', () => {
  it('envia email e senha ao submeter', async () => {
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/email/i), 'leonardo@wenox.com.br');
    await userEvent.type(screen.getByLabelText(/senha/i), 'segredo');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(loginMock).toHaveBeenCalledWith('leonardo@wenox.com.br', 'segredo');
  });

  it('mostra erro quando login falha', async () => {
    loginMock.mockRejectedValueOnce(new Error('bad'));
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/email/i), 'x@x.com');
    await userEvent.type(screen.getByLabelText(/senha/i), 'y');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByText(/credenciais inválidas/i)).toBeInTheDocument();
  });
});
