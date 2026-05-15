import { Link, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav';

function isActive(pathname: string, itemPath: string) {
  if (itemPath === '/clientes')
    return pathname.startsWith('/clientes') || pathname.startsWith('/novo-cliente');
  if (itemPath === '/config')
    return pathname.startsWith('/config') || pathname.startsWith('/usuarios');
  return pathname.startsWith(itemPath);
}

export function SidebarBrand() {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1">
      <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_20px_-6px_rgba(139,92,246,0.7)]">
        <span className="text-lg font-black">W</span>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight">Wenox OS</p>
        <p className="text-[11px] text-muted-foreground">Central de comando</p>
      </div>
    </div>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.path);
        const Icon = item.icon;
        const className = cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
          active
            ? 'bg-primary/15 text-primary shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35)]'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          !item.enabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
        );
        if (!item.enabled) {
          return (
            <span key={item.path} className={className} aria-disabled="true">
              <Icon className="size-[18px]" />
              <span className="flex-1">{item.label}</span>
              <Lock className="size-3.5 opacity-60" />
            </span>
          );
        }
        return (
          <Link key={item.path} to={item.path} className={className} onClick={onNavigate}>
            <Icon className="size-[18px]" />
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Sidebar fixa (desktop ≥ lg). */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar p-4 lg:flex">
      <SidebarBrand />
      <SidebarNav />
      <p className="mt-auto px-3 text-[11px] text-muted-foreground">
        Módulos com cadeado chegam nas próximas sprints.
      </p>
    </aside>
  );
}
