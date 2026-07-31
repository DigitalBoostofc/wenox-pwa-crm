import { pb } from '@/lib/pocketbase';
import type {
  FinCategoria,
  FinCategoriaInput,
  FinConta,
  FinContaInput,
  FinLancamento,
  FinLancamentoInput,
  FrequenciaRecorrencia,
} from './types';
import { addPeriodoISO, hojeISO } from './types';

const contas = () => pb.collection('fin_contas');
const cats = () => pb.collection('fin_categorias');
const lancs = () => pb.collection('fin_lancamentos');

/* ── Contas ─────────────────────────────────────────────────────────── */

export async function listContas(opts?: { soAtivas?: boolean }): Promise<FinConta[]> {
  const filter = opts?.soAtivas ? 'ativo = true' : '';
  const res = await contas().getFullList({ filter, sort: 'nome' });
  return res as unknown as FinConta[];
}

export async function createConta(input: FinContaInput): Promise<FinConta> {
  const saldo = Number(input.saldo_inicial ?? 0) || 0;
  const rec = await contas().create({
    ...input,
    ativo: input.ativo ?? true,
    saldo_inicial: saldo,
    saldo_atual: saldo,
  });
  return rec as unknown as FinConta;
}

export async function updateConta(id: string, input: Partial<FinContaInput>): Promise<FinConta> {
  // nunca enviar saldo_atual no update
  const { saldo_atual: _s, ...rest } = input as FinContaInput & { saldo_atual?: number };
  const rec = await contas().update(id, rest);
  return rec as unknown as FinConta;
}

export async function removeConta(id: string): Promise<void> {
  await contas().delete(id);
}

/* ── Categorias ─────────────────────────────────────────────────────── */

export async function listCategorias(opts?: {
  tipo?: 'receita' | 'despesa';
  incluirArquivadas?: boolean;
}): Promise<FinCategoria[]> {
  const parts: string[] = [];
  if (opts?.tipo) parts.push(`tipo = "${opts.tipo}"`);
  if (!opts?.incluirArquivadas) parts.push('arquivada != true');
  const filter = parts.join(' && ');
  const res = await cats().getFullList({ filter, sort: 'tipo,nome' });
  return res as unknown as FinCategoria[];
}

export async function createCategoria(input: FinCategoriaInput): Promise<FinCategoria> {
  const rec = await cats().create({ ...input, arquivada: input.arquivada ?? false });
  return rec as unknown as FinCategoria;
}

export async function updateCategoria(
  id: string,
  input: Partial<FinCategoriaInput>,
): Promise<FinCategoria> {
  const rec = await cats().update(id, input);
  return rec as unknown as FinCategoria;
}

export async function removeCategoria(id: string): Promise<void> {
  await cats().delete(id);
}

/* ── Lançamentos ────────────────────────────────────────────────────── */

export interface ListLancamentosFiltro {
  contaId?: string;
  clienteId?: string;
  projetoId?: string;
  tipo?: 'receita' | 'despesa';
  status?: string;
  /** yyyy-mm-dd inclusive */
  de?: string;
  ate?: string;
  /** busca na descrição */
  q?: string;
  /** só a pagar/receber (não pagos) */
  abertos?: boolean;
}

