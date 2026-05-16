export const CATEGORIAS = ['Cliente', 'Parceiro'] as const;

export interface Cliente {
  id: string;
  nome_fantasia: string;
  razao_social?: string;
  cnpj?: string;
  categoria: (typeof CATEGORIAS)[number];
  origem?: string;
  servicos?: string[];
  telefone: string;
  email?: string;
  site?: string;
  endereco?: string;
  status: string;
  data_inicio?: string;
  data_encerramento?: string;
  url_dashboard?: string;
  url_drive?: string;
  url_trello?: string;
  observacoes?: string;
  logo?: string;
  created_by?: string;
  updated_by?: string;
  created?: string;
  updated?: string;
}

export type ClienteInput = Omit<
  Cliente,
  'id' | 'created' | 'updated' | 'created_by' | 'updated_by'
>;
