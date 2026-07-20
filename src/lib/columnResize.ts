/**
 * Redimensionamento de colunas estável (estilo Notion).
 *
 * Regras:
 * - A base do arraste é a largura LÓGICA (state/default), nunca getBoundingClientRect —
 *   com table-layout:fixed + tabela esticada, a largura renderizada ≠ a salva e o
 *   drag "pula" / reflowa as vizinhas.
 * - onMove é throttled via rAF (evita re-render a cada pixel).
 * - Persistência (localStorage) deve ir em onEnd, não em onMove.
 */

export const MIN_COL_WIDTH = 80;

export function startColumnResize(opts: {
  /** Largura lógica atual da coluna (px), do state ou default. */
  startWidth: number;
  clientX: number;
  min?: number;
  onMove: (width: number) => void;
  onEnd?: (width: number) => void;
}): void {
  const { startWidth, clientX, min = MIN_COL_WIDTH, onMove, onEnd } = opts;
  let last = Math.max(min, Math.round(startWidth));
  let raf = 0;

  const prevCursor = document.body.style.cursor;
  const prevSelect = document.body.style.userSelect;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  function onMouseMove(ev: MouseEvent) {
    last = Math.max(min, Math.round(startWidth + (ev.clientX - clientX)));
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      onMove(last);
    });
  }

  function onMouseUp() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = prevCursor;
    document.body.style.userSelect = prevSelect;
    // Garante o valor final (se o último move ficou só no rAF pendente).
    onMove(last);
    onEnd?.(last);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

/** Largura efetiva: override do usuário ou default da coluna. */
export function colWidth<K extends string>(
  key: K,
  larguras: Partial<Record<K, number>>,
  padrao: Record<K, number>,
): number {
  const w = larguras[key] ?? padrao[key];
  return typeof w === 'number' && w > 0 ? w : MIN_COL_WIDTH;
}
