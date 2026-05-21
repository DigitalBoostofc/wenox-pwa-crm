export type Modulo =
  | 'dashboard' | 'minha-area' | 'equipe' | 'clientes' | 'projetos'
  | 'tarefas' | 'financeiro' | 'contratos' | 'agenda' | 'ia' | 'config';

export const MODULOS_INFO: { id: Modulo; label: string; disponivel: boolean }[] = [
  { id: 'dashboard',   label: 'Dashboard',             disponivel: false },
  { id: 'minha-area',  label: 'Minha Área',             disponivel: false },
  { id: 'equipe',      label: 'Equipe',                 disponivel: true  },
  { id: 'clientes',    label: 'Clientes',               disponivel: true  },
  { id: 'projetos',    label: 'Projetos',               disponivel: true  },
  { id: 'tarefas',     label: 'Tarefas',                disponivel: false },
  { id: 'financeiro',  label: 'Financeiro',             disponivel: false },
  { id: 'contratos',   label: 'Contratos & Propostas',  disponivel: false },
  { id: 'agenda',      label: 'Agenda',                 disponivel: false },
  { id: 'ia',          label: 'IA Wenox',               disponivel: false },
  { id: 'config',      label: 'Configurações',          disponivel: true  },
];

/** Papéis configuráveis (Owner sempre tem tudo). */
export const ROLES_CONFIGURÁVEIS = ['Admin', 'Gestor', 'Membro', 'Visualizador'] as const;

export type MatrizPermissoes = Record<string, Partial<Record<Modulo, boolean>>>;

export const PERMISSOES_PADRAO: MatrizPermissoes = {
  Admin:       { dashboard: true, 'minha-area': true, equipe: true, clientes: true, projetos: true, tarefas: true, financeiro: true, contratos: true, agenda: true, ia: true, config: true },
  Gestor:      { 'minha-area': true, equipe: true, clientes: true, projetos: true, tarefas: true, agenda: true },
  Membro:      { 'minha-area': true, clientes: true, projetos: true, tarefas: true },
  Visualizador:{ 'minha-area': true, clientes: true, projetos: true },
};

const KEY = 'wenox-permissoes-v1';

export function carregarPermissoes(): MatrizPermissoes {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return JSON.parse(s) as MatrizPermissoes;
  } catch { /* */ }
  return PERMISSOES_PADRAO;
}

export function salvarPermissoes(m: MatrizPermissoes): void {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* */ }
}

/** Owner tem acesso a tudo; demais consultam a matriz. */
export function temPermissao(
  permissoes: MatrizPermissoes,
  role: string | undefined,
  modulo: Modulo,
): boolean {
  if (!role) return false;
  if (role === 'Owner') return true;
  return permissoes[role]?.[modulo] ?? false;
}
