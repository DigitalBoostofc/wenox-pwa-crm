import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Tarefa } from './types';
import type { Opcao } from '@/opcoes/types';
import { responsaveisTarefa } from './TarefaCard';
import { statusTarefaClass, prazoVencido, LADO_LABEL } from './format';
import { dataBR } from '@/clientes/format';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface NovaTarefaInline {
  nome: string;
  status: string;
  prazo: string;
}

type ColKey = 'nome' | 'projeto' | 'lado' | 'resp' | 'status' | 'prazo';

const COLS: Record<'global' | 'projeto', ColKey[]> = {
  global: ['nome', 'projeto', 'lado', 'resp', 'status', 'prazo'],
  projeto: ['nome', 'status', 'prazo', 'resp'],
};
const LABEL: Record<ColKey, string> = {
  nome: 'Tarefa', projeto: 'Projeto', lado: 'Lado',
  resp: 'Responsáveis', status: 'Status', prazo: 'Prazo',
};

const inputCls =
  'h-8 w-full rounded-md border border-input bg-background/40 px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

/** Tabela de tarefas com cadastro inline (estilo Notion): a última linha
 *  cria uma tarefa nova ali mesmo; clicar numa linha abre a tarefa. */
export function TabelaTarefas({
  tarefas, statuses, contexto = 'global', onAbrir, onCriar,
}: {
  tarefas: Tarefa[];
  statuses: Opcao[];
  contexto?: 'global' | 'projeto';
  onAbrir: (id: string) => void;
  onCriar: (d: NovaTarefaInline) => Promise<void>;
}) {
  const cols = COLS[contexto];
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [status, setStatus] = useState('');
  const [prazo, setPrazo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const statusEscolhido = status || statuses[0]?.valor || '';

  async function salvar() {
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    try {
      await onCriar({ nome: nome.trim(), status: statusEscolhido, prazo });
      // Mantém a linha aberta pra cadastrar a próxima (estilo Notion).
      setNome('');
      setPrazo('');
    } finally {
      setSalvando(false);
    }
  }

  function fechar() {
    setCriando(false);
    setNome(''); setPrazo(''); setStatus('');
  }

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
    // prazo
    const vencida = prazoVencido(t.prazo, t.status);
    return (
      <span className={vencida ? 'font-medium text-destructive' : 'text-muted-foreground'}>
        {dataBR(t.prazo) || '—'}
      </span>
    );
  }

  function celulaEdicao(key: ColKey) {
    if (key === 'nome') {
      return (
        <input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); salvar(); }
            if (e.key === 'Escape') fechar();
          }}
          placeholder="Nome da tarefa — Enter pra salvar"
          className={inputCls}
        />
      );
    }
    if (key === 'status') {
      return (
        <select
          value={statusEscolhido}
          onChange={(e) => setStatus(e.target.value)}
          className={inputCls}
        >
          {statuses.map((s) => (
            <option key={s.id} value={s.valor}>{s.valor}</option>
          ))}
        </select>
      );
    }
    if (key === 'prazo') {
      return (
        <input
          type="date"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
          className={cn(inputCls, '[color-scheme:dark]')}
        />
      );
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
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

          {/* Linha de cadastro inline */}
          {criando ? (
            <tr className="border-b border-border bg-secondary/40">
              {cols.map((c) => (
                <td key={c} className="px-3 py-2 align-middle">{celulaEdicao(c)}</td>
              ))}
            </tr>
          ) : (
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

      {criando && (
        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span>Enter pra salvar · Esc pra fechar</span>
          {salvando && <span className="text-primary">Salvando…</span>}
          <button
            type="button"
            onClick={fechar}
            className="ml-auto flex items-center gap-1 hover:text-foreground"
          >
            <X className="size-3.5" /> Fechar
          </button>
        </div>
      )}
    </Card>
  );
}
