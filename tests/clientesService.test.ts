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
  },
}));

import { listClientes, getCliente, createCliente, updateCliente, deleteCliente } from '@/clientes/clientesService';

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

  it('listClientes sem busca não envia filtro de texto', async () => {
    getList.mockResolvedValue({ items: [] });
    await listClientes('');
    expect(getList).toHaveBeenCalledWith(1, 200, expect.objectContaining({
      sort: '-created',
      fields: expect.stringContaining('logo'),
    }));
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

  it('updateCliente delega para update', async () => {
    update.mockResolvedValue({ id: '1' });
    await updateCliente('1', { nome_fantasia: 'Y' } as any);
    expect(update).toHaveBeenCalledWith('1', { nome_fantasia: 'Y' });
  });

  it('deleteCliente delega para delete', async () => {
    del.mockResolvedValue(true);
    await deleteCliente('1');
    expect(del).toHaveBeenCalledWith('1');
  });
});
