import { describe, it, expect } from 'vitest';
import {
  addMesesISO,
  addPeriodoISO,
  brl,
  clientesFromLancamentos,
  ehGanhoDoMembro,
  efeitoNoSaldo,
  filtrarLancamentos,
  filtrarPrivacidadeMembro,
  isCategoriaSalarioProlabore,
  mergeClientesFiltro,
  topCategoriasPagas,
} from '@/financeiro/types';
import { primeiroDiaMes, resumirLancamentos, ultimoDiaMes } from '@/financeiro/financeiroService';
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

  it('filtrarLancamentos: q vazio (ou só espaços) não filtra por texto', () => {
    const lista = [
      { id: '1', descricao: 'Mensalidade Gold', cliente: 'c1' },
      { id: '2', descricao: 'Freela design', cliente: 'c2' },
    ] as FinLancamento[];
    expect(filtrarLancamentos(lista, { q: '' }).map((l) => l.id)).toEqual(['1', '2']);
    expect(filtrarLancamentos(lista, { q: '   ' }).map((l) => l.id)).toEqual(['1', '2']);
    expect(filtrarLancamentos(lista, {}).map((l) => l.id)).toEqual(['1', '2']);
  });

  it('filtrarLancamentos: lista vazia retorna []', () => {
    expect(filtrarLancamentos([], { clienteId: 'c1', q: 'x' })).toEqual([]);
    expect(filtrarLancamentos([])).toEqual([]);
  });

  it('filtrarLancamentos: clienteId sem match retorna []', () => {
    const lista = [
      { id: '1', descricao: 'Mensalidade Gold', cliente: 'c1' },
      { id: '2', descricao: 'Freela design', cliente: 'c2' },
    ] as FinLancamento[];
    expect(filtrarLancamentos(lista, { clienteId: 'inexistente' })).toEqual([]);
    expect(filtrarLancamentos(lista, { clienteId: 'c9', q: 'mensalidade' })).toEqual([]);
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

  it('topCategoriasPagas: limita a n itens', () => {
    const lista = [
      { status: 'pago', tipo: 'receita', valor: 100, expand: { categoria: { nome: 'A' } } },
      { status: 'pago', tipo: 'receita', valor: 90, expand: { categoria: { nome: 'B' } } },
      { status: 'pago', tipo: 'despesa', valor: 80, expand: { categoria: { nome: 'C' } } },
      { status: 'pago', tipo: 'despesa', valor: 70, expand: { categoria: { nome: 'D' } } },
      { status: 'pago', tipo: 'receita', valor: 60, expand: { categoria: { nome: 'E' } } },
    ] as FinLancamento[];
    const top2 = topCategoriasPagas(lista, 2);
    expect(top2).toHaveLength(2);
    expect(top2[0]).toMatchObject({ nome: 'A', valor: 100 });
    expect(top2[1]).toMatchObject({ nome: 'B', valor: 90 });
    expect(topCategoriasPagas(lista, 1)).toHaveLength(1);
    expect(topCategoriasPagas(lista, 0)).toHaveLength(0);
  });

  it('topCategoriasPagas: mix receita/despesa separa por tipo+nome', () => {
    // Mesmo nome em tipos diferentes vira barras distintas (key tipo:nome).
    const lista = [
      { status: 'pago', tipo: 'receita', valor: 200, expand: { categoria: { nome: 'Serviços' } } },
      { status: 'pago', tipo: 'despesa', valor: 50, expand: { categoria: { nome: 'Serviços' } } },
      { status: 'pago', tipo: 'receita', valor: 30, expand: { categoria: { nome: 'Serviços' } } },
      { status: 'pago', tipo: 'despesa', valor: 100, expand: { categoria: { nome: 'Marketing' } } },
    ] as FinLancamento[];
    const top = topCategoriasPagas(lista, 10);
    expect(top).toHaveLength(3);
    expect(top[0]).toMatchObject({ nome: 'Serviços', valor: 230, tipo: 'receita' });
    expect(top[1]).toMatchObject({ nome: 'Marketing', valor: 100, tipo: 'despesa' });
    expect(top[2]).toMatchObject({ nome: 'Serviços', valor: 50, tipo: 'despesa' });
  });

  it('topCategoriasPagas: lista vazia ou só não-pago retorna []', () => {
    expect(topCategoriasPagas([], 5)).toEqual([]);
    const soAbertos = [
      { status: 'pendente', tipo: 'receita', valor: 100, expand: { categoria: { nome: 'A' } } },
      { status: 'previsto', tipo: 'despesa', valor: 50, expand: { categoria: { nome: 'B' } } },
    ] as FinLancamento[];
    expect(topCategoriasPagas(soAbertos, 5)).toEqual([]);
  });

  it('clientesFromLancamentos: únicos do expand (e fallback id)', () => {
    const lista = [
      {
        id: '1',
        cliente: 'c1',
        expand: { cliente: { id: 'c1', nome_fantasia: 'Goldtech' } },
      },
      {
        id: '2',
        cliente: 'c1',
        expand: { cliente: { id: 'c1', nome_fantasia: 'Goldtech' } },
      },
      {
        id: '3',
        cliente: 'c2',
        expand: { cliente: { id: 'c2', nome: 'Sotec Ltda' } },
      },
      { id: '4', cliente: 'c3' }, // sem expand — usa id
      { id: '5' }, // sem cliente
    ] as FinLancamento[];
    const cli = clientesFromLancamentos(lista);
    expect(cli.map((c) => c.id).sort()).toEqual(['c1', 'c2', 'c3']);
    expect(cli.find((c) => c.id === 'c1')?.nome_fantasia).toBe('Goldtech');
    expect(cli.find((c) => c.id === 'c2')?.nome).toBe('Sotec Ltda');
  });

  it('mergeClientesFiltro: Admin preferido; Membro preenche do expand', () => {
    const admin = [
      { id: 'a', nome_fantasia: 'A' },
      { id: 'b', nome_fantasia: 'B' },
    ];
    const fromLancs = [
      { id: 'b', nome_fantasia: 'B expand' },
      { id: 'c', nome_fantasia: 'C' },
    ];
    // lista cheia: só acrescenta o que falta
    const merged = mergeClientesFiltro(admin, fromLancs);
    expect(merged.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(merged.find((c) => c.id === 'b')?.nome_fantasia).toBe('B'); // prefer list
    // lista vazia (Membro): usa expand
    expect(mergeClientesFiltro([], fromLancs)).toEqual(fromLancs);
    // cópia: mutar o retorno não altera fromLancs
    const soExpand = mergeClientesFiltro([], fromLancs);
    expect(soExpand).not.toBe(fromLancs);
    soExpand.push({ id: 'x' });
    expect(fromLancs.find((c) => c.id === 'x')).toBeUndefined();
  });

  it('primeiroDiaMes / ultimoDiaMes: Date e y/m', () => {
    expect(primeiroDiaMes(2026, 7)).toBe('2026-07-01');
    expect(ultimoDiaMes(2026, 7)).toBe('2026-07-31');
    expect(primeiroDiaMes(2026, 2)).toBe('2026-02-01');
    expect(ultimoDiaMes(2026, 2)).toBe('2026-02-28');
    expect(primeiroDiaMes(new Date(2026, 6, 15))).toBe('2026-07-01'); // mês 0-based no Date
    expect(ultimoDiaMes(new Date(2026, 6, 1))).toBe('2026-07-31');
  });

  it('isCategoriaSalarioProlabore reconhece seed e variantes', () => {
    expect(isCategoriaSalarioProlabore({ nome: 'Salários e pró-labore' })).toBe(true);
    expect(isCategoriaSalarioProlabore('Salarios e Prolabore')).toBe(true);
    expect(isCategoriaSalarioProlabore({ nome: 'Mensalidade / retainer' })).toBe(false);
    expect(isCategoriaSalarioProlabore(null)).toBe(false);
  });

  it('filtrarPrivacidadeMembro esconde salário de outros', () => {
    const lista = [
      {
        id: '1',
        membro: 'u1',
        tipo: 'despesa',
        expand: { categoria: { nome: 'Salários e pró-labore' } },
      },
      {
        id: '2',
        membro: 'u2',
        tipo: 'despesa',
        expand: { categoria: { nome: 'Salários e pró-labore' } },
      },
      {
        id: '3',
        tipo: 'receita',
        expand: { categoria: { nome: 'Mensalidade / retainer' } },
      },
      // fail-closed: membro de outro sem expand de categoria
      { id: '4', membro: 'u9', tipo: 'despesa' },
    ] as FinLancamento[];
    const v = filtrarPrivacidadeMembro(lista, 'u1');
    expect(v.map((x) => x.id)).toEqual(['1', '3']);
    expect(ehGanhoDoMembro(lista[0], 'u1')).toBe(true);
    expect(ehGanhoDoMembro(lista[0], 'u2')).toBe(false);
  });
});
