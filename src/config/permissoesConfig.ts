export type Modulo =
  | 'dashboard' | 'minha-area' | 'equipe' | 'clientes' | 'projetos'
  | 'tarefas' | 'financeiro' | 'contratos' | 'agenda' | 'ia' | 'config';

export const MODULOS_INFO: { id: Modulo; label: string; disponivel: boolean }[] = [
  { id: 'dashboard',   label: 'Dashboard',             disponivel: true  },
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
  Gestor:      { dashboard: true, 'minha-area': true, equipe: true, clientes: true, projetos: true, tarefas: true, agenda: true },
  Membro:      { dashboard: true, 'minha-area': true, clientes: true, projetos: true, tarefas: true },
  Visualizador:{ dashboard: true, 'minha-area': true, clientes: true, projetos: true },
};

const KEY = 'wenox-permissoes-v1';

/** Cache local (síncrono) — usado pra render instantâneo enquanto o PB carrega. */
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

/* ------------------------------------------------------------------ *
 * Fonte de verdade: PocketBase (coleção `configuracoes`, registro
 * único com chave="permissoes"). Vale pra todos os dispositivos.
 * O localStorage acima vira só cache pra render imediato/offline.
 * ------------------------------------------------------------------ */

const CHAVE = 'permissoes';

interface RegistroConfig { id: string; valor?: MatrizPermissoes }

/** Lê a matriz do servidor; atualiza o cache. Cai no cache/padrão se falhar. */
export async function carregarPermissoesRemoto(): Promise<MatrizPermissoes> {
  // Import dinâmico evita ciclo de dependência com o cliente PB.
  const { pb } = await import('@/lib/pocketbase');
  try {
    const rec = (await pb
      .collection('configuracoes')
      .getFirstListItem(`chave="${CHAVE}"`)) as unknown as RegistroConfig;
    if (rec?.valor && typeof rec.valor === 'object') {
      salvarPermissoes(rec.valor);
      return rec.valor;
    }
  } catch { /* sem registro / offline → usa cache local */ }
  return carregarPermissoes();
}

/** Grava a matriz no servidor (cria o registro se ainda não existir). */
export async function salvarPermissoesRemoto(m: MatrizPermissoes): Promise<void> {
  const { pb } = await import('@/lib/pocketbase');
  salvarPermissoes(m); // cache imediato
  const col = pb.collection('configuracoes');
  const existente = (await col
    .getFirstListItem(`chave="${CHAVE}"`)
    .catch(() => null)) as unknown as RegistroConfig | null;
  if (existente) {
    await col.update(existente.id, { valor: m });
  } else {
    await col.create({ chave: CHAVE, valor: m });
  }
}

/** Owner tem acesso a tudo; demais consultam a matriz. */
export function temPermissao(
  permissoes: MatrizPermissoes,
  role: string | undefined,
  modulo: Modulo,
): boolean {
  if (!role) return false;
  if (role === 'Owner') return true;
  // Configurações é universal: todo usuário precisa acessar a própria conta
  // (trocar senha, tema). A área de Administração dentro dela é que é
  // restrita a Owner/Admin (controlada à parte, por canGerirUsuarios).
  if (modulo === 'config') return true;
  return permissoes[role]?.[modulo] ?? false;
}
