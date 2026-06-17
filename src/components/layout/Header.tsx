import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { titleForPath } from './nav';
import { SidebarBrand, SidebarNav, SidebarBottom } from './Sidebar';
import { HeaderSlotTarget } from './HeaderSlot';
import { useAuth } from '@/auth/useAuth';

export function Header() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const title = titleForPath(pathname, user?.role === 'Cliente');

  return (
    <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-background/80 px-4 py-2 backdrop-blur-md lg:px-6">
      {/* Drawer mobile */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col gap-4 overflow-y-auto p-4">
          <SheetTitle className="sr-only">Navegação</SheetTitle>
          <SidebarBrand />
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
          <div className="mt-auto border-t border-border pt-4">
            <SidebarBottom onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {title && <h1 className="shrink-0 text-base font-semibold tracking-tight sm:text-lg">{title}</h1>}

      {/* Slot: páginas podem projetar controles aqui, ao lado do título. */}
      <HeaderSlotTarget className="flex min-w-0 flex-1 items-center justify-end" />
    </header>
  );
}
