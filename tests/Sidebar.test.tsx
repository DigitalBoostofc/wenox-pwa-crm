import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// SidebarNav usa useAuth — mockado para rodar sem <AuthProvider>.
vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'owner@wenox.com.br', role: 'Owner' } }),
}));

import { SidebarNav } from '@/components/layout/Sidebar';
import { NAV_ITEMS } from '@/components/layout/nav';

describe('SidebarNav', () => {
  it('renderiza os 11 módulos do Wenox OS', () => {
    render(
      <MemoryRouter initialEntries={['/clientes']}>
        <SidebarNav />
      </MemoryRouter>,
    );
    expect(NAV_ITEMS).toHaveLength(11);
    for (const item of NAV_ITEMS) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    }
  });

  it('Clientes é um link navegável; módulos futuros não', () => {
    render(
      <MemoryRouter initialEntries={['/clientes']}>
        <SidebarNav />
      </MemoryRouter>,
    );
    const clientes = screen.getByText('Clientes').closest('a');
    expect(clientes).toHaveAttribute('href', '/clientes');
    // Financeiro é módulo futuro: não deve ser <a>
    expect(screen.getByText('Financeiro').closest('a')).toBeNull();
  });
});
