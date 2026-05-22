import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Tarefa } from './types';
import { TarefaForm } from './TarefaForm';
import { responsaveisTarefa } from './TarefaCard';
import { statusTarefaClass, prazoVencido, LADO_LABEL } from './format';
import { dataBR } from '@/clientes/format';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ColKey = 'nome' | 'projeto' | 'lado' | 'resp' | 'status' | 'prazo';

const COLS: Record<'global' | 'projeto', ColKey[]> = {
  global: ['nome', 'projeto', 'lado', 'resp', 'status', 'prazo'],
  projeto: ['nome', 'status', 'prazo', 'resp'],
};
const LABEL: Record<ColKey, string> = {
  nome: 'Tarefa', projeto: 'Projeto', lado: 'Lado',
  resp: 'Responsáveis', status: 'Status', prazo: 'Prazo',
};

/** Tabela de tarefas com cadastro inline: a linha "+ Nova tarefa" expande
 *  o formulário completo logo abaixo, sem sair da lista. Clicar numa
 *  tarefa abre a página dela. */
export function TabelaTarefas({
  tarefas, contexto = 'global', onAbrir, onCriado, presetProjeto, presetCliente,
}: {
  tarefas: Tarefa[];
  contexto?: 'global' | 'projeto';
  onAbrir: (id: string) => void;
  onCriado: () => void;
  presetProjeto?: string;
  presetCliente?: string;
}) {
  const cols = COLS[contexto];
  const [criando, setCriando] = useState(false);

  function celula(t: Tarefa, key: ColKey) {
    if (key === 'nome') return <span className="font-medium">{t.nome}</span>;
    if (key === 'projeto') {
      return t.expand?.projeto?.nome
        ? <span className="text-muted-foreground">{t.expand.projeto.nome}</span>
        : <span className="italic text-muted-foreground">Interna</span>;
    }
    if (key === 'lado') {
      return <span className="text-muted-foreground">{t.lado ? LADO_LABEL[t.lado] : '—'}</span>;
    }
    if (key === 'resp') {
      const r = responsaveisTarefa(t);
      return (
        <span className="text-muted-foreground">
          {r.length ? r.map((x) => x.nome).join(', ') : '—'}
        </span>
      );
    }
    if (key === 'status') {
      return t.status ? (
        <Badge className={cn('border text-[10px]', statusTarefaClass(t.status))}>
          {t.status}
        </Badge>
      ) : <span className="text-muted-foreground">—</span>;
    }
    const vencida = prazoVencido(t.prazo, t.status);
    return (
      <span className={vencida ? 'font-medium text-destructive' : 'text-muted-foreground'}>
        {dataBR(t.prazo) || '—'}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              {cols.map((c) => (
                <th key={c} className="px-4 py-3 font-medium">{LABEL[c]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tarefas.map((t) => (
              <tr
                key={t.id}
                onClick={() => onAbrir(t.id)}
                className="cursor-pointer border-b border-border transition-colors hover:bg-secondary/50"
              >
                {cols.map((c) => (
                  <td key={c} className="px-4 py-3">{celula(t, c)}</td>
                ))}
              </tr>
            ))}

            {tarefas.length === 0 && !criando && (
              <tr>
                <td colSpan={cols.length} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma tarefa ainda.
                </td>
              </tr>
            )}

            {!criando && (
              <tr>
                <td colSpan={cols.length} className="p-0">
                  <button
                    type="button"
                    onClick={() => setCriando(true)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                  >
                    <Plus className="size-4" /> Nova tarefa
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Painel de cadastro — formulário completo, expandido na lista. */}
      {criando && (
        <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4">
          <p className="mb-3 text-sm font-semibold text-primary">Nova tarefa</p>
          <TarefaForm
            presetProjeto={presetProjeto}
            presetCliente={presetCliente}
            onSalvo={() => { setCriando(false); onCriado(); }}
            onCancelar={() => setCriando(false)}
          />
        </div>
      )}
    </div>
  );
}
