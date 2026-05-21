export type LadoTarefa = 'wenox' | 'cliente';

export interface Tarefa {
  id: string;
  collectionId?: string;
  collectionName?: string;
  nome: string;
  descricao?: string;
  projeto?: string; // id do projeto (vazio = tarefa interna avulsa)
  cliente?: string; // id do cliente (derivado do projeto)
  lado?: LadoTarefa;
  responsaveis?: string[]; // ids de usuarios (lado = wenox)
  contato?: string; // id do contato do cliente (lado = cliente)
  status?: string;
  prazo?: string;
  etiquetas?: string[];
  ordem?: number;
  created_by?: string;
  updated_by?: string;
  created?: string;
  updated?: string;
  expand?: {
    projeto?: { id: string; nome?: string; tipo?: string };
    cliente?: {
      id: string;
      collectionId?: string;
      collectionName?: string;
      nome?: string;
      nome_fantasia?: string;
      logo?: string;
    };
    responsaveis?: { id: string; nome?: string; email?: string }[];
    contato?: { id: string; nome?: string; cargo?: string };
  };
}

export type TarefaInput = Omit<
  Tarefa,
  'id' | 'created' | 'updated' | 'created_by' | 'updated_by' | 'expand'
  | 'collectionId' | 'collectionName'
>;
