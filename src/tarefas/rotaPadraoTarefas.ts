import { canGerirEquipe, ehCliente } from '@/auth/perms';
import { listOpcoes } from '@/opcoes/opcoesService';

/**
 * Área padrão ao abrir Tarefas:
 * - Owner / Admin / Gestor → Gestão
 * - Membro / Visualizador → user.area (função = tipo_projeto)
 * - Cliente / sem área → null (fica em /tarefas geral)
 */
export function areaTarefasSincrona(user?: {
  role?: string;
  area?: string;
} | null): string | null {
  if (!user || ehCliente(user.role)) return null;
  if (canGerirEquipe(user.role)) return 'Gestão';
  const a = user.area?.trim();
  return a || null;
}

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

/** Resolve a área real (consulta tipos no PB) e devolve o path, ou null. */
export async function pathTarefasPadrao(user?: {
  role?: string;
  area?: string;
} | null): Promise<string | null> {
  const preferido = areaTarefasSincrona(user);
  if (!preferido) return null;
  try {
    const ops = await listOpcoes('tipo_projeto');
    const tipos = ops.map((o) => o.valor);
    const area = casarTipoProjeto(preferido, tipos);
    return `/tarefas/area/${encodeURIComponent(area)}`;
  } catch {
    return `/tarefas/area/${encodeURIComponent(preferido)}`;
  }
}

/** Path síncrono (sidebar) — sem round-trip; pode diferir levemente do nome canônico. */
export function pathTarefasSincrono(user?: {
  role?: string;
  area?: string;
} | null): string {
  const area = areaTarefasSincrona(user);
  if (!area) return '/tarefas';
  return `/tarefas/area/${encodeURIComponent(area)}`;
}
