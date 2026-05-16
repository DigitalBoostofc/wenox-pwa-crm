export interface Acesso {
  id: string;
  cliente: string;
  plataforma: string;
  categoria?: string;
  url?: string;
  login?: string;
  senha?: string;
  tem_2fa?: boolean;
  responsavel?: string;
  observacoes?: string;
  created?: string;
  updated?: string;
  expand?: { responsavel?: { nome?: string; email?: string } };
}

export type AcessoInput = Omit<
  Acesso,
  'id' | 'created' | 'updated' | 'expand'
>;
