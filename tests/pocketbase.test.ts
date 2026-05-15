import { describe, it, expect } from 'vitest';
import { pb } from '@/lib/pocketbase';

describe('pocketbase client', () => {
  it('expõe um singleton com baseURL configurada', () => {
    expect(pb).toBeDefined();
    expect(pb.baseURL).toBe('https://api.wenox.com.br');
  });

  it('retorna a mesma instância em imports repetidos', async () => {
    const mod = await import('@/lib/pocketbase');
    expect(mod.pb).toBe(pb);
  });
});
