import { describe, it, expect } from 'vitest';
import { canCriarCliente, canExcluirCliente, canGerirUsuarios, canGerirEquipe } from '@/auth/perms';

describe('perms', () => {
  it('criar cliente: Owner/Admin/Gestor sim; Membro/Visualizador nao', () => {
    expect(canCriarCliente('Owner')).toBe(true);
    expect(canCriarCliente('Gestor')).toBe(true);
    expect(canCriarCliente('Membro')).toBe(false);
    expect(canCriarCliente('Visualizador')).toBe(false);
  });
  it('excluir cliente: so Owner/Admin', () => {
    expect(canExcluirCliente('Admin')).toBe(true);
    expect(canExcluirCliente('Gestor')).toBe(false);
  });
  it('gerir usuarios: so Owner/Admin', () => {
    expect(canGerirUsuarios('Owner')).toBe(true);
    expect(canGerirUsuarios('Membro')).toBe(false);
  });
  it('gerir equipe: Owner/Admin/Gestor', () => {
    expect(canGerirEquipe('Gestor')).toBe(true);
    expect(canGerirEquipe('Visualizador')).toBe(false);
  });
});
