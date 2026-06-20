/**
 * R3.a — EtapasStepper: renderiza estados com etapas (atual destacada),
 * sem etapas (1 segmento), etapa vencida e aprovacao_cliente.
 * Queries via role/aria-label (Testing Library).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/pocketbase', () => ({
  pb: {
    files: { getURL: () => '' },
    collection: () => ({}),
    authStore: { record: null },
  },
}));

import { EtapasStepper } from '@/tarefas/EtapasStepper';
import type { EtapaTarefa } from '@/tarefas/types';
import type { MembroAvatar } from '@/dashboard/AvatarMembro';

const resp: MembroAvatar = { id: 'u1', nome: 'Ana Beatriz' };

function etapaInterna(id: string, texto: string, feito = false, prazo?: string): EtapaTarefa {
  return { id, texto, tipo: 'interna', feito, responsavel: 'u1', prazo };
}

function etapaAprovacao(id: string, feito = false): EtapaTarefa {
  return { id, texto: 'Aprovação do cliente', tipo: 'aprovacao_cliente', feito };
}

describe('EtapasStepper — com etapas (variant=compact)', () => {
  it('renderiza lista com aria-label de progresso', () => {
    const etapas = [
      etapaInterna('e1', 'Criar layout', true),
      etapaInterna('e2', 'Revisar cores'),
      etapaInterna('e3', 'Exportar'),
    ];
    render(<EtapasStepper etapas={etapas} responsaveis={[resp]} variant="compact" />);

    const lista = screen.getByRole('list', { name: /etapas: 1 de 3 concluídas/i });
    expect(lista).toBeInTheDocument();
  });

  it('a etapa atual tem aria-current="step" no dot e aria-label descritivo', () => {
    const etapas = [
      etapaInterna('e1', 'Passo 1', true),
      etapaInterna('e2', 'Passo 2'),
    ];
    const { container } = render(
      <EtapasStepper etapas={etapas} responsaveis={[resp]} variant="compact" />,
    );

    // No modo compact, aria-current está no <div> interno ao <li>
    const atual = container.querySelector('[aria-current="step"]');
    expect(atual).not.toBeNull();
    expect(atual).toHaveAttribute('aria-label', expect.stringContaining('Etapa atual: Passo 2'));
  });

  it('etapas concluídas têm aria-label "Concluída: ..."', () => {
    const etapas = [
      etapaInterna('e1', 'Passo 1', true),
      etapaInterna('e2', 'Passo 2'),
    ];
    const { container } = render(
      <EtapasStepper etapas={etapas} responsaveis={[resp]} variant="compact" />,
    );

    const concluidaDot = container.querySelector('[aria-label^="Concluída:"]');
    expect(concluidaDot).not.toBeNull();
    expect(concluidaDot?.getAttribute('aria-label')).toContain('Passo 1');
  });

  it('exibe texto da etapa atual', () => {
    const etapas = [
      etapaInterna('e1', 'Criar wireframe'),
    ];
    render(<EtapasStepper etapas={etapas} responsaveis={[resp]} variant="compact" />);

    expect(screen.getByText('Criar wireframe')).toBeInTheDocument();
  });
});

describe('EtapasStepper — sem etapas (1 segmento)', () => {
  it('renderiza com aria-label "Tarefa: 1 etapa"', () => {
    render(
      <EtapasStepper
        etapas={[]}
        responsaveis={[resp]}
        variant="compact"
        status="Em andamento"
      />,
    );
    const lista = screen.getByRole('list', { name: /tarefa: 1 etapa/i });
    expect(lista).toBeInTheDocument();
  });

  it('mostra o texto do status quando status está definido', () => {
    render(
      <EtapasStepper
        etapas={undefined}
        responsaveis={[]}
        variant="compact"
        status="Aguardando aprovação"
      />,
    );
    expect(screen.getByText('Aguardando aprovação')).toBeInTheDocument();
  });

  it('ponto único tem li com aria-current="step"', () => {
    const { container } = render(
      <EtapasStepper
        etapas={[]}
        responsaveis={[]}
        variant="compact"
        status="Em andamento"
      />,
    );
    // StepperSemEtapas: aria-current="step" está diretamente no <li>
    const li = container.querySelector('li[aria-current="step"]');
    expect(li).not.toBeNull();
  });

  it('variant=full exibe "Sem responsável" quando nenhum responsavel passado', () => {
    render(
      <EtapasStepper
        etapas={[]}
        responsaveis={[]}
        variant="full"
        status="Não iniciado"
      />,
    );
    expect(screen.getByText(/sem responsável/i)).toBeInTheDocument();
  });
});

describe('EtapasStepper — etapa de aprovacao_cliente', () => {
  it('compact: mostra "Aprovação do cliente" em texto', () => {
    const etapas = [
      etapaInterna('e1', 'Criar layout', true),
      etapaAprovacao('e2'),
    ];
    render(<EtapasStepper etapas={etapas} responsaveis={[resp]} variant="compact" />);

    expect(screen.getByText(/aprovação do cliente/i)).toBeInTheDocument();
  });

  it('full: mostra "Aprovação do cliente" como subtítulo', () => {
    const etapas = [
      etapaInterna('e1', 'Criar layout', true),
      etapaAprovacao('e2'),
    ];
    render(<EtapasStepper etapas={etapas} responsaveis={[]} variant="full" />);

    expect(screen.getAllByText(/aprovação do cliente/i).length).toBeGreaterThan(0);
  });
});

describe('EtapasStepper — etapa vencida', () => {
  it('compact: exibe data vencida quando etapa tem prazo passado e ainda não feita', () => {
    const etapas = [etapaInterna('e1', 'Urgente', false, '2020-01-01')];
    render(<EtapasStepper etapas={etapas} responsaveis={[resp]} variant="compact" />);

    // A data deve aparecer (prazoBR retorna no formato BR)
    const prazoEl = screen.getByText(/jan|2020/i);
    expect(prazoEl).toBeInTheDocument();
  });
});

describe('EtapasStepper — todas concluídas (compact)', () => {
  it('exibe "Concluído" quando todas as etapas estão feitas', () => {
    const etapas = [
      etapaInterna('e1', 'P1', true),
      etapaInterna('e2', 'P2', true),
    ];
    render(<EtapasStepper etapas={etapas} responsaveis={[resp]} variant="compact" />);

    expect(screen.getByText(/concluído/i)).toBeInTheDocument();
  });
});

describe('EtapasStepper — variant=full lista vertical', () => {
  it('renderiza uma lista com aria-label de progresso', () => {
    const etapas = [
      etapaInterna('e1', 'Etapa A', true),
      etapaInterna('e2', 'Etapa B'),
    ];
    render(<EtapasStepper etapas={etapas} responsaveis={[resp]} variant="full" />);

    const lista = screen.getByRole('list', { name: /etapas: 1 de 2 concluídas/i });
    expect(lista).toBeInTheDocument();
  });

  it('full: item atual tem aria-current="step" na li', () => {
    const etapas = [
      etapaInterna('e1', 'Feita', true),
      etapaInterna('e2', 'Atual'),
    ];
    render(<EtapasStepper etapas={etapas} responsaveis={[resp]} variant="full" />);

    // Na variante full, aria-current fica na <li>
    const liAtual = screen.getByRole('listitem', { current: 'step' });
    expect(liAtual).toBeInTheDocument();
    expect(liAtual).toHaveTextContent('Atual');
  });
});
