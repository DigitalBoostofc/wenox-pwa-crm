import { afterEach, describe, expect, it, vi } from 'vitest';
import { colWidth, MIN_COL_WIDTH, startColumnResize } from '@/lib/columnResize';

describe('colWidth', () => {
  const padrao = { a: 120, b: 200 } as const;

  it('usa override do usuário quando existe', () => {
    expect(colWidth('a', { a: 300 }, padrao)).toBe(300);
  });

  it('cai no default quando não há override', () => {
    expect(colWidth('b', {}, padrao)).toBe(200);
  });

  it('ignora override inválido e usa mínimo', () => {
    expect(colWidth('a', { a: 0 }, padrao)).toBe(MIN_COL_WIDTH);
    expect(colWidth('a', { a: -10 }, padrao)).toBe(MIN_COL_WIDTH);
  });
});

describe('startColumnResize', () => {
  afterEach(() => {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  it('calcula a partir da largura lógica (não do DOM) e respeita o mínimo', () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();

    startColumnResize({
      startWidth: 150,
      clientX: 100,
      onMove,
      onEnd,
    });

    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');

    // +40px → 190
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 140 }));
    // flush rAF
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        expect(onMove).toHaveBeenCalledWith(190);

        // arrasta pra trás além do mínimo
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 }));
        requestAnimationFrame(() => {
          // 150 + (0-100) = 50 → clamp 80
          const lastMove = onMove.mock.calls.at(-1)?.[0];
          expect(lastMove).toBe(MIN_COL_WIDTH);

          document.dispatchEvent(new MouseEvent('mouseup', { clientX: 0 }));
          expect(onEnd).toHaveBeenCalledWith(MIN_COL_WIDTH);
          expect(document.body.style.cursor).toBe('');
          expect(document.body.style.userSelect).toBe('');
          resolve();
        });
      });
    });
  });
});
