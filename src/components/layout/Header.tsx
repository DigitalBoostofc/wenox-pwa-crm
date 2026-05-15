import { useState } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { Bell, Menu, Moon, Search, Sun, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuth } from '@/auth/useAuth';
import { canGerirUsuarios } from '@/auth/perms';
import { useTheme } from './ThemeProvider';
import { titleForPath } from './nav';
import { SidebarBrand, SidebarNav } from './Sidebar';

export function Header() {
  const { pathname } = useLocation();
  const history = useHistory();
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = titleForPath(pathname);
  const initial = (user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      {/* Drawer mobile */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left">
          <SheetTitle className="sr-only">Navegação</SheetTitle>
          <SidebarBrand />
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <h1 className="text-base font-semibold tracking-tight sm:text-lg">{title}</h1>

      <div className="relative ml-auto hidden md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Buscar…"
          aria-label="Buscar"
          className="h-9 w-56 rounded-md border border-input bg-background/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="md:ml-0 ml-auto"
        onClick={toggle}
        aria-label={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      >
        {theme === 'dark' ? <Sun /> : <Moon />}
      </Button>

      <Button variant="ghost" size="icon" aria-label="Notificações">
        <Bell />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="grid size-9 place-items-center rounded-full bg-primary/20 text-sm font-semibold text-primary ring-1 ring-primary/40"
            aria-label="Menu do perfil"
          >
            {initial}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <span className="block truncate text-sm font-medium text-foreground">
              {user?.email}
            </span>
            <span className="text-xs capitalize text-muted-foreground">
              {user?.role}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {canGerirUsuarios(user?.role) && (
            <DropdownMenuItem asChild>
              <Link to="/usuarios">
                <ShieldCheck /> Gerenciar usuários
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              logout();
              history.push('/login');
            }}
          >
            <LogOut /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
