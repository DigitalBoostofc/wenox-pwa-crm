export type LadoTarefa = 'wenox' | 'cliente';

export interface ItemChecklist {
  texto: string;
  feito: boolean;
}

export type TipoEtapa = 'interna' | 'aprovacao_cliente';

/** Etapa de um fluxo sequencial dentro da tarefa (Fase 2).
 *  A "etapa atual" é a primeira não concluída. */
export interface EtapaTarefa {
  id: string;            // id estável (gerado no cliente)
  texto: string;         // o que fazer / o que aprovar
  responsavel?: string;  // id do usuário (vazio = qualquer um); ignorado em aprovacao_cliente
  tipo: TipoEtapa;
  feito: boolean;
  feito_por?: string;    // id do usuário que concluiu, ou 'cliente'
  feito_em?: string;     // carimbo wall-clock "YYYY-MM-DD HH:MM:SS"
}

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
  /** Veredito do cliente: '' (pendente) | 'aprovada' | 'alteracao'. */
  aprovacao?: '' | 'aprovada' | 'alteracao';
  prazo?: string;
  concluida_em?: string;
  prioridade?: 'alta' | 'media' | 'baixa';
  recorrencia?: '' | 'semanal' | 'quinzenal' | 'mensal';
  checklist?: ItemChecklist[];
  etapas?: EtapaTarefa[];
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

export const RECORRENCIA_LABEL = {
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
} as const;

export type TarefaInput = Omit<
  Tarefa,
  'id' | 'created' | 'updated' | 'created_by' | 'updated_by' | 'expand'
  | 'collectionId' | 'collectionName'
>;
