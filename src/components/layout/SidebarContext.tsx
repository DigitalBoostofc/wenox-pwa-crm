import { createContext, useContext, useEffect, useState } from 'react';

interface SidebarCtx {
  colapsada: boolean;
  alternar: () => void;
}

const Ctx = createContext<SidebarCtx | undefined>(undefined);
const KEY = 'wenox-sidebar-colapsada';

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [colapsada, setColapsada] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, colapsada ? '1' : '0');
    } catch {
      /* storage indisponível */
    }
  }, [colapsada]);

  return (
    <Ctx.Provider value={{ colapsada, alternar: () => setColapsada((v) => !v) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSidebar() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSidebar fora do SidebarProvider');
  return c;
}
