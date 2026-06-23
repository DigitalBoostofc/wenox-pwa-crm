/**
 * Testes unitários do predicado ehCartaoPost (src/quadros/types.ts).
 *
 * Regra: cartão é considerado um POST gerado se tiver data_post OU etapas_card
 * não-vazia. Cartões adicionados manualmente nascem sem nenhum dos dois.
 */
import { describe, it, expect } from 'vitest';
import { ehCartaoPost } from '@/quadros/types';

describe('ehCartaoPost — predicado puro', () => {
  it('cartão com data_post → true', () => {
    expect(ehCartaoPost({ data_post: '2025-07-01 10:00:00' })).toBe(true);
  });

  it('cartão com etapas_card não-vazia (sem data_post) → true', () => {
    expect(
      ehCartaoPost({
        etapas_card: [{ id: 'e1', texto: 'Copy', tipo: 'interna', feito: false }],
      }),
    ).toBe(true);
  });

  it('cartão sem data_post e etapas_card vazia → false (cartão manual)', () => {
    expect(ehCartaoPost({ etapas_card: [] })).toBe(false);
  });

  it('cartão totalmente vazio (sem campos) → false', () => {
    expect(ehCartaoPost({})).toBe(false);
  });
});
