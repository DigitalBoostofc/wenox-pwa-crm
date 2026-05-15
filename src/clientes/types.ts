export const CATEGORIAS = ['Cliente', 'Parceiro'] as const;
export const STATUS = ['Ativo', 'Inativo'] as const;
export const ORIGENS = ['Indicacao', 'Site', 'Trafego', 'Outros'] as const;
export const SERVICOS = [
  'Social Media', 'Trafego Pago', 'Desenvolvimento', 'Branding', 'Outros',
] as const;

export interface Cliente {
  id: string;
  nome_fantasia: string;
  razao_social?: string;
  cnpj?: string;
  categoria: (typeof CATEGORIAS)[number];
  origem?: (typeof ORIGENS)[number];
  servicos?: string[];
  telefone: string;
  email?: string;
  site?: string;
  status: (typeof STATUS)[number];
  data_inicio?: string;
  data_encerramento?: string;
  observacoes?: string;
}

export type ClienteInput = Omit<Cliente, 'id'>;
