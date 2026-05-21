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
  role: (typeof ROLES)[number];
  status: 'Ativo' | 'Inativo';
  foto?: string;
}