function buildFilter(f: ListLancamentosFiltro = {}): string {
  const parts: string[] = [];
  if (f.contaId) parts.push(`conta = "${f.contaId}"`);
  if (f.clienteId) parts.push(`cliente = "${f.clienteId}"`);
  if (f.projetoId) parts.push(`projeto = "${f.projetoId}"`);
  if (f.tipo) parts.push(`tipo = "${f.tipo}"`);
  if (f.status) parts.push(`status = "${f.status}"`);
  if (f.abertos) parts.push(`status != "pago"`);
  if (f.de) parts.push(`data >= "${f.de}"`);
  if (f.ate) parts.push(`data <= "${f.ate} 23:59:59"`);
  if (f.q?.trim()) {
    const s = f.q.trim().replace(/"/g, '');
    parts.push(`descricao ~ "${s}"`);
  }
  return parts.join(' && ');
}

export async function listLancamentos(
  filtro: ListLancamentosFiltro = {},
): Promise<FinLancamento[]> {
  const filter = buildFilter(filtro);
  const res = await lancs().getFullList({
    filter,
    sort: '-data,-created',
    expand: 'categoria,conta,cliente,projeto',
  });
  return res as unknown as FinLancamento[];
}

export async function createLancamento(input: FinLancamentoInput): Promise<FinLancamento> {
  const payload = {
    ...input,
    recorrencia: input.recorrencia || 'unica',
    origem: input.origem || 'manual',
    status: input.status || 'pago',
    valor: Number(input.valor) || 0,
  };
  const rec = await lancs().create(payload);
  return rec as unknown as FinLancamento;
}

export async function updateLancamento(
  id: string,
  input: Partial<FinLancamentoInput>,
): Promise<FinLancamento> {
  const rec = await lancs().update(id, input);
  return rec as unknown as FinLancamento;
}

export async function removeLancamento(id: string): Promise<void> {
  await lancs().delete(id);
}

/** Marca como pago (data de pagamento = hoje se não informada). */
export async function marcarPago(id: string, data?: string): Promise<FinLancamento> {
  return updateLancamento(id, { status: 'pago', data: data || hojeISO() });
}

/**
 * Gera as próximas N ocorrências de um lançamento fixo/recorrente.
 * Cria cópias com status pendente/previsto e mesmo serie_id.
 */
export async function gerarProximasRecorrencias(
  base: FinLancamento,
  quantidade = 3,
): Promise<FinLancamento[]> {
  if (base.recorrencia !== 'fixa' && base.recorrencia !== 'recorrente') {
    throw new Error('Só lançamentos fixos/recorrentes geram série.');
  }
  const serie = base.serie_id || base.id;
  const freq = (base.frequencia || 'mensal') as FrequenciaRecorrencia;
  // garante serie_id no original
  if (!base.serie_id) {
    await updateLancamento(base.id, { serie_id: serie });
  }
  const criados: FinLancamento[] = [];
  let data = base.data.slice(0, 10);
  for (let i = 0; i < quantidade; i++) {
    data = addPeriodoISO(data, freq, 1);
    const rec = await createLancamento({
      tipo: base.tipo,
      descricao: base.descricao,
      categoria: base.categoria,
      valor: base.valor,
      conta: base.conta,
      data,
      vencimento: data,
      status: 'previsto',
      recorrencia: base.recorrencia,
      frequencia: freq,
      serie_id: serie,
      origem: base.origem || 'manual',
      cliente: base.cliente || '',
      projeto: base.projeto || '',
      forma_pagamento: base.forma_pagamento || '',
      observacao: base.observacao || '',
    });
    criados.push(rec);
  }
  return criados;
}

/**
 * Transferência entre contas via 2 lançamentos (despesa + receita) + categorias sistema.
 * Alternativa à rota /api/wenox/fin/transferencia (que só mexe saldo).
 */
export async function transferirEntreContas(opts: {
  from: string;
  to: string;
  valor: number;
  data?: string;
  descricao?: string;
}): Promise<{ saida: FinLancamento; entrada: FinLancamento }> {
  const valor = Number(opts.valor);
  if (!(valor > 0)) throw new Error('Valor deve ser > 0');
  if (opts.from === opts.to) throw new Error('Contas iguais');
  const categorias = await listCategorias({ incluirArquivadas: true });
  const catOut =
    categorias.find((c) => c.tipo === 'despesa' && c.nome === 'Transferência') ||
    categorias.find((c) => c.tipo === 'despesa');
  const catIn =
    categorias.find((c) => c.tipo === 'receita' && c.nome === 'Transferência recebida') ||
    categorias.find((c) => c.tipo === 'receita');
  if (!catOut || !catIn) throw new Error('Categorias de transferência ausentes — rode setup_financeiro.');
  const data = opts.data || hojeISO();
  const desc = opts.descricao || 'Transferência entre contas';
  const saida = await createLancamento({
    tipo: 'despesa',
    descricao: desc,
    categoria: catOut.id,
    valor,
    conta: opts.from,
    data,
    status: 'pago',
    recorrencia: 'unica',
    origem: 'transferencia',
  });
  const entrada = await createLancamento({
    tipo: 'receita',
    descricao: desc,
    categoria: catIn.id,
    valor,
    conta: opts.to,
    data,
    status: 'pago',
    recorrencia: 'unica',
    origem: 'transferencia',
  });
  return { saida, entrada };
}

/** Resumo do mês corrente (ou intervalo). */
export function resumirLancamentos(lista: FinLancamento[]) {
  let receitasPagas = 0;
  let despesasPagas = 0;
  let aReceber = 0;
  let aPagar = 0;
  for (const l of lista) {
    const v = Number(l.valor) || 0;
    if (l.status === 'pago') {
      if (l.tipo === 'receita') receitasPagas += v;
      else despesasPagas += v;
    } else {
      if (l.tipo === 'receita') aReceber += v;
      else aPagar += v;
    }
  }
  return {
    receitasPagas,
    despesasPagas,
    saldoPeriodo: receitasPagas - despesasPagas,
    aReceber,
    aPagar,
  };
}

/**
 * Primeiro dia do mês (yyyy-mm-dd).
 * Aceita Date, ou (ano, mês 1–12). Default: mês atual.
 */
export function primeiroDiaMes(anoOrDate?: number | Date, mes1a12?: number): string {
  const { y, m0 } = resolveAnoMes(anoOrDate, mes1a12);
  return `${y}-${String(m0 + 1).padStart(2, '0')}-01`;
}

/**
 * Último dia do mês (yyyy-mm-dd).
 * Aceita Date, ou (ano, mês 1–12). Default: mês atual.
 */
export function ultimoDiaMes(anoOrDate?: number | Date, mes1a12?: number): string {
  const { y, m0 } = resolveAnoMes(anoOrDate, mes1a12);
  const last = new Date(y, m0 + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

function resolveAnoMes(
  anoOrDate?: number | Date,
  mes1a12?: number,
): { y: number; m0: number } {
  if (anoOrDate instanceof Date) {
    return { y: anoOrDate.getFullYear(), m0: anoOrDate.getMonth() };
  }
  if (typeof anoOrDate === 'number' && typeof mes1a12 === 'number') {
    return { y: anoOrDate, m0: mes1a12 - 1 };
  }
  const d = new Date();
  return { y: d.getFullYear(), m0: d.getMonth() };
}
