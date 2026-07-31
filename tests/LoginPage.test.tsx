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

  it('mostra erro genérico quando login falha sem status HTTP', async () => {
    loginMock.mockRejectedValueOnce(new Error('bad'));
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/email/i), 'x@x.com');
    await userEvent.type(screen.getByLabelText(/senha/i), 'y');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(
      await screen.findByText(/não foi possível entrar\. verifique sua conexão/i),
    ).toBeInTheDocument();
  });

  it('mostra email/senha incorretos em 401', async () => {
    loginMock.mockRejectedValueOnce(Object.assign(new Error('Failed'), { status: 401 }));
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/email/i), 'x@x.com');
    await userEvent.type(screen.getByLabelText(/senha/i), 'y');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByText(/email ou senha incorretos/i)).toBeInTheDocument();
  });
});
