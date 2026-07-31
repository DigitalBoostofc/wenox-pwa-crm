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
  /** Usuário interno (salário / pró-labore). */
  membro?: string;
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
    membro?: { id: string; nome?: string; nome_completo?: string; email?: string; role?: string };
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

/** Cliente mínimo para filtro (lista ou expand de lançamento). */
export type ClienteFiltro = { id: string; nome?: string; nome_fantasia?: string };

/**
 * Clientes únicos a partir de expand.cliente (ou id em `cliente`) nos lançamentos.
 * Usado no filtro quando listClientes vem vazio/curto (ex.: Membro RBAC).
 */
export function clientesFromLancamentos(lista: FinLancamento[]): ClienteFiltro[] {
  const map = new Map<string, ClienteFiltro>();
  for (const l of lista) {
    const exp = l.expand?.cliente;
    const id = (exp?.id || l.cliente || '').trim();
    if (!id || map.has(id)) continue;
    map.set(id, {
      id,
      nome: exp?.nome,
      nome_fantasia: exp?.nome_fantasia,
    });
  }
  return [...map.values()].sort((a, b) =>
    nomeCliente(a).localeCompare(nomeCliente(b), 'pt-BR', { sensitivity: 'base' }),
  );
}

/**
 * Prefer listClientes (Admin); completa com expand quando a lista está vazia/curta (Membro).
 */
export function mergeClientesFiltro(
  fromList: ClienteFiltro[],
  fromLancs: ClienteFiltro[],
): ClienteFiltro[] {
  if (!fromList.length) return [...fromLancs];
  const ids = new Set(fromList.map((c) => c.id));
  const extras = fromLancs.filter((c) => !ids.has(c.id));
  if (!extras.length) return [...fromList];
  return [...fromList, ...extras].sort((a, b) =>
    nomeCliente(a).localeCompare(nomeCliente(b), 'pt-BR', { sensitivity: 'base' }),
  );
}

/** Remove acentos e lowercase para match de categoria. */
export function normalizaTxt(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Categoria de despesa de equipe: "Salários e pró-labore" (e variantes).
 * Quando true → UI pede Membro (não Cliente); no caixa da agência continua despesa.
 */
export function isCategoriaSalarioProlabore(
  cat?: { nome?: string } | string | null,
): boolean {
  const nome = typeof cat === 'string' ? cat : cat?.nome || '';
  const n = normalizaTxt(nome);
  if (!n) return false;
  if (n.includes('salario') && (n.includes('prolabore') || n.includes('pro-labore') || n.includes('pro labore'))) {
    return true;
  }
  // nome canônico seed
  if (n === 'salarios e pro-labore' || n === 'salarios e prolabore') return true;
  if (n.includes('salario') && n.includes('pro')) return true;
  return false;
}

export function nomeMembro(m?: { nome?: string; nome_completo?: string; email?: string } | null): string {
  if (!m) return '';
  return (m.nome_completo || m.nome || m.email || '').trim();
}

/**
 * Para o Membro logado: lançamento de salário/pró-labore dele aparece como ganho.
 * Admin/caixa da agência sempre trata como despesa.
 */
export function ehGanhoDoMembro(
  l: Pick<FinLancamento, 'membro' | 'tipo' | 'expand'> & { categoria?: string },
  userId: string | undefined | null,
  /** mapa id→categoria se expand ausente */
  catById?: Map<string, FinCategoria>,
): boolean {
  if (!userId || !l.membro || l.membro !== userId) return false;
  const cat = l.expand?.categoria || (l.categoria ? catById?.get(l.categoria) : undefined);
  return isCategoriaSalarioProlabore(cat);
}

/**
 * Privacidade: Membro não vê salário de outros.
 * Mantém demais lançamentos; esconde despesa salário onde membro ≠ self (ou sem membro).
 */
export function filtrarPrivacidadeMembro(
  lista: FinLancamento[],
  userId: string,
  catById?: Map<string, FinCategoria>,
): FinLancamento[] {
  return lista.filter((l) => {
    const cat = l.expand?.categoria || (l.categoria ? catById?.get(l.categoria) : undefined);
    if (!isCategoriaSalarioProlabore(cat)) return true;
    return l.membro === userId;
  });
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
