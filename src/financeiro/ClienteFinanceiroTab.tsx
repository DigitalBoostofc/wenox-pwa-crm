import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePodeEscreverFin } from './usePodeEscreverFin';
import {
  brl,
  STATUS_LABEL,
  hojeISO,
  type FinCategoria,
  type FinConta,
  type FinLancamento,
  type StatusLancamento,
  type TipoLancamento,
} from './types';
import {
  createLancamento,
  listCategorias,
  listContas,
  listLancamentos,
  marcarPago,
  removeLancamento,
  resumirLancamentos,
} from './financeiroService';

/** Aba Financeiro dentro do detalhe do cliente. */
export function ClienteFinanceiroTab({ clienteId }: { clienteId: string }) {
  const podeEscrever = usePodeEscreverFin();
  const [lancs, setLancs] = useState<FinLancamento[]>([]);
  const [contas, setContas] = useState<FinConta[]>([]);
  const [cats, setCats] = useState<FinCategoria[]>([]);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function reload() {
    setCarregando(true);
    setErro('');
    try {
      const [l, c, k] = await Promise.all([
        listLancamentos({ clienteId }),
        listContas({ soAtivas: true }),
        listCategorias(),
      ]);
      setLancs(l);
      setContas(c);
      setCats(k);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [clienteId]);

  const resumo = resumirLancamentos(lancs);

  if (carregando) {
    return <p className="text-sm text-muted-foreground">Carregando financeiro…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="grid gap-2 sm:grid-cols-3">
        <Mini label="Recebido" valor={brl(resumo.receitasPagas)} tom="text-emerald-400" />
        <Mini label="Pago" valor={brl(resumo.despesasPagas)} tom="text-red-400" />
        <Mini label="A receber" valor={brl(resumo.aReceber)} />
      </div>
      {podeEscrever && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="size-4" /> Lançamento
          </Button>
        </div>
      )}
      {!lancs.length ? (
        <p className="text-sm text-muted-foreground">
          Nenhum lançamento ligado a este cliente. Use o botão acima ou o módulo Financeiro.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {lancs.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
              <div>
                <p className="font-medium">{l.descricao}</p>
                <p className="text-xs text-muted-foreground">
                  {l.data?.slice(0, 10)} · {STATUS_LABEL[l.status]} · {l.expand?.categoria?.nome || '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    l.tipo === 'receita' ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {l.tipo === 'receita' ? '+' : '−'}
                  {brl(Number(l.valor) || 0)}
                </span>
                {podeEscrever && l.status !== 'pago' && (
                  <Button size="sm" variant="outline" onClick={() => void marcarPago(l.id).then(reload)}>
                    Pagar
                  </Button>
                )}
                {podeEscrever && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (!confirm('Excluir?')) return;
                      void removeLancamento(l.id).then(reload);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {showForm && (
        <FormRapidoCliente
          clienteId={clienteId}
          contas={contas}
          cats={cats}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            void reload();
          }}
          setErro={setErro}
        />
      )}
    </div>
  );
}

function Mini({ label, valor, tom }: { label: string; valor: string; tom?: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn('text-base font-bold tabular-nums', tom)}>{valor}</p>
    </div>
  );
}

function FormRapidoCliente({
  clienteId,
  contas,
  cats,
  onClose,
  onSaved,
  setErro,
}: {
  clienteId: string;
  contas: FinConta[];
  cats: FinCategoria[];
  onClose: () => void;
  onSaved: () => void;
  setErro: (m: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoLancamento>('receita');
  const [descricao, setDescricao] = useState('Mensalidade');
  const [valor, setValor] = useState('');
  const [conta, setConta] = useState(contas[0]?.id || '');
  const [categoria, setCategoria] = useState('');
  const [status, setStatus] = useState<StatusLancamento>('pago');
  const [recorrencia, setRecorrencia] = useState<'unica' | 'fixa'>('unica');
  const catsT = cats.filter((c) => c.tipo === tipo);

  useEffect(() => {
    setCategoria(catsT[0]?.id || '');
  }, [tipo]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold">Lançamento do cliente</h3>
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            {(['receita', 'despesa'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={cn(
                  'flex-1 rounded-md border py-1.5 text-sm capitalize',
                  tipo === t ? 'border-primary bg-primary/15' : 'border-border',
                )}
                onClick={() => setTipo(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição" />
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value.replace(',', '.'))}
            placeholder="Valor"
          />
          <select
            className="h-10 rounded-md border border-input bg-background/40 px-2 text-sm"
            value={conta}
            onChange={(e) => setConta(e.target.value)}
          >
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background/40 px-2 text-sm"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            {catsT.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background/40 px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusLancamento)}
          >
            {(Object.keys(STATUS_LABEL) as StatusLancamento[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background/40 px-2 text-sm"
            value={recorrencia}
            onChange={(e) => setRecorrencia(e.target.value as 'unica' | 'fixa')}
          >
            <option value="unica">Única</option>
            <option value="fixa">Fixa mensal (retainer)</option>
          </select>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              try {
                await createLancamento({
                  tipo,
                  descricao: descricao.trim() || 'Lançamento',
                  valor: Number(valor) || 0,
                  conta,
                  categoria,
                  data: hojeISO(),
                  vencimento: hojeISO(),
                  status,
                  recorrencia,
                  frequencia: recorrencia === 'fixa' ? 'mensal' : '',
                  origem: 'via_contrato',
                  cliente: clienteId,
                });
                onSaved();
              } catch (e) {
                setErro(e instanceof Error ? e.message : 'Erro ao salvar');
              }
            }}
            disabled={!(Number(valor) > 0) || !conta || !categoria}
          >
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
