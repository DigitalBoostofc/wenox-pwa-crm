import { canGerirEquipe, ehCliente } from '@/auth/perms';
import { listOpcoes } from '@/opcoes/opcoesService';

/**
 * Área padrão ao abrir Tarefas / Projetos:
 * - Owner / Admin / Gestor → Gestão
 * - Membro / Visualizador → user.area (função = tipo_projeto)
 * - Cliente / sem área → null (fica na lista geral)
 */
export function areaPadraoSincrona(user?: {
  role?: string;
  area?: string;
} | null): string | null {
  if (!user || ehCliente(user.role)) return null;
  if (canGerirEquipe(user.role)) return 'Gestão';
  const a = user.area?.trim();
  return a || null;
}

/** @deprecated use areaPadraoSincrona */
export const areaTarefasSincrona = areaPadraoSincrona;

/** Casa a área preferida com um valor real de tipo_projeto (fuzzy + aliases). */
export function casarTipoProjeto(preferido: string, tipos: string[]): string {
  if (tipos.length === 0) return preferido;
  const p = preferido.trim().toLowerCase();
  const exact = tipos.find((t) => t.toLowerCase() === p);
  if (exact) return exact;
  const contains = tipos.find(
    (t) => t.toLowerCase().includes(p) || p.includes(t.toLowerCase()),
  );
  if (contains) return contains;
  if (/gest/.test(p)) {
    return tipos.find((t) => /gest/i.test(t)) ?? preferido;
  }
  if (/design|cria/.test(p)) {
    return tipos.find((t) => /design|cria/i.test(t)) ?? preferido;
  }
  if (/social/.test(p)) {
    return tipos.find((t) => /social/i.test(t)) ?? preferido;
  }
  if (/traf|tráf|ads/.test(p)) {
    return tipos.find((t) => /traf|tráf|ads/i.test(t)) ?? preferido;
  }
  if (/dev|program|cod/.test(p)) {
    return tipos.find((t) => /dev|program|cod/i.test(t)) ?? preferido;
  }
  return preferido;
}

async function pathAreaPadrao(
  base: '/tarefas' | '/projetos',
  user?: { role?: string; area?: string } | null,
): Promise<string | null> {
  const preferido = areaPadraoSincrona(user);
  if (!preferido) return null;
  try {
    const ops = await listOpcoes('tipo_projeto');
    const tipos = ops.map((o) => o.valor);
    const area = casarTipoProjeto(preferido, tipos);
    return `${base}/area/${encodeURIComponent(area)}`;
  } catch {
    return `${base}/area/${encodeURIComponent(preferido)}`;
  }
}

function pathAreaSincrono(
  base: '/tarefas' | '/projetos',
  user?: { role?: string; area?: string } | null,
): string {
  const area = areaPadraoSincrona(user);
  if (!area) return base;
  return `${base}/area/${encodeURIComponent(area)}`;
}

export async function pathTarefasPadrao(user?: {
  role?: string;
  area?: string;
} | null): Promise<string | null> {
  return pathAreaPadrao('/tarefas', user);
}

export function pathTarefasSincrono(user?: {
  role?: string;
  area?: string;
} | null): string {
  return pathAreaSincrono('/tarefas', user);
}

export async function pathProjetosPadrao(user?: {
  role?: string;
  area?: string;
} | null): Promise<string | null> {
  return pathAreaPadrao('/projetos', user);
}

export function pathProjetosSincrono(user?: {
  role?: string;
  area?: string;
} | null): string {
  return pathAreaSincrono('/projetos', user);
}
