import { describe, it, expect } from 'vitest';
import { addMesesISO, addPeriodoISO, brl, efeitoNoSaldo } from '@/financeiro/types';
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
});
