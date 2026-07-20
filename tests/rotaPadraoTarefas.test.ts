import { describe, expect, it } from 'vitest';
import {
  areaTarefasSincrona, casarTipoProjeto,
  pathTarefasSincrono, pathProjetosSincrono,
} from '@/lib/rotaPadraoArea';

describe('areaTarefasSincrona / areaPadrao', () => {
  it('Owner/Admin/Gestor → Gestão', () => {
    expect(areaTarefasSincrona({ role: 'Owner' })).toBe('Gestão');
    expect(areaTarefasSincrona({ role: 'Admin' })).toBe('Gestão');
    expect(areaTarefasSincrona({ role: 'Gestor', area: 'Social Media' })).toBe('Gestão');
  });

  it('Membro → user.area', () => {
    expect(areaTarefasSincrona({ role: 'Membro', area: 'Design' })).toBe('Design');
    expect(areaTarefasSincrona({ role: 'Membro', area: 'Social Media' })).toBe('Social Media');
    expect(areaTarefasSincrona({ role: 'Membro' })).toBeNull();
  });

  it('Cliente → null', () => {
    expect(areaTarefasSincrona({ role: 'Cliente', area: 'Design' })).toBeNull();
  });
});

describe('casarTipoProjeto', () => {
  const tipos = ['Design', 'Social Media', 'Tráfego Pago', 'Gestão', 'Desenvolvimento'];

  it('casa exato e fuzzy', () => {
    expect(casarTipoProjeto('Design', tipos)).toBe('Design');
    expect(casarTipoProjeto('Gestão', tipos)).toBe('Gestão');
    expect(casarTipoProjeto('gestao', tipos)).toBe('Gestão');
    expect(casarTipoProjeto('Social', tipos)).toBe('Social Media');
  });
});

describe('pathTarefasSincrono / pathProjetosSincrono', () => {
  it('monta path da área em tarefas e projetos', () => {
    expect(pathTarefasSincrono({ role: 'Owner' })).toBe('/tarefas/area/Gest%C3%A3o');
    expect(pathTarefasSincrono({ role: 'Membro', area: 'Design' })).toBe('/tarefas/area/Design');
    expect(pathTarefasSincrono({ role: 'Cliente' })).toBe('/tarefas');

    expect(pathProjetosSincrono({ role: 'Owner' })).toBe('/projetos/area/Gest%C3%A3o');
    expect(pathProjetosSincrono({ role: 'Membro', area: 'Design' })).toBe('/projetos/area/Design');
    expect(pathProjetosSincrono({ role: 'Cliente' })).toBe('/projetos');
  });
});
