import { Link, useLocation } from 'react-router-dom';
import { Lock, PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav';
import { useSidebar } from './SidebarContext';

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
    <nav className="flex flex-col gap-1">
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

/** Sidebar fixa (desktop ≥ lg) com recolher. */
export function Sidebar() {
  const { colapsada, alternar } = useSidebar();
  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar p-4 transition-[width] duration-200 lg:flex',
        colapsada ? 'w-[72px]' : 'w-64',
      )}
    >
      <SidebarBrand compacta={colapsada} />
      <SidebarNav compacta={colapsada} />
      <button
        onClick={alternar}
        aria-label={colapsada ? 'Expandir menu' : 'Recolher menu'}
        title={colapsada ? 'Expandir menu' : 'Recolher menu'}
        className={cn(
          'mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
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
    </aside>
  );
}
