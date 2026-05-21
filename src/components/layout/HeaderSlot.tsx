import { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';

/** Permite que uma página projete conteúdo (ex: barra de controles) dentro
 *  do Header global, ao lado do título do módulo. */
const HeaderSlotCtx = createContext<{
  el: HTMLElement | null;
  setEl: (e: HTMLElement | null) => void;
}>({ el: null, setEl: () => {} });

export function HeaderSlotProvider({ children }: { children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  return (
    <HeaderSlotCtx.Provider value={{ el, setEl }}>
      {children}
    </HeaderSlotCtx.Provider>
  );
}

/** Renderizado pelo Header — marca o ponto onde o conteúdo das páginas entra. */
export function HeaderSlotTarget({ className }: { className?: string }) {
  const { setEl } = useContext(HeaderSlotCtx);
  return <div ref={setEl} className={className} />;
}

/** Usado pelas páginas — projeta `children` dentro do Header via portal. */
export function HeaderSlot({ children }: { children: React.ReactNode }) {
  const { el } = useContext(HeaderSlotCtx);
  if (!el) return null;
  return createPortal(children, el);
}
