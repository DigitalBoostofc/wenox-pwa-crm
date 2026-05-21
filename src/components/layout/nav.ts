import {
  LayoutDashboard,
  UserCircle,
  Users,
  Building2,
  FolderKanban,
  ListChecks,
  Wallet,
  FileSignature,
  CalendarDays,
  Sparkles,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** false = aparece na sidebar mas ainda não navega (módulo futuro) */
  enabled: boolean;
}

/** Os 11 módulos do Wenox OS (doc handoff). Só Clientes e Configurações navegam no P3.5. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, enabled: false },
  { label: 'Minha Área', path: '/minha-area', icon: UserCircle, enabled: false },
  { label: 'Equipe', path: '/equipe', icon: Users, enabled: true },
  { label: 'Clientes', path: '/clientes', icon: Building2, enabled: true },
  { label: 'Projetos', path: '/projetos', icon: FolderKanban, enabled: true },
  { label: 'Tarefas', path: '/tarefas', icon: ListChecks, enabled: false },
  { label: 'Financeiro', path: '/financeiro', icon: Wallet, enabled: false },
  { label: 'Contratos & Propostas', path: '/contratos', icon: FileSignature, enabled: false },
  { label: 'Agenda', path: '/agenda', icon: CalendarDays, enabled: false },
  { label: 'IA Wenox', path: '/ia', icon: Sparkles, enabled: false },
  { label: 'Configurações', path: '/config', icon: Settings, enabled: true },
];

/** Resolve o título da área atual a partir do pathname. */
export function titleForPath(pathname: string): string {
  if (pathname.startsWith('/usuarios')) return 'Usuários';
  if (pathname.startsWith('/novo-cliente')) return 'Novo cliente';
  const match = NAV_ITEMS.filter((i) => pathname.startsWith(i.path)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
  return match?.label ?? 'Wenox OS';
}
