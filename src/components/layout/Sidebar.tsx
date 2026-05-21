import { Link, useHistory, useLocation } from 'react-router-dom';
import {
  Bell, Lock, LogOut, Moon, PanelLeft, PanelLeftClose,
  Search, ShieldCheck, Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav';
import { useSidebar } from './SidebarContext';
import { useAuth } from '@/auth/useAuth';
import { canGerirUsuarios } from '@/auth/perms';
import { useTheme } from './ThemeProvider';

function isActive(pathname: string, itemPath: string) {
  if (itemPath === '/clientes')
    return pathname.startsWith('/clientes') || pathname.startsWith('/novo-cliente');
  if (itemPath === '/config')
    return pathname.startsWith('/config') || pathname.startsWith('/usuarios');
  return pathname.startsWith(itemPath);
}

export function SidebarBrand({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1">
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_20px_-6px_rgba(139,92,246,0.7)]">
        <span className="text-lg font-black">W</span>
      </div>
      {!compacta && (
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight">Wenox OS</p>
          <p className="text-[11px] text-muted-foreground">Central de comando</p>
        </div>
      )}
    </div>
  );
}

export function SidebarNav({
  onNavigate,
  compacta = false,
}: {
  onNavigate?: () => void;
  compacta?: boolean;
}) {
  const { pathname } = useLocation();
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.path);
        const Icon = item.icon;
        const className = cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
          compacta && 'justify-center px-0',
          active
            ? 'bg-primary/15 text-primary shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35)]'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          !item.enabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
        );
        const conteudo = (
          <>
            <Icon className="size-[18px] shrink-0" />
            {!compacta && <span className="flex-1">{item.label}</span>}
            {!compacta && !item.enabled && (
              <Lock className="size-3.5 opacity-60" />
            )}
          </>
        );
        if (!item.enabled) {
          return (
            <span
              key={item.path}
              className={className}
              aria-disabled="true"
              title={compacta ? item.label : undefined}
            >
              {conteudo}
            </span>
          );
        }
        return (
          <Link
            key={item.path}
            to={item.path}
            className={className}
            onClick={onNavigate}
            title={compacta ? item.label : undefined}
          >
            {conteudo}
          </Link>
        );
      })}
    </nav>
  );
}

/** Seção inferior reutilizável: busca, tema, sino e perfil. */
export function SidebarBottom({
  compacta = false,
  onNavigate,
}: {
  compacta?: boolean;
  onNavigate?: () => void;
}) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const history = useHistory();
  const initial = (user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <div className={cn('flex flex-col gap-1', compacta && 'items-center')}>
      {!compacta && (
        <div className="relative mb-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar…"
            aria-label="Buscar"
            className="h-9 w-full rounded-md border border-input bg-background/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          />
        </div>
      )}

      <div className={cn('flex gap-1', compacta ? 'flex-col' : 'flex-row')}>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          className={cn(!compacta && 'flex-1')}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notificações"
          className={cn(!compacta && 'flex-1')}
        >
          <Bell />
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-secondary',
              compacta && 'justify-center px-0',
            )}
            aria-label="Menu do perfil"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/20 text-xs font-semibold text-primary ring-1 ring-primary/40">
              {initial}
            </span>
            {!compacta && (
              <span className="truncate text-sm text-muted-foreground">
                {user?.email}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end">
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
              <Link to="/usuarios" onClick={onNavigate}>
                <ShieldCheck /> Gerenciar usuários
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              logout();
              history.push('/login');
              onNavigate?.();
            }}
          >
            <LogOut /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Sidebar fixa (desktop ≥ lg) com recolher. */
export function Sidebar() {
  const { colapsada, alternar } = useSidebar();

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-svh shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar p-4 transition-[width] duration-200 lg:flex',
        colapsada ? 'w-[72px]' : 'w-64',
      )}
    >
      <SidebarBrand compacta={colapsada} />
      <SidebarNav compacta={colapsada} />

      <div className={cn('mt-auto flex flex-col gap-1', colapsada && 'items-center')}>
        <SidebarBottom compacta={colapsada} />

        {/* Recolher */}
        <button
          onClick={alternar}
          aria-label={colapsada ? 'Expandir menu' : 'Recolher menu'}
          title={colapsada ? 'Expandir menu' : 'Recolher menu'}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
            colapsada && 'justify-center px-0',
          )}
        >
          {colapsada ? (
            <PanelLeft className="size-[18px]" />
          ) : (
            <>
              <PanelLeftClose className="size-[18px]" /> Recolher
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
