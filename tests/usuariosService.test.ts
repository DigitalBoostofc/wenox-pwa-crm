import { describe, it, expect, vi, beforeEach } from 'vitest';
const { getList, create, update } = vi.hoisted(() => ({ getList: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/pocketbase', () => ({ pb: { collection: () => ({ getList, create, update }) } }));
import { listUsuarios, criarUsuario, atualizarUsuario } from '@/usuarios/usuariosService';

describe('usuariosService', () => {
  beforeEach(() => vi.clearAllMocks());
  it('listUsuarios retorna items ordenados por nome', async () => {
    getList.mockResolvedValue({ items: [{ id: '1', nome: 'A' }] });
    const r = await listUsuarios();
    expect(getList).toHaveBeenCalledWith(1, 200, { sort: 'nome' });
    expect(r).toEqual([{ id: '1', nome: 'A' }]);
  });
  it('criarUsuario envia passwordConfirm igual', async () => {
    create.mockResolvedValue({ id: 'u' });
    await criarUsuario({ email: 'a@a.com', nome: 'A', role: 'Membro', status: 'Ativo' } as never, 'secret123');
    const arg = create.mock.calls[0][0];
    expect(arg.password).toBe('secret123');
    expect(arg.passwordConfirm).toBe('secret123');
  });
  it('atualizarUsuario delega update', async () => {
    update.mockResolvedValue({ id: '1' });
    await atualizarUsuario('1', { status: 'Inativo' });
    expect(update).toHaveBeenCalledWith('1', { status: 'Inativo' });
  });
});
