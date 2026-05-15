import { describe, it, expect, vi, beforeEach } from 'vitest';
const { getList, create, del } = vi.hoisted(() => ({ getList: vi.fn(), create: vi.fn(), del: vi.fn() }));
vi.mock('@/lib/pocketbase', () => ({ pb: { collection: () => ({ getList, create, delete: del }) } }));
import { listEquipe, addMembro, removeMembro } from '@/equipe/equipeService';

describe('equipeService', () => {
  beforeEach(() => vi.clearAllMocks());
  it('listEquipe filtra por cliente e expande usuario', async () => {
    getList.mockResolvedValue({ items: [{ id: 'e1' }] });
    const r = await listEquipe('c1');
    expect(getList).toHaveBeenCalledWith(1, 200, expect.objectContaining({
      filter: 'cliente = "c1"', expand: 'usuario',
    }));
    expect(r).toEqual([{ id: 'e1' }]);
  });
  it('addMembro cria vinculo', async () => {
    create.mockResolvedValue({ id: 'e' });
    await addMembro('c1', 'u1', 'Trafego');
    expect(create).toHaveBeenCalledWith({ cliente: 'c1', usuario: 'u1', area: 'Trafego', status: 'Ativo' });
  });
  it('removeMembro deleta', async () => {
    del.mockResolvedValue(true);
    await removeMembro('e1');
    expect(del).toHaveBeenCalledWith('e1');
  });
});
