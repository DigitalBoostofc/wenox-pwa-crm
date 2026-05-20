export const CATEGORIAS = ['Cliente', 'Parceiro'] as const;

export interface Contato {
  tipo: string;
  valor: string;
}

export interface Cliente {
  id: string;
  nome?: string;
  nome_fantasia: string;
  razao_social?: string;
  cnpj?: string;
  categoria: (typeof CATEGORIAS)[number];
  origem?: string;
  servicos?: string[];
  telefone: string;
  telefones?: Contato[];
  email?: string;
  emails?: Contato[];
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

/** Nome de exibição: prioriza `nome` (pessoa) e cai para `nome_fantasia`. */
export function nomeExibicao(c: Pick<Cliente, 'nome' | 'nome_fantasia'>): string {
  return (c.nome?.trim() || c.nome_fantasia || '').trim();
}

/** Primeiro telefone preenchido (lista nova ou campo legado). */
export function telefonePrincipal(
  c: Pick<Cliente, 'telefone' | 'telefones'>,
): string {
  const lst = c.telefones ?? [];
  const primeiro = lst.find((t) => t.valor?.trim())?.valor?.trim();
  return primeiro || c.telefone || '';
}

/** Primeiro email preenchido (lista nova ou campo legado). */
export function emailPrincipal(
  c: Pick<Cliente, 'email' | 'emails'>,
): string {
  const lst = c.emails ?? [];
  const primeiro = lst.find((e) => e.valor?.trim())?.valor?.trim();
  return primeiro || c.email || '';
}
