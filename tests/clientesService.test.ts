import { describe, it, expect, vi, beforeEach } from 'vitest';

const getList = vi.fn();
const getOne = vi.fn();
const create = vi.fn();
const update = vi.fn();
const del = vi.fn();

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    collection: () => ({
      getList,
      getOne,
      create,
      update,
      delete: del,
    }),
    authStore: { record: { id: 'u1' } },
    files: { getURL: () => '' },
  },
}));
vi.mock('@/atividade/atividadeService', () => ({
  registrarHistorico: vi.fn(),
  diffCampos: () => [],
}));

import {
  listClientes, getCliente, createCliente, updateCliente, deleteCliente,
  REMOVER_LOGO,
} from '@/clientes/clientesService';

describe('clientesService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listClientes repassa busca como filtro e retorna items', async () => {
    getList.mockResolvedValue({ items: [{ id: '1', nome_fantasia: 'ACME' }] });
    const r = await listClientes('acme');
    expect(getList).toHaveBeenCalledWith(1, 200, expect.objectContaining({
      filter: expect.stringContaining('acme'),
      sort: '-created',
      fields: expect.stringContaining('nome_fantasia'),
    }));
    expect(r).toEqual([{ id: '1', nome_fantasia: 'ACME' }]);
  });

  it('listClientes busca também por nome (pessoa)', async () => {
    getList.mockResolvedValue({ items: [] });
    await listClientes('joao');
    expect(getList).toHaveBeenCalledWith(1, 200, expect.objectContaining({
      filter: expect.stringContaining('nome ~'),
    }));
  });

  it('listClientes inclui nome/telefones/emails nos fields', async () => {
    getList.mockResolvedValue({ items: [] });
    await listClientes('');
    const opts = (getList.mock.calls[0] as unknown[])[2] as { fields: string };
    expect(opts.fields).toContain('nome');
    expect(opts.fields).toContain('telefones');
    expect(opts.fields).toContain('emails');
  });

  it('getCliente delega para getOne', async () => {
    getOne.mockResolvedValue({ id: '9' });
    expect(await getCliente('9')).toEqual({ id: '9' });
    expect(getOne).toHaveBeenCalledWith('9');
  });

  it('createCliente delega para create', async () => {
    create.mockResolvedValue({ id: 'new' });
    const r = await createCliente({ nome_fantasia: 'X', categoria: 'Cliente', telefone: '1', status: 'Ativo' } as any);
    expect(create).toHaveBeenCalled();
    expect(r).toEqual({ id: 'new' });
  });

  it('updateCliente delega para update sem arquivo', async () => {
    update.mockResolvedValue({ id: '1' });
    getOne.mockResolvedValue({ id: '1' });
    await updateCliente('1', { nome_fantasia: 'Y' } as any);
    expect(update).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ nome_fantasia: 'Y', updated_by: 'u1' }),
    );
  });

  it('updateCliente com REMOVER_LOGO envia FormData com logo vazio', async () => {
    update.mockResolvedValue({ id: '1' });
    getOne.mockResolvedValue({ id: '1' });
    await updateCliente('1', { nome_fantasia: 'Y' } as any, REMOVER_LOGO);
    const [, corpo] = update.mock.calls[0] as [string, FormData];
    expect(corpo).toBeInstanceOf(FormData);
    expect(corpo.get('logo')).toBe('');
    expect(corpo.get('nome_fantasia')).toBe('Y');
  });

  it('deleteCliente delega para delete', async () => {
    del.mockResolvedValue(true);
    await deleteCliente('1');
    expect(del).toHaveBeenCalledWith('1');
  });
});
