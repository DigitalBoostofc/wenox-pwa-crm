export type Role =
  | 'Owner' | 'Admin' | 'Gestor' | 'Membro' | 'Visualizador' | 'Cliente';

const inSet = (roles: Role[]) => (r?: string) => !!r && roles.includes(r as Role);

export const canCriarCliente = inSet(['Owner', 'Admin', 'Gestor']);
export const canEditarCliente = inSet(['Owner', 'Admin', 'Gestor', 'Membro']);
export const canExcluirCliente = inSet(['Owner', 'Admin']);
export const canGerirEquipe = inSet(['Owner', 'Admin', 'Gestor']);
export const canGerirUsuarios = inSet(['Owner', 'Admin']);
/** Quem pode gerar o login de acesso de um cliente. */
export const canCriarAcessoCliente = inSet(['Owner', 'Admin', 'Gestor']);

/** true para contas do tipo Cliente (cliente externo logado na plataforma). */
export const ehCliente = (r?: string): boolean => r === 'Cliente';

/**
 * Papéis cujo acesso a quadros é restrito aos seus (responsável de projeto do
 * cliente OU de tarefa do quadro). Owner/Admin/Gestor veem todos os quadros.
 */
export const acessoQuadrosRestrito = inSet(['Membro', 'Visualizador']);
