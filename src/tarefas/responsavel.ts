import type { Projeto } from '@/projetos/types';
import type { Usuario } from '@/usuarios/types';

/** Garante no máximo 1 responsável (campo PB continua relation multi). */
export function normalizarResponsaveis(ids?: string[] | null): string[] {
  const first = (ids ?? []).find((id) => !!id);
  return first ? [first] : [];
}

export function responsavelUnico(ids?: string[] | null): string | undefined {
  return normalizarResponsaveis(ids)[0];
}

/** Ids da equipe alocada no projeto. */
export function idsEquipeProjeto(
  projeto?: Pick<Projeto, 'responsaveis'> | null,
): string[] {
  return (projeto?.responsaveis ?? []).filter(Boolean);
}

/**
 * Candidatos a responsável da tarefa = equipe do projeto.
 * Se o projeto não tiver ninguém alocado, lista vazia.
 */
export function candidatosResponsavelProjeto(
  projeto: Pick<Projeto, 'responsaveis' | 'expand'> | undefined | null,
  usuarios: Usuario[],
): Usuario[] {
  const ids = idsEquipeProjeto(projeto);
  if (ids.length === 0) return [];
  const byId = new Map(usuarios.map((u) => [u.id, u]));
  const expand = projeto?.expand?.responsaveis ?? [];
  return ids.map((id) => {
    const u = byId.get(id);
    if (u) return u;
    const e = expand.find((r) => r.id === id);
    if (e) {
      return {
        id: e.id,
        nome: e.nome ?? '',
        email: e.email ?? '',
        role: 'Membro',
        status: 'Ativo',
      } as Usuario;
    }
    return null;
  }).filter((u): u is Usuario => !!u);
}

/**
 * Se o responsável atual não está na equipe do projeto, limpa.
 * Sem projeto → limpa (não há de onde escolher).
 */
export function responsaveisValidosParaProjeto(
  responsaveis: string[] | undefined,
  projeto: Pick<Projeto, 'responsaveis'> | undefined | null,
): string[] {
  const atual = responsavelUnico(responsaveis);
  if (!atual) return [];
  const equipe = idsEquipeProjeto(projeto);
  if (equipe.length === 0) return [];
  return equipe.includes(atual) ? [atual] : [];
}
