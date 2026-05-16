export type TipoDocumento = 'arquivo' | 'link';

export interface Documento {
  id: string;
  cliente: string;
  nome: string;
  categoria?: string;
  tipo: TipoDocumento;
  url?: string;
  arquivo?: string;
  observacoes?: string;
  created?: string;
  updated?: string;
}

export interface DocumentoInput {
  cliente: string;
  nome: string;
  categoria?: string;
  tipo: TipoDocumento;
  url?: string;
  observacoes?: string;
}
