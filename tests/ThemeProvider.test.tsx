import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '@/components/layout/ThemeProvider';

function Probe() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle}>tema:{theme}</button>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('aplica dark por padrão', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByRole('button')).toHaveTextContent('tema:dark');
  });

  it('alterna para light e persiste', async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('wenox-theme')).toBe('light');
  });
});
