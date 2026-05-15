import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/auth/AuthContext';
import { useAuth } from '@/auth/useAuth';

vi.mock('@/lib/pocketbase', () => {
  const authStore = {
    isValid: false,
    record: null as any,
    onChange: (_cb: () => void) => () => {},
    clear: () => {},
  };
  return {
    pb: {
      authStore,
      collection: () => ({
        authWithPassword: vi.fn(async (id: string) => {
          authStore.isValid = true;
          authStore.record = { id: 'u1', email: id, role: 'Owner' };
          return { record: authStore.record };
        }),
      }),
    },
  };
});

function Probe() {
  const { user, login } = useAuth();
  return (
    <div>
      <span data-testid="email">{user?.email ?? 'anon'}</span>
      <button onClick={() => login('leonardo@wenox.com.br', 'x')}>login</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => localStorage.clear());

  it('começa anônimo e autentica via login()', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByTestId('email').textContent).toBe('anon');
    screen.getByText('login').click();
    await waitFor(() =>
      expect(screen.getByTestId('email').textContent).toBe('leonardo@wenox.com.br')
    );
  });
});
