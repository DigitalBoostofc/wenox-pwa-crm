import { createContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { pb } from '@/lib/pocketbase';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  nome?: string;
  /** Função do membro (= um tipo de projeto). Restringe o que ele vê em Tarefas. */
  area?: string;
  /** Preenchido só em contas do tipo Cliente — id do cliente vinculado. */
  cliente?: string;
  /** Foto de perfil (nome do arquivo no PocketBase) + dados p/ montar a URL. */
  foto?: string;
  collectionId?: string;
  collectionName?: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  /** true enquanto a sessão local ainda não foi validada no servidor (authRefresh). */
  initializing: boolean;
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
  // Há token local? Então estamos "inicializando" até o servidor validá-lo —
  // o Root segura a renderização da área protegida nesse meio-tempo (evita
  // flash da UI logada + fetches com token que o servidor pode rejeitar).
  // Sem token, não há o que validar: já entra direto no fluxo de login.
  const [initializing, setInitializing] = useState<boolean>(() => pb.authStore.isValid);

  useEffect(() => {
    const unsub = pb.authStore.onChange(() => setUser(currentUser()));
    return () => unsub();
  }, []);

  // Valida o token no servidor na montagem — detecta tokens invalidados por
  // troca de senha (authStore.isValid só verifica expiração local).
  useEffect(() => {
    if (!pb.authStore.isValid) return; // initializing já é false
    let vivo = true;
    pb.collection('usuarios').authRefresh()
      .catch((err: unknown) => {
        if ((err as { status?: number }).status === 401) {
          pb.authStore.clear();
        }
        // Outros erros (rede/offline): mantém a sessão local e segue para o app
        // — não trava o boot num gate eterno por uma falha transitória.
      })
      .finally(() => { if (vivo) setInitializing(false); });
    return () => { vivo = false; };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
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
    [user, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
