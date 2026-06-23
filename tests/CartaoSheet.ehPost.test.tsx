/**
 * Testes de componente CartaoSheet — prop ehPost controla qual editor aparece.
 *
 * - ehPost=true  → seção "Post" (inclui "Tipo de post" e "Esteira de produção"
 *                  quando etapas_card não-vazia); seção "Descrição" NÃO aparece.
 * - ehPost=false → seção "Descrição" aparece; "Tipo de post" / "Esteira de
 *                  produção" NÃO aparecem.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

/* ---- mocks de infraestrutura ---- */

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    files: { getURL: () => '' },
    collection: () => ({}),
    filter: () => '',
    authStore: { record: { id: 'u1', nome: 'Usuário Teste' } },
  },
}));

vi.mock('@/dashboard/AvatarMembro', () => ({
  AvatarMembro: () => null,
}));

vi.mock('@/quadros/Markdown', () => ({
  Markdown: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/quadros/PreviewPost', () => ({
  PreviewPost: () => null,
}));

/* ---- mocks dos serviços (hoisted para uso nos testes) ---- */

const { getCartaoMock, listComentariosMock } = vi.hoisted(() => ({
  getCartaoMock: vi.fn(),
  listComentariosMock: vi.fn(),
}));

vi.mock('@/quadros/quadrosService', () => ({
  getCartao: getCartaoMock,
  atualizarCartao: vi.fn().mockResolvedValue(undefined),
  removerCartao: vi.fn(),
  arquivarCartao: vi.fn(),
  subirAnexosMedia: vi.fn(),
  urlUpload: '',
  listCartoes: vi.fn().mockResolvedValue([]),
  listComentariosCartao: listComentariosMock,
  addComentarioCartao: vi.fn(),
  removerComentarioCartao: vi.fn(),
  confirmarEtapaCard: vi.fn(),
  getOuCriarReviewToken: vi.fn(),
  registrarAtividadeCartao: vi.fn(),
  ehAtividade: () => false,
  textoAtividade: () => '',
  ATIV_MARK: '§',
}));

vi.mock('@/usuarios/usuariosService', () => ({
  listUsuarios: vi.fn().mockResolvedValue([]),
}));

import { CartaoSheet } from '@/quadros/CartaoSheet';

/* ---- fixtures ---- */

const CARTAO_POST = {
  id: 'c1',
  quadro: 'q1',
  lista: 'l1',
  nome: 'Post de Julho',
  data_post: '2025-07-01 10:00:00',
  etapas_card: [
    { id: 'e1', texto: 'Copy', tipo: 'interna' as const, feito: false },
    { id: 'e2', texto: 'Layout', tipo: 'interna' as const, feito: false },
    { id: 'e3', texto: 'Revisão interna', tipo: 'interna' as const, feito: false },
    { id: 'e4', texto: 'Aprovação do cliente', tipo: 'aprovacao_cliente' as const, feito: false },
    { id: 'e5', texto: 'Confirmação de agendamento', tipo: 'interna' as const, feito: false },
  ],
};

const CARTAO_MANUAL = {
  id: 'c2',
  quadro: 'q1',
  lista: 'l1',
  nome: 'Tarefa manual',
  descricao: 'Uma descrição de teste qualquer',
};

/* ---- suíte ---- */

describe('CartaoSheet — ehPost controla qual editor aparece', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listComentariosMock.mockResolvedValue([]);
  });

  it('ehPost=true: mostra "Tipo de post" e "Esteira de produção"; NÃO mostra seção "Descrição"', async () => {
    getCartaoMock.mockResolvedValue(CARTAO_POST);

    render(
      <CartaoSheet
        cartaoId="c1"
        aberto={true}
        ehPost={true}
        onClose={() => {}}
      />,
    );

    // Aguarda o card carregar (getCartao resolve e a UI atualiza)
    await screen.findByText('Tipo de post');

    expect(screen.getByText('Esteira de produção')).toBeInTheDocument();

    // Seção de descrição padrão NÃO deve aparecer em posts
    expect(screen.queryByText('Descrição')).not.toBeInTheDocument();
  });

  it('ehPost=false: mostra seção "Descrição"; NÃO mostra "Tipo de post" nem "Esteira de produção"', async () => {
    getCartaoMock.mockResolvedValue(CARTAO_MANUAL);

    render(
      <CartaoSheet
        cartaoId="c2"
        aberto={true}
        ehPost={false}
        onClose={() => {}}
      />,
    );

    // Aguarda o card carregar
    await screen.findByText('Descrição');

    expect(screen.queryByText('Tipo de post')).not.toBeInTheDocument();
    expect(screen.queryByText('Esteira de produção')).not.toBeInTheDocument();
  });
});
