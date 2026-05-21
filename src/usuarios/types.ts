export const ROLES = ['Owner', 'Admin', 'Gestor', 'Membro', 'Visualizador'] as const;
export const AREAS = ['Social Media', 'Trafego', 'Atendimento', 'Criacao', 'Dev', 'Outros'] as const;

export interface Usuario {
  id: string;
  collectionId?: string;
  collectionName?: string;
  email: string;
  nome: string;
  cargo?: string;
  area?: string;
  telefone?: string;
  /** Os 5 papéis internos + 'Cliente' (conta de cliente externo). */
  role: (typeof ROLES)[number] | 'Cliente';
  status: 'Ativo' | 'Inativo';
  foto?: string;
  /** id do cliente vinculado — só nas contas role='Cliente'. */
  cliente?: string;
}
