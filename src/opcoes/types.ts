export const TIPOS_OPCAO = ['origem', 'status', 'servico'] as const;
export type TipoOpcao = (typeof TIPOS_OPCAO)[number];

export interface Opcao {
  id: string;
  tipo: TipoOpcao;
  valor: string;
  ordem: number;
}

export const ROTULO_TIPO: Record<TipoOpcao, string> = {
  origem: 'Origem',
  status: 'Status',
  servico: 'Serviços',
};
