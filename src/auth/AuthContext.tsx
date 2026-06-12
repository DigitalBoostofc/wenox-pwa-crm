import { createContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { pb } from '@/lib/pocketbase';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  nome?: string;
  /** Preenchido só em contas do tipo Cliente — id do cliente vinculado. */
  cliente?: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  login: (identity: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function currentUser(): AuthUser | null {
  return pb.authStore.isValid
    ? (pb.authStore.record as unknown as AuthUser)
    : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(currentUser());

  useEffect(() => {
    const unsub = pb.authStore.onChange(() => setUser(currentUser()));
    return () => unsub();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: async (identity, password) => {
        const res = await pb
          .collection('usuarios')
          .authWithPassword(identity, password);
        // Conta desativada não entra — limpa a sessão recém-criada.
        if ((res.record as { status?: string }).status === 'Inativo') {
          pb.authStore.clear();
          throw new Error('Esta conta está desativada. Fale com um administrador.');
        }
        setUser(currentUser());
      },
      logout: () => {
        pb.authStore.clear();
        setUser(null);
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
