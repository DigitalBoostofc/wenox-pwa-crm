export interface Contato {
  id: string;
  cliente: string;
  nome: string;
  cargo?: string;
  email?: string;
  telefone?: string;
  status?: string;
  ultimo_acesso?: string;
  created?: string;
  updated?: string;
}

export type ContatoInput = Omit<Contato, 'id' | 'created' | 'updated'>;
