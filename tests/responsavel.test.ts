import { describe, expect, it } from 'vitest';
import {
  normalizarResponsaveis,
  responsavelUnico,
  candidatosResponsavelProjeto,
  responsaveisValidosParaProjeto,
} from '@/tarefas/responsavel';
import type { Usuario } from '@/usuarios/types';

const u1 = { id: 'u1', nome: 'Ana', email: 'a@x', role: 'Membro', status: 'Ativo' } as Usuario;
const u2 = { id: 'u2', nome: 'Bia', email: 'b@x', role: 'Membro', status: 'Ativo' } as Usuario;
const u3 = { id: 'u3', nome: 'Cris', email: 'c@x', role: 'Membro', status: 'Ativo' } as Usuario;

describe('responsavel — único + equipe do projeto', () => {
  it('normalizarResponsaveis mantém só o primeiro', () => {
    expect(normalizarResponsaveis(['u1', 'u2'])).toEqual(['u1']);
    expect(normalizarResponsaveis([])).toEqual([]);
    expect(normalizarResponsaveis(undefined)).toEqual([]);
    expect(responsavelUnico(['u2', 'u1'])).toBe('u2');
  });

  it('candidatosResponsavelProjeto só da equipe do projeto', () => {
    const proj = { responsaveis: ['u2', 'u1'], expand: { responsaveis: [] } };
    expect(candidatosResponsavelProjeto(proj, [u1, u2, u3]).map((u) => u.id)).toEqual(['u2', 'u1']);
    expect(candidatosResponsavelProjeto({ responsaveis: [] }, [u1])).toEqual([]);
    expect(candidatosResponsavelProjeto(undefined, [u1])).toEqual([]);
  });

  it('responsaveisValidosParaProjeto limpa quem não está na equipe', () => {
    expect(responsaveisValidosParaProjeto(['u1'], { responsaveis: ['u1', 'u2'] })).toEqual(['u1']);
    expect(responsaveisValidosParaProjeto(['u3'], { responsaveis: ['u1', 'u2'] })).toEqual([]);
    expect(responsaveisValidosParaProjeto(['u1'], undefined)).toEqual([]);
    expect(responsaveisValidosParaProjeto(['u1', 'u2'], { responsaveis: ['u2'] })).toEqual([]);
  });
});
