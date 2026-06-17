import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  carregarPermissoes,
  carregarPermissoesRemoto,
  salvarPermissoesRemoto,
  temPermissao,
  type MatrizPermissoes,
  type Modulo,
} from './permissoesConfig';

interface PermissoesCtx {
  /** Matriz papel × módulo vigente (vinda do PocketBase). */
  matriz: MatrizPermissoes;
  /** true enquanto a 1ª carga do servidor não terminou. */
  carregando: boolean;
  /** Atalho: este papel pode acessar este módulo? */
  pode: (role: string | undefined, modulo: Modulo) => boolean;
  /** Persiste a matriz no servidor e atualiza o estado. */
  salvar: (m: MatrizPermissoes) => Promise<void>;
  /** Recarrega do servidor (ex.: após login). */
  recarregar: () => Promise<void>;
}

const Ctx = createContext<PermissoesCtx | null>(null);

export function PermissoesProvider({ children }: { children: ReactNode }) {
  // Começa com o cache local pra render instantâneo; o PB sobrescreve em seguida.
  const [matriz, setMatriz] = useState<MatrizPermissoes>(() => carregarPermissoes());
  const [carregando, setCarregando] = useState(true);

  // Mesma guarda "vivo" do efeito de carga inicial, agora também no recarregar()
  // exposto: evita setState após unmount (logout/navegação durante o await).
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    const m = await carregarPermissoesRemoto();
    if (!vivo.current) return;
    setMatriz(m);
    setCarregando(false);
  }, []);

  // Carga inicial: setState só após o await (fora do corpo síncrono do efeito).
  useEffect(() => {
    let vivoInicial = true;
    carregarPermissoesRemoto().then((m) => {
      if (!vivoInicial) return;
      setMatriz(m);
      setCarregando(false);
    });
    // Status de tarefas configuráveis: atualiza o cache global (notifica via store).
    import('@/tarefas/status').then((m) => m.carregarStatusRemoto()).catch(() => { /* */ });
    // Modelos de etapas por tipo de tarefa.
    import('@/tarefas/etapasPreset').then((m) => m.carregarPresetsRemoto()).catch(() => { /* */ });
    return () => { vivoInicial = false; };
  }, []);

  const salvar = useCallback(async (m: MatrizPermissoes) => {
    await salvarPermissoesRemoto(m);
    setMatriz(m);
  }, []);

  const pode = useCallback(
    (role: string | undefined, modulo: Modulo) => temPermissao(matriz, role, modulo),
    [matriz],
  );

  return (
    <Ctx.Provider value={{ matriz, carregando, pode, salvar, recarregar }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePermissoes(): PermissoesCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePermissoes deve ser usado dentro de <PermissoesProvider>');
  return ctx;
}
