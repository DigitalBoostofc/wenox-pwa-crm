/**
 * TarefasTabela — coluna STATUS.
 * Cobre os 6 cenários da lógica de exibição de etapa na coluna "status":
 *  1. Sem etapas → badge genérico de status
 *  2. Etapa 1 interna com responsável → "Etapa 1/5 · texto · primeiroNome"
 *  3. Etapas parcialmente feitas → "Etapa 2/5 · texto · primeiroNome"
 *  4. Todas as etapas feitas → "Concluído"
 *  5. Etapa atual é aprovacao_cliente → "Etapa n/total · Aprovação do cliente" (sem nome)
 *  6. Etapa interna sem responsável resolvido → "Etapa n/total · texto" (sem nome)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tarefa, EtapaTarefa } from '@/tarefas/types';

/* ── Mocks (hoisted pelo vitest) ─────────────────────────────────────────── */

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    files: { getURL: () => '' },
    collection: () => ({}),
    authStore: { record: null },
  },
}));

vi.mock('@/tarefas/tarefasService', () => ({
  atualizarTarefa: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/atividade/atividadeService', () => ({
  addComentario: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/clientes/clientesService', () => ({
  logoUrl: () => '',
}));

// EtapasStepper é usado só na coluna etapa_atual (oculta por padrão) —
// mock evita renders desnecessários em colunas fora do escopo.
vi.mock('@/tarefas/EtapasStepper', () => ({
  EtapasStepper: () => null,
}));

import { TarefasTabela } from '@/tarefas/TarefasTabela';

/* ── Factories ───────────────────────────────────────────────────────────── */

function etapaInterna(id: string, texto: string, feito = false, responsavel?: string): EtapaTarefa {
  return { id, tipo: 'interna', texto, feito, ...(responsavel ? { responsavel } : {}) };
}

function etapaAprovacao(id: string, feito = false): EtapaTarefa {
  return { id, tipo: 'aprovacao_cliente', texto: 'Aprovação do cliente', feito };
}

function makeTarefa(overrides: Partial<Tarefa> = {}): Tarefa {
  return { id: 't1', nome: 'Tarefa Teste', status: 'Em andamento', ...overrides };
}

function renderTabela(tarefa: Tarefa) {
  render(
    <TarefasTabela
      tarefas={[tarefa]}
      onAbrir={vi.fn()}
      persistPrefix="test-status"
    />,
  );
}

/* ── Testes ──────────────────────────────────────────────────────────────── */

describe('TarefasTabela — coluna STATUS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // localStorage limpo → carregarColunas retorna COLS_PADRAO com status visível
    localStorage.clear();
  });

  it('1. sem etapas → badge "Em andamento" (caminho antigo preservado)', () => {
    renderTabela(makeTarefa({ etapas: [] }));

    // Badge de status presente como span (Badge renderiza <span>)
    const badgeMatches = screen.queryAllByText('Em andamento');
    expect(badgeMatches.some((el) => el.tagName === 'SPAN')).toBe(true);

    // Nenhum texto no formato etapa renderizado
    expect(screen.queryAllByText(/^Etapa \d+\/\d+/).length).toBe(0);
  });

  it('2. etapa 1/5 interna "Copy" com responsável Paula → "Etapa 1/5 · Copy · Paula"', () => {
    const t = makeTarefa({
      etapas: [
        etapaInterna('e1', 'Copy', false, 'u1'),
        etapaInterna('e2', 'Layout', false, 'u2'),
        etapaInterna('e3', 'Revisão', false, 'u2'),
        etapaAprovacao('e4'),
        etapaInterna('e5', 'Publicar', false, 'u2'),
      ],
      expand: {
        responsaveis: [
          { id: 'u1', nome: 'Paula Rodrigues' },
          { id: 'u2', nome: 'João Silva' },
        ],
      },
    });
    renderTabela(t);

    // O span tem title={txt} — seletor preciso para a célula de status
    const span = screen.getByTitle('Etapa 1/5 · Copy · Paula');
    expect(span).toBeInTheDocument();
    expect(span.textContent).toBe('Etapa 1/5 · Copy · Paula');
  });

  it('3. etapa 1 feita, etapa 2/5 "Layout" atual → "Etapa 2/5 · Layout · João"', () => {
    const t = makeTarefa({
      etapas: [
        etapaInterna('e1', 'Copy', true, 'u1'),
        etapaInterna('e2', 'Layout', false, 'u2'),
        etapaInterna('e3', 'Revisão', false, 'u2'),
        etapaAprovacao('e4'),
        etapaInterna('e5', 'Publicar', false, 'u2'),
      ],
      expand: {
        responsaveis: [
          { id: 'u1', nome: 'Paula Rodrigues' },
          { id: 'u2', nome: 'João Silva' },
        ],
      },
    });
    renderTabela(t);

    const span = screen.getByTitle('Etapa 2/5 · Layout · João');
    expect(span).toBeInTheDocument();
    expect(span.textContent).toBe('Etapa 2/5 · Layout · João');
  });

  it('4. todas as etapas feitas → "Concluído"', () => {
    const t = makeTarefa({
      // status ≠ "Concluído" → tarefa fica no grupo abertas (visível por padrão)
      status: 'Em andamento',
      etapas: [
        etapaInterna('e1', 'Copy', true, 'u1'),
        etapaInterna('e2', 'Layout', true, 'u1'),
      ],
      expand: {
        responsaveis: [{ id: 'u1', nome: 'Paula Rodrigues' }],
      },
    });
    renderTabela(t);

    // O span de "Concluído" da célula de status (não a <option> do select de filtro)
    const matches = screen.queryAllByText('Concluído');
    expect(matches.some((el) => el.tagName === 'SPAN')).toBe(true);
    // Não aparece texto no formato "Etapa n/m"
    expect(screen.queryAllByText(/^Etapa \d+\/\d+/).length).toBe(0);
  });

  it('5. etapa atual tipo aprovacao_cliente → "Aprovação do cliente" sem nome de responsável', () => {
    const t = makeTarefa({
      etapas: [
        etapaInterna('e1', 'Copy', true, 'u1'),
        etapaAprovacao('e2'),
        etapaInterna('e3', 'Layout', false, 'u1'),
      ],
      expand: {
        responsaveis: [{ id: 'u1', nome: 'Paula Rodrigues' }],
      },
    });
    renderTabela(t);

    const span = screen.getByTitle('Etapa 2/3 · Aprovação do cliente');
    expect(span).toBeInTheDocument();
    expect(span.textContent).toContain('Aprovação do cliente');
    // O nome da responsável NÃO deve aparecer no texto da célula de status
    expect(span.textContent).not.toContain('Paula');
  });

  it('6. etapa interna sem responsável resolvido → "Etapa n/total · texto" (sem nome)', () => {
    const t = makeTarefa({
      etapas: [etapaInterna('e1', 'Design', false, 'u999')], // u999 não está no expand
      expand: { responsaveis: [] },
    });
    renderTabela(t);

    const span = screen.getByTitle('Etapa 1/1 · Design');
    expect(span).toBeInTheDocument();
    expect(span.textContent).toBe('Etapa 1/1 · Design');
  });
});
