/**
 * Helpers da relação projeto ↔ tarefa, guiada pelo TIPO (área).
 * Usados no formulário (TarefaSheet) e na edição inline da tabela (TarefasTabela).
 * Regra: uma tarefa de um tipo (ex.: Social Media) se liga a projetos do MESMO
 * tipo; o cliente só aparece se tiver projeto daquele tipo; o projeto "ativo"
 * é pré-selecionado.
 */
import type { Projeto } from './types';

/** Status considerados "encerrados" — não são o projeto ativo padrão. */
const STATUS_ENCERRADO = new Set(['Inativo', 'Offboarding', 'Concluído', 'Concluido']);

/** Projeto está ativo (não encerrado)? */
export function projetoAtivo(p: Projeto): boolean {
  return !STATUS_ENCERRADO.has((p.status ?? '').trim());
}

/** IDs de clientes que têm ao menos um projeto do tipo (se tipo vazio, qualquer projeto). */
export function clientesComProjetoDoTipo(projetos: Projeto[], tipo?: string): Set<string> {
  const s = new Set<string>();
  for (const p of projetos) {
    if (!p.cliente) continue;
    if (!tipo || p.tipo === tipo) s.add(p.cliente);
  }
  return s;
}

/** Projetos de um cliente naquele tipo (ativos primeiro, depois por nome). */
export function projetosDoClienteTipo(projetos: Projeto[], clienteId: string, tipo?: string): Projeto[] {
  return projetos
    .filter((p) => p.cliente === clienteId && (!tipo || p.tipo === tipo))
    .sort((a, b) => {
      const aa = projetoAtivo(a) ? 0 : 1;
      const ab = projetoAtivo(b) ? 0 : 1;
      if (aa !== ab) return aa - ab;
      return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' });
    });
}

/** Projeto padrão (1º ativo; senão o 1º) de um cliente naquele tipo — '' se não houver. */
export function projetoPadraoDoCliente(projetos: Projeto[], clienteId: string, tipo?: string): string {
  const cands = projetosDoClienteTipo(projetos, clienteId, tipo);
  return cands[0]?.id ?? '';
}
