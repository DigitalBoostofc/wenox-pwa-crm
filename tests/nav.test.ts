import { describe, it, expect } from 'vitest';
import { titleForPath } from '@/components/layout/nav';

describe('titleForPath', () => {
  describe('conta normal (souCliente omitido/false)', () => {
    it('/dashboard → Dashboard', () => {
      expect(titleForPath('/dashboard')).toBe('Dashboard');
    });
    it('/minha-area → Minha Área (regressão PR #4)', () => {
      expect(titleForPath('/minha-area')).toBe('Minha Área');
    });
    it('/tarefas → Tarefas', () => {
      expect(titleForPath('/tarefas')).toBe('Tarefas');
    });
    it('/projetos → Projetos', () => {
      expect(titleForPath('/projetos')).toBe('Projetos');
    });
    it('/clientes → Clientes', () => {
      expect(titleForPath('/clientes')).toBe('Clientes');
    });
    it('/config → Configurações', () => {
      expect(titleForPath('/config')).toBe('Configurações');
    });
    it('/equipe → Equipe', () => {
      expect(titleForPath('/equipe')).toBe('Equipe');
    });
    it('/quadros → Quadros', () => {
      expect(titleForPath('/quadros')).toBe('Quadros');
    });
  });

  describe('conta Cliente (souCliente=true)', () => {
    it('/tarefas → Minhas Tarefas (regressão PR #5)', () => {
      expect(titleForPath('/tarefas', true)).toBe('Minhas Tarefas');
    });
    it('/projetos → Meus Projetos (regressão PR #5)', () => {
      expect(titleForPath('/projetos', true)).toBe('Meus Projetos');
    });
  });

  describe('early-returns (independem de souCliente)', () => {
    it('/minha-empresa → Minha Empresa (souCliente=false)', () => {
      expect(titleForPath('/minha-empresa')).toBe('Minha Empresa');
    });
    it('/minha-empresa → Minha Empresa (souCliente=true)', () => {
      expect(titleForPath('/minha-empresa', true)).toBe('Minha Empresa');
    });
    it('/usuarios → Usuários', () => {
      expect(titleForPath('/usuarios')).toBe('Usuários');
    });
    it('/novo-cliente → Novo cliente', () => {
      expect(titleForPath('/novo-cliente')).toBe('Novo cliente');
    });
    it('/quadros/abc123 → "" (dentro de quadro específico)', () => {
      expect(titleForPath('/quadros/abc123')).toBe('');
    });
  });

  describe('subrotas resolvem pelo startsWith', () => {
    it('/tarefas/123 → Tarefas (normal)', () => {
      expect(titleForPath('/tarefas/123')).toBe('Tarefas');
    });
    it('/tarefas/123 → Minhas Tarefas (Cliente)', () => {
      expect(titleForPath('/tarefas/123', true)).toBe('Minhas Tarefas');
    });
  });

  describe('path desconhecido', () => {
    it('/rota-inexistente → Wenox OS', () => {
      expect(titleForPath('/rota-inexistente')).toBe('Wenox OS');
    });
  });
});
