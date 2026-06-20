/**
 * R1.A — createCliente: quadro clonado no sucesso; rollback (delete) no falha.
 * Segue o padrão de tests/clientesService.test.ts mas adiciona o mock de
 * quadrosService que a implementação agora exige.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { pbCreate, pbDelete, pbGetOne, clonarFn, registrar } = vi.hoisted(() => ({
  pbCreate: vi.fn(),
  pbDelete: vi.fn(),
  pbGetOne: vi.fn(),
  clonarFn: vi.fn(),
  registrar: vi.fn(),
}));

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    collection: () => ({ create: pbCreate, delete: pbDelete, getOne: pbGetOne }),
    authStore: { record: { id: 'u1' } },
    files: { getURL: () => '' },
  },
}));

vi.mock('@/quadros/quadrosService', () => ({ clonarQuadroTemplate: clonarFn }));

vi.mock('@/atividade/atividadeService', () => ({
  registrarHistorico: registrar,
  diffCampos: () => [],
}));

import { createCliente } from '@/clientes/clientesService';

const INPUT = { nome_fantasia: 'ACME', categoria: 'Cliente', telefone: '11', status: 'Ativo' } as const;

describe('createCliente — R1.A', () => {
  beforeEach(() => vi.clearAllMocks());

  it('caminho feliz: cria cliente, clona quadro e registra histórico', async () => {
    pbCreate.mockResolvedValue({ id: 'c1', nome_fantasia: 'ACME', nome: '' });
    clonarFn.mockResolvedValue({ id: 'q1' });
    registrar.mockResolvedValue(undefined);

    const r = await createCliente(INPUT as any);

    expect(pbCreate).toHaveBeenCalledTimes(1);
    expect(clonarFn).toHaveBeenCalledWith('c1', 'ACME');
    expect(registrar).toHaveBeenCalledWith('cliente', 'c1', 'Cliente cadastrado');
    expect(r.id).toBe('c1');
  });

  it('rollback: quando clonarQuadroTemplate lança, deleta o cliente e propaga erro', async () => {
    pbCreate.mockResolvedValue({ id: 'c2', nome_fantasia: 'BetaCo', nome: '' });
    clonarFn.mockRejectedValue(new Error('template não encontrado'));
    pbDelete.mockResolvedValue(undefined);

    await expect(createCliente(INPUT as any)).rejects.toThrow(
      'quadro não pôde ser criado',
    );
    expect(pbDelete).toHaveBeenCalledWith('c2');
    expect(registrar).not.toHaveBeenCalled();
  });

  it('rollback duplo: se delete também falha, erro menciona falha no rollback', async () => {
    pbCreate.mockResolvedValue({ id: 'c3', nome_fantasia: 'GamaCo', nome: '' });
    clonarFn.mockRejectedValue(new Error('sem template'));
    pbDelete.mockRejectedValue(new Error('permissão negada'));

    const err = await createCliente(INPUT as any).catch((e: Error) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/parcialmente criado/);
    expect(err.message).toMatch(/rollback/);
    expect(registrar).not.toHaveBeenCalled();
  });

  it('uses nome_fantasia como nome do quadro', async () => {
    pbCreate.mockResolvedValue({ id: 'c4', nome_fantasia: 'MarcaX', nome: 'Razão Social' });
    clonarFn.mockResolvedValue({ id: 'q4' });
    registrar.mockResolvedValue(undefined);

    await createCliente({ ...INPUT, nome_fantasia: 'MarcaX' } as any);

    expect(clonarFn).toHaveBeenCalledWith('c4', 'MarcaX');
  });

  it('usa nome quando nome_fantasia está vazio', async () => {
    pbCreate.mockResolvedValue({ id: 'c5', nome_fantasia: '', nome: 'Razão S/A' });
    clonarFn.mockResolvedValue({ id: 'q5' });
    registrar.mockResolvedValue(undefined);

    await createCliente({ ...INPUT, nome_fantasia: '' } as any);

    expect(clonarFn).toHaveBeenCalledWith('c5', 'Razão S/A');
  });
});
