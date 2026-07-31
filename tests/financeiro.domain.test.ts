import { describe, it, expect } from 'vitest';
import { addMesesISO, addPeriodoISO, brl, efeitoNoSaldo, filtrarLancamentos, topCategoriasPagas } from '@/financeiro/types';
import { resumirLancamentos } from '@/financeiro/financeiroService';
import type { FinLancamento } from '@/financeiro/types';

describe('financeiro domain', () => {
  it('efeitoNoSaldo: só pago mexe; receita + despesa −', () => {
    expect(efeitoNoSaldo({ tipo: 'receita', status: 'pago', valor: 100 })).toBe(100);
    expect(efeitoNoSaldo({ tipo: 'despesa', status: 'pago', valor: 40 })).toBe(-40);
    expect(efeitoNoSaldo({ tipo: 'receita', status: 'pendente', valor: 100 })).toBe(0);
    expect(efeitoNoSaldo({ tipo: 'despesa', status: 'previsto', valor: 50 })).toBe(0);
  });

  it('addMesesISO clampa fim de mês', () => {
    expect(addMesesISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMesesISO('2026-03-15', 1)).toBe('2026-04-15');
  });

  it('addPeriodoISO mensal/semanal', () => {
    expect(addPeriodoISO('2026-07-01', 'mensal', 1)).toBe('2026-08-01');
    expect(addPeriodoISO('2026-07-01', 'semanal', 1)).toBe('2026-07-08');
  });

  it('brl formata pt-BR', () => {
    expect(brl(1500.5)).toMatch(/1\.500,50/);
  });

  it('resumirLancamentos separa pagos e abertos', () => {
    const lista = [
      { tipo: 'receita', status: 'pago', valor: 1000 },
      { tipo: 'despesa', status: 'pago', valor: 200 },
      { tipo: 'receita', status: 'pendente', valor: 500 },
      { tipo: 'despesa', status: 'previsto', valor: 80 },
    ] as FinLancamento[];
    const s = resumirLancamentos(lista);
    expect(s.receitasPagas).toBe(1000);
    expect(s.despesasPagas).toBe(200);
    expect(s.saldoPeriodo).toBe(800);
    expect(s.aReceber).toBe(500);
    expect(s.aPagar).toBe(80);
  });

  it('filtrarLancamentos por cliente e busca', () => {
    const lista = [
      { id: '1', descricao: 'Mensalidade Gold', cliente: 'c1' },
      { id: '2', descricao: 'Freela design', cliente: 'c2' },
      { id: '3', descricao: 'Mensalidade Via', cliente: 'c1' },
    ] as FinLancamento[];
    expect(filtrarLancamentos(lista, { clienteId: 'c1' }).map((l) => l.id)).toEqual(['1', '3']);
    expect(filtrarLancamentos(lista, { q: 'freela' }).map((l) => l.id)).toEqual(['2']);
  });

  it('topCategoriasPagas ordena e ignora não-pago', () => {
    const lista = [
      { status: 'pago', tipo: 'receita', valor: 100, expand: { categoria: { nome: 'A' } } },
      { status: 'pago', tipo: 'receita', valor: 50, expand: { categoria: { nome: 'A' } } },
      { status: 'pago', tipo: 'despesa', valor: 80, expand: { categoria: { nome: 'B' } } },
      { status: 'pendente', tipo: 'receita', valor: 999, expand: { categoria: { nome: 'C' } } },
    ] as FinLancamento[];
    const top = topCategoriasPagas(lista, 5);
    expect(top[0]).toMatchObject({ nome: 'A', valor: 150, tipo: 'receita' });
    expect(top.find((t) => t.nome === 'C')).toBeUndefined();
  });
});
