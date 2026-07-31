/** Tipos do módulo Financeiro (Wenox). */

export type TipoLancamento = 'receita' | 'despesa';
export type StatusLancamento = 'pago' | 'pendente' | 'previsto' | 'em_atraso';
export type RecorrenciaTipo = 'unica' | 'fixa' | 'recorrente' | 'parcelada';
export type FrequenciaRecorrencia = 'mensal' | 'semanal' | 'quinzenal' | 'anual';
export type OrigemLancamento =
  | 'manual'
  | 'via_projeto'
  | 'via_contrato'
  | 'transferencia'
  | 'ajuste';
export type ContaTipo = 'carteira' | 'banco' | 'cartao' | 'caixa';

export interface FinConta {
  id: string;
  nome: string;
  tipo: ContaTipo;
  saldo_inicial?: number;
  saldo_atual?: number;
  ativo?: boolean;
  cor?: string;
  icone?: string;
  padrao?: boolean;
  created?: string;
  updated?: string;
}

export type FinContaInput = Omit<FinConta, 'id' | 'created' | 'updated' | 'saldo_atual'> & {
  saldo_atual?: number; // só na criação (saldo inicial); updates ignorados no server
};

export interface FinCategoria {
  id: string;
  nome: string;
  tipo: TipoLancamento;
  icone?: string;
  cor?: string;
  parent_id?: string;
  arquivada?: boolean;
  sistema?: boolean;
  created?: string;
  updated?: string;
}

export type FinCategoriaInput = Omit<FinCategoria, 'id' | 'created' | 'updated'>;

export interface FinLancamento {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  categoria: string;
  valor: number;
  conta: string;
  data: string;
  vencimento?: string;
  status: StatusLancamento;
  recorrencia: RecorrenciaTipo;
  frequencia?: FrequenciaRecorrencia | '';
  parcela_atual?: number;
  parcelas_total?: number;
  serie_id?: string;
  origem: OrigemLancamento;
  cliente?: string;
  projeto?: string;
  forma_pagamento?: string;
  observacao?: string;
  tags?: string[];
  anexos?: { nome?: string; url?: string }[];
  created?: string;
  updated?: string;
  expand?: {
    categoria?: FinCategoria;
    conta?: FinConta;
    cliente?: { id: string; nome?: string; nome_fantasia?: string };
    projeto?: { id: string; nome?: string };
  };
}

export type FinLancamentoInput = Omit<
  FinLancamento,
  'id' | 'created' | 'updated' | 'expand'
>;

/** Efeito no saldo: só pago; receita +; despesa −. */
export function efeitoNoSaldo(l: Pick<FinLancamento, 'tipo' | 'status' | 'valor'>): number {
  if (l.status !== 'pago') return 0;
  const v = Number(l.valor) || 0;
  return l.tipo === 'receita' ? v : -v;
}

export function brl(n: number): string {
  return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function hojeISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Soma N meses a uma data ISO yyyy-mm-dd (clampa o dia ao fim do mês). */
export function addMesesISO(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  // Âncora no dia 1 evita overflow do JS (31/jan + 1 mês → 3/mar).
  const base = new Date(y, m - 1 + n, 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const day = Math.min(d, last);
  const out = new Date(base.getFullYear(), base.getMonth(), day);
  const yy = out.getFullYear();
  const mm = String(out.getMonth() + 1).padStart(2, '0');
  const dd = String(out.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function addPeriodoISO(
  iso: string,
  freq: FrequenciaRecorrencia | '' | undefined,
  n = 1,
): string {
  const f = freq || 'mensal';
  if (f === 'semanal') {
    const dt = new Date(iso.slice(0, 10) + 'T12:00:00');
    dt.setDate(dt.getDate() + 7 * n);
    return dt.toISOString().slice(0, 10);
  }
  if (f === 'quinzenal') {
    const dt = new Date(iso.slice(0, 10) + 'T12:00:00');
    dt.setDate(dt.getDate() + 15 * n);
    return dt.toISOString().slice(0, 10);
  }
  if (f === 'anual') return addMesesISO(iso, 12 * n);
  return addMesesISO(iso, n);
}

export const STATUS_LABEL: Record<StatusLancamento, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  previsto: 'Previsto',
  em_atraso: 'Em atraso',
};

export const TIPO_CONTA_LABEL: Record<ContaTipo, string> = {
  carteira: 'Carteira',
  banco: 'Banco',
  cartao: 'Cartão',
  caixa: 'Caixa',
};

/** Nome amigável do cliente no expand ou lista. */
export function nomeCliente(c?: { nome?: string; nome_fantasia?: string } | null): string {
  if (!c) return '';
  return (c.nome_fantasia || c.nome || '').trim();
}

/** Filtra lançamentos por cliente ('' = todos) e texto na descrição. */
export function filtrarLancamentos(
  lista: FinLancamento[],
  opts: { clienteId?: string; q?: string } = {},
): FinLancamento[] {
  const q = opts.q?.trim().toLowerCase() || '';
  return lista.filter((l) => {
    if (opts.clienteId && l.cliente !== opts.clienteId) return false;
    if (q && !(l.descricao || '').toLowerCase().includes(q)) return false;
    return true;
  });
}

export type BarraCategoria = { nome: string; valor: number; tipo: TipoLancamento };

/** Top N categorias do mês (só lançamentos pagos), ordenado por valor. */
export function topCategoriasPagas(lista: FinLancamento[], n = 6): BarraCategoria[] {
  const map = new Map<string, BarraCategoria>();
  for (const l of lista) {
    if (l.status !== 'pago') continue;
    const nome = l.expand?.categoria?.nome || 'Sem categoria';
    const key = `${l.tipo}:${nome}`;
    const cur = map.get(key) || { nome, valor: 0, tipo: l.tipo };
    cur.valor += Number(l.valor) || 0;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.valor - a.valor).slice(0, n);
}
