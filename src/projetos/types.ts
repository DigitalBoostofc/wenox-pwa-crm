export interface EtapaProjeto {
  id: string;
  tipo: string;
  nome: string;
  ordem: number;
  cor?: string;
  created?: string;
  updated?: string;
}

export interface Projeto {
  id: string;
  collectionId?: string;
  collectionName?: string;
  nome: string;
  cliente: string; // id do cliente
  tipo?: string;
  status?: string;
  etapa?: string;
  etiquetas?: string[];
  responsaveis?: string[];
  briefing?: string;
  observacoes?: string;
  data_inicio?: string;
  data_entrega?: string;
  created_by?: string;
  updated_by?: string;
  created?: string;
  updated?: string;
  expand?: {
    cliente?: {
      id: string;
      collectionId?: string;
      collectionName?: string;
      nome?: string;
      nome_fantasia?: string;
      logo?: string;
    };
    responsaveis?: {
      id: string;
      nome?: string;
      email?: string;
      foto?: string;
      collectionId?: string;
      collectionName?: string;
    }[];
  };
}

export type ProjetoInput = Omit<
  Projeto,
  'id' | 'created' | 'updated' | 'created_by' | 'updated_by' | 'expand'
  | 'collectionId' | 'collectionName'
>;
