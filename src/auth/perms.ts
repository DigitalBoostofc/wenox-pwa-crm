export type Role = 'Owner' | 'Admin' | 'Gestor' | 'Membro' | 'Visualizador';

const inSet = (roles: Role[]) => (r?: string) => !!r && roles.includes(r as Role);

export const canCriarCliente = inSet(['Owner', 'Admin', 'Gestor']);
export const canEditarCliente = inSet(['Owner', 'Admin', 'Gestor', 'Membro']);
export const canExcluirCliente = inSet(['Owner', 'Admin']);
export const canGerirEquipe = inSet(['Owner', 'Admin', 'Gestor']);
export const canGerirUsuarios = inSet(['Owner', 'Admin']);
