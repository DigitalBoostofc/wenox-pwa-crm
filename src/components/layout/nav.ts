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
  Building,
  type LucideIcon,
} from 'lucide-react';
import type { Modulo } from '@/config/permissoesConfig';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** false = aparece na sidebar mas ainda não navega (módulo futuro) */
  enabled: boolean;
  modulo: Modulo;
}

/** Os 11 módulos do Wenox OS (doc handoff). Só Clientes e Configurações navegam no P3.5. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',           path: '/dashboard',  icon: LayoutDashboard, enabled: true,  modulo: 'dashboard'   },
  { label: 'Minha Área',          path: '/minha-area', icon: UserCircle,      enabled: true,  modulo: 'minha-area'  },
  { label: 'Equipe',              path: '/equipe',     icon: Users,           enabled: true,  modulo: 'equipe'      },
  { label: 'Clientes',            path: '/clientes',   icon: Building2,       enabled: true,  modulo: 'clientes'    },
  { label: 'Projetos',            path: '/projetos',   icon: FolderKanban,    enabled: true,  modulo: 'projetos'    },
  { label: 'Tarefas',             path: '/tarefas',    icon: ListChecks,      enabled: true,  modulo: 'tarefas'     },
  { label: 'Financeiro',          path: '/financeiro', icon: Wallet,          enabled: false, modulo: 'financeiro'  },
  { label: 'Contratos & Propostas', path: '/contratos', icon: FileSignature,  enabled: false, modulo: 'contratos'   },
  { label: 'Agenda',              path: '/agenda',     icon: CalendarDays,    enabled: false, modulo: 'agenda'      },
  { label: 'IA Wenox',            path: '/ia',         icon: Sparkles,        enabled: false, modulo: 'ia'          },
  { label: 'Configurações',       path: '/config',     icon: Settings,        enabled: true,  modulo: 'config'      },
];

/** Nav restrito das contas Cliente (cliente externo logado). */
export const NAV_ITEMS_CLIENTE: NavItem[] = [
  { label: 'Meus Projetos',  path: '/projetos',      icon: FolderKanban, enabled: true, modulo: 'projetos' },
  { label: 'Minhas Tarefas', path: '/tarefas',       icon: ListChecks,   enabled: true, modulo: 'tarefas'  },
  { label: 'Minha Empresa',  path: '/minha-empresa', icon: Building,     enabled: true, modulo: 'clientes' },
];

/** Resolve o título da área atual a partir do pathname. */
export function titleForPath(pathname: string): string {
  if (pathname.startsWith('/usuarios')) return 'Usuários';
  if (pathname.startsWith('/novo-cliente')) return 'Novo cliente';
  if (pathname.startsWith('/minha-empresa')) return 'Minha Empresa';
  const todos = [...NAV_ITEMS, ...NAV_ITEMS_CLIENTE];
  const match = todos.filter((i) => pathname.startsWith(i.path)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
  return match?.label ?? 'Wenox OS';
}
