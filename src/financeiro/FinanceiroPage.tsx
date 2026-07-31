import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeftRight,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
  Tag,
  ListOrdered,
  LayoutDashboard,
  CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePodeEscreverFin } from './usePodeEscreverFin';
import {
  brl,
  STATUS_LABEL,
  TIPO_CONTA_LABEL,
  hojeISO,
  type ContaTipo,
  type FinCategoria,
  type FinConta,
  type FinLancamento,
  type FrequenciaRecorrencia,
  type RecorrenciaTipo,
  type StatusLancamento,
  type TipoLancamento,
} from './types';
import {
  createCategoria,
  createConta,
  createLancamento,
  gerarProximasRecorrencias,
  listCategorias,
  listContas,
  listLancamentos,
  marcarPago,
  primeiroDiaMes,
  removeCategoria,
  removeConta,
  removeLancamento,
  resumirLancamentos,
  transferirEntreContas,
  ultimoDiaMes,
  updateCategoria,
  updateConta,
  updateLancamento,
} from './financeiroService';

type Aba = 'visao' | 'lancamentos' | 'apagar' | 'contas' | 'categorias';

const ABAS: { id: Aba; label: string; icon: typeof Wallet }[] = [
  { id: 'visao', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'lancamentos', label: 'Lançamentos', icon: ListOrdered },
  { id: 'apagar', label: 'A pagar / receber', icon: CalendarClock },
  { id: 'contas', label: 'Contas', icon: Wallet },
  { id: 'categorias', label: 'Categorias', icon: Tag },
];

export function FinanceiroPage() {
  const podeEscrever = usePodeEscreverFin();
  const [aba, setAba] = useState<Aba>('visao');
  const [contas, setContas] = useState<FinConta[]>([]);
  const [cats, setCats] = useState<FinCategoria[]>([]);
  const [lancs, setLancs] = useState<FinLancamento[]>([]);
  const [abertos, setAbertos] = useState<FinLancamento[]>([]);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [carregando, setCarregando] = useState(true);

  const reload = useCallback(async () => {
    setErro('');
    setCarregando(true);
    try {
      const de = primeiroDiaMes();
      const ate = ultimoDiaMes();
      const [c, k, l, a] = await Promise.all([
        listContas(),
        listCategorias({ incluirArquivadas: false }),
        listLancamentos({ de, ate }),
        listLancamentos({ abertos: true }),
      ]);
      setContas(c);
      setCats(k);
      setLancs(l);
      setAbertos(a);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar financeiro');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const resumo = useMemo(() => resumirLancamentos(lancs), [lancs]);
  const saldoTotal = useMemo(
    () => contas.filter((c) => c.ativo !== false).reduce((s, c) => s + (Number(c.saldo_atual) || 0), 0),
    [contas],
  );

  function flash(msg: string) {
    setOk(msg);
    setTimeout(() => setOk(''), 3500);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Caixa da agência · {podeEscrever ? 'você pode editar' : 'somente leitura'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RefreshCw className="size-4" /> Atualizar
        </Button>
      </header>

      {erro && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      {ok && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          {ok}
        </p>
      )}

      <nav className="flex flex-wrap gap-1 border-b border-border pb-2">
        {ABAS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAba(a.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                aba === a.id
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-secondary',
              )}
            >
              <Icon className="size-3.5" />
              {a.label}
            </button>
          );
        })}
      </nav>

      {carregando ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          {aba === 'visao' && (
            <VisaoGeral
              saldoTotal={saldoTotal}
              resumo={resumo}
              contas={contas}
              abertos={abertos}
              onIr={(a) => setAba(a)}
            />
          )}
          {aba === 'lancamentos' && (
            <AbaLancamentos
              contas={contas}
              cats={cats}
              lancs={lancs}
              podeEscrever={podeEscrever}
              onChange={async () => {
                await reload();
              }}
              flash={flash}
              setErro={setErro}
            />
          )}
          {aba === 'apagar' && (
            <AbaAPagarReceber
              lista={abertos}
              podeEscrever={podeEscrever}
              onChange={reload}
              flash={flash}
              setErro={setErro}
            />
          )}
          {aba === 'contas' && (
            <AbaContas
              contas={contas}
              podeEscrever={podeEscrever}
              onChange={reload}
              flash={flash}
              setErro={setErro}
            />
          )}
          {aba === 'categorias' && (
            <AbaCategorias
              cats={cats}
              podeEscrever={podeEscrever}
              onChange={reload}
              flash={flash}
              setErro={setErro}
            />
          )}
        </>
      )}
    </div>
  );
}

function CardStat({
  label,
  valor,
  tom,
}: {
  label: string;
  valor: string;
  tom?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-lg font-bold tabular-nums', tom)}>{valor}</p>
    </div>
  );
}

function VisaoGeral({
  saldoTotal,
  resumo,
  contas,
  abertos,
  onIr,
}: {
  saldoTotal: number;
  resumo: ReturnType<typeof resumirLancamentos>;
  contas: FinConta[];
  abertos: FinLancamento[];
  onIr: (a: Aba) => void;
}) {
  const aPagar = abertos.filter((l) => l.tipo === 'despesa').length;
  const aReceber = abertos.filter((l) => l.tipo === 'receita').length;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CardStat label="Saldo nas contas" valor={brl(saldoTotal)} tom="text-foreground" />
        <CardStat
          label="Receitas do mês (pagas)"
          valor={brl(resumo.receitasPagas)}
          tom="text-emerald-400"
        />
        <CardStat
          label="Despesas do mês (pagas)"
          valor={brl(resumo.despesasPagas)}
          tom="text-red-400"
        />
        <CardStat
          label="Resultado do mês"
          valor={brl(resumo.saldoPeriodo)}
          tom={resumo.saldoPeriodo >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onIr('apagar')}
          className="rounded-xl border border-border bg-card/40 p-4 text-left hover:bg-secondary/40"
        >
          <p className="text-sm font-medium">A receber</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-400">{brl(resumo.aReceber)}</p>
          <p className="text-xs text-muted-foreground">{aReceber} lançamento(s) aberto(s)</p>
        </button>
        <button
          type="button"
          onClick={() => onIr('apagar')}
          className="rounded-xl border border-border bg-card/40 p-4 text-left hover:bg-secondary/40"
        >
          <p className="text-sm font-medium">A pagar</p>
          <p className="text-2xl font-bold tabular-nums text-red-400">{brl(resumo.aPagar)}</p>
          <p className="text-xs text-muted-foreground">{aPagar} lançamento(s) aberto(s)</p>
        </button>
      </div>
      <div className="rounded-xl border border-border">
        <div className="border-b border-border px-4 py-2 text-sm font-medium">Contas</div>
        <ul className="divide-y divide-border">
          {contas.length === 0 && (
            <li className="px-4 py-6 text-sm text-muted-foreground">
              Nenhuma conta. Abra a aba Contas para criar o caixa.
            </li>
          )}
          {contas.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>
                {c.nome}{' '}
                <span className="text-muted-foreground">
                  · {TIPO_CONTA_LABEL[c.tipo] || c.tipo}
                  {c.ativo === false ? ' · inativa' : ''}
                </span>
              </span>
              <span className="font-semibold tabular-nums">{brl(Number(c.saldo_atual) || 0)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AbaLancamentos({
  contas,
  cats,
  lancs,
  podeEscrever,
  onChange,
  flash,
  setErro,
}: {
  contas: FinConta[];
  cats: FinCategoria[];
  lancs: FinLancamento[];
  podeEscrever: boolean;
  onChange: () => Promise<void>;
  flash: (m: string) => void;
  setErro: (m: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [edit, setEdit] = useState<FinLancamento | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Lançamentos do mês corrente</p>
        {podeEscrever && (
          <Button
            size="sm"
            onClick={() => {
              setEdit(null);
              setAberto(true);
            }}
          >
            <Plus className="size-4" /> Novo lançamento
          </Button>
        )}
      </div>
      <TabelaLancamentos
        lista={lancs}
        podeEscrever={podeEscrever}
        onEdit={(l) => {
          setEdit(l);
          setAberto(true);
        }}
        onDelete={async (l) => {
          if (!confirm(`Excluir “${l.descricao}”?`)) return;
          try {
            await removeLancamento(l.id);
            flash('Lançamento excluído');
            await onChange();
          } catch (e) {
            setErro(e instanceof Error ? e.message : 'Erro ao excluir');
          }
        }}
        onPagar={async (l) => {
          try {
            await marcarPago(l.id);
            flash('Marcado como pago');
            await onChange();
          } catch (e) {
            setErro(e instanceof Error ? e.message : 'Erro');
          }
        }}
        onGerarRec={async (l) => {
          try {
            const n = await gerarProximasRecorrencias(l, 3);
            flash(`${n.length} próximas ocorrências geradas`);
            await onChange();
          } catch (e) {
            setErro(e instanceof Error ? e.message : 'Erro ao gerar recorrência');
          }
        }}
      />
      {aberto && (
        <LancamentoModal
          contas={contas}
          cats={cats}
          inicial={edit}
          onClose={() => setAberto(false)}
          onSave={async (input) => {
            try {
              if (edit) await updateLancamento(edit.id, input);
              else await createLancamento(input);
              flash(edit ? 'Lançamento atualizado' : 'Lançamento criado');
              setAberto(false);
              await onChange();
            } catch (e) {
              setErro(e instanceof Error ? e.message : 'Erro ao salvar');
            }
          }}
        />
      )}
    </div>
  );
}

function AbaAPagarReceber({
  lista,
  podeEscrever,
  onChange,
  flash,
  setErro,
}: {
  lista: FinLancamento[];
  podeEscrever: boolean;
  onChange: () => Promise<void>;
  flash: (m: string) => void;
  setErro: (m: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Pendentes, previstos e em atraso (todas as datas)
      </p>
      <TabelaLancamentos
        lista={lista}
        podeEscrever={podeEscrever}
        onPagar={async (l) => {
          try {
            await marcarPago(l.id);
            flash('Pago');
            await onChange();
          } catch (e) {
            setErro(e instanceof Error ? e.message : 'Erro');
          }
        }}
        onDelete={async (l) => {
          if (!confirm('Excluir?')) return;
          try {
            await removeLancamento(l.id);
            await onChange();
          } catch (e) {
            setErro(e instanceof Error ? e.message : 'Erro');
          }
        }}
      />
    </div>
  );
}

function TabelaLancamentos({
  lista,
  podeEscrever,
  onEdit,
  onDelete,
  onPagar,
  onGerarRec,
}: {
  lista: FinLancamento[];
  podeEscrever: boolean;
  onEdit?: (l: FinLancamento) => void;
  onDelete?: (l: FinLancamento) => void;
  onPagar?: (l: FinLancamento) => void;
  onGerarRec?: (l: FinLancamento) => void;
}) {
  if (!lista.length) {
    return (
      <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        Nenhum lançamento.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border bg-secondary/30 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Data</th>
            <th className="px-3 py-2 font-medium">Descrição</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium text-right">Valor</th>
            <th className="px-3 py-2 font-medium" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lista.map((l) => (
            <tr key={l.id} className="hover:bg-secondary/20">
              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                {l.data?.slice(0, 10)}
              </td>
              <td className="px-3 py-2">
                <div className="font-medium">{l.descricao}</div>
                <div className="text-xs text-muted-foreground">
                  {l.expand?.categoria?.nome || '—'} · {l.expand?.conta?.nome || '—'}
                  {l.expand?.cliente
                    ? ` · ${l.expand.cliente.nome_fantasia || l.expand.cliente.nome}`
                    : ''}
                  {l.recorrencia !== 'unica' ? ` · ${l.recorrencia}` : ''}
                </div>
              </td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium',
                    l.status === 'pago' && 'bg-emerald-500/15 text-emerald-400',
                    l.status === 'pendente' && 'bg-yellow-500/15 text-yellow-400',
                    l.status === 'previsto' && 'bg-sky-500/15 text-sky-400',
                    l.status === 'em_atraso' && 'bg-red-500/15 text-red-400',
                  )}
                >
                  {STATUS_LABEL[l.status] || l.status}
                </span>
              </td>
              <td
                className={cn(
                  'px-3 py-2 text-right font-semibold tabular-nums',
                  l.tipo === 'receita' ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {l.tipo === 'receita' ? '+' : '−'}
                {brl(Number(l.valor) || 0)}
              </td>
              <td className="px-3 py-2">
                {podeEscrever && (
                  <div className="flex justify-end gap-1">
                    {l.status !== 'pago' && onPagar && (
                      <Button size="sm" variant="outline" onClick={() => onPagar(l)}>
                        Pagar
                      </Button>
                    )}
                    {(l.recorrencia === 'fixa' || l.recorrencia === 'recorrente') && onGerarRec && (
                      <Button size="sm" variant="ghost" title="Gerar 3 próximas" onClick={() => onGerarRec(l)}>
                        +3
                      </Button>
                    )}
                    {onEdit && (
                      <Button size="sm" variant="ghost" onClick={() => onEdit(l)}>
                        Editar
                      </Button>
                    )}
                    {onDelete && (
                      <Button size="sm" variant="ghost" onClick={() => onDelete(l)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LancamentoModal({
  contas,
  cats,
  inicial,
  onClose,
  onSave,
}: {
  contas: FinConta[];
  cats: FinCategoria[];
  inicial: FinLancamento | null;
  onClose: () => void;
  onSave: (input: Parameters<typeof createLancamento>[0]) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<TipoLancamento>(inicial?.tipo || 'despesa');
  const [descricao, setDescricao] = useState(inicial?.descricao || '');
  const [valor, setValor] = useState(String(inicial?.valor ?? ''));
  const [conta, setConta] = useState(inicial?.conta || contas.find((c) => c.padrao)?.id || contas[0]?.id || '');
  const [categoria, setCategoria] = useState(inicial?.categoria || '');
  const [data, setData] = useState(inicial?.data?.slice(0, 10) || hojeISO());
  const [vencimento, setVencimento] = useState(inicial?.vencimento?.slice(0, 10) || '');
  const [status, setStatus] = useState<StatusLancamento>(inicial?.status || 'pago');
  const [recorrencia, setRecorrencia] = useState<RecorrenciaTipo>(inicial?.recorrencia || 'unica');
  const [frequencia, setFrequencia] = useState<FrequenciaRecorrencia>(
    (inicial?.frequencia as FrequenciaRecorrencia) || 'mensal',
  );
  const [obs, setObs] = useState(inicial?.observacao || '');
  const [salvando, setSalvando] = useState(false);

  const catsTipo = cats.filter((c) => c.tipo === tipo && !c.arquivada);

  useEffect(() => {
    if (!categoria || !catsTipo.some((c) => c.id === categoria)) {
      setCategoria(catsTipo[0]?.id || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">{inicial ? 'Editar lançamento' : 'Novo lançamento'}</h2>
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex gap-2">
            {(['receita', 'despesa'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={cn(
                  'flex-1 rounded-md border px-3 py-2 text-sm capitalize',
                  tipo === t ? 'border-primary bg-primary/15 text-primary' : 'border-border',
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Campo label="Descrição">
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Valor (R$)">
              <Input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(',', '.'))}
              />
            </Campo>
            <Campo label="Data">
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Conta">
              <Select value={conta} onChange={setConta} options={contas.map((c) => ({ v: c.id, l: c.nome }))} />
            </Campo>
            <Campo label="Categoria">
              <Select
                value={categoria}
                onChange={setCategoria}
                options={catsTipo.map((c) => ({ v: c.id, l: c.nome }))}
              />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Status">
              <Select
                value={status}
                onChange={(v) => setStatus(v as StatusLancamento)}
                options={(Object.keys(STATUS_LABEL) as StatusLancamento[]).map((s) => ({
                  v: s,
                  l: STATUS_LABEL[s],
                }))}
              />
            </Campo>
            <Campo label="Vencimento">
              <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Recorrência">
              <Select
                value={recorrencia}
                onChange={(v) => setRecorrencia(v as RecorrenciaTipo)}
                options={[
                  { v: 'unica', l: 'Única' },
                  { v: 'fixa', l: 'Fixa (mensalidade)' },
                  { v: 'recorrente', l: 'Recorrente' },
                  { v: 'parcelada', l: 'Parcelada' },
                ]}
              />
            </Campo>
            {recorrencia !== 'unica' && (
              <Campo label="Frequência">
                <Select
                  value={frequencia || 'mensal'}
                  onChange={(v) => setFrequencia(v as FrequenciaRecorrencia)}
                  options={[
                    { v: 'mensal', l: 'Mensal' },
                    { v: 'semanal', l: 'Semanal' },
                    { v: 'quinzenal', l: 'Quinzenal' },
                    { v: 'anual', l: 'Anual' },
                  ]}
                />
              </Campo>
            )}
          </div>
          <Campo label="Observação">
            <Input value={obs} onChange={(e) => setObs(e.target.value)} />
          </Campo>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={salvando || !descricao.trim() || !conta || !categoria || !(Number(valor) > 0)}
            onClick={async () => {
              setSalvando(true);
              try {
                await onSave({
                  tipo,
                  descricao: descricao.trim(),
                  valor: Number(valor),
                  conta,
                  categoria,
                  data,
                  vencimento: vencimento || '',
                  status,
                  recorrencia: recorrencia as FinLancamento['recorrencia'],
                  frequencia:
                    recorrencia === 'unica' ? '' : (frequencia as FinLancamento['frequencia']),
                  origem: inicial?.origem || 'manual',
                  observacao: obs,
                  cliente: inicial?.cliente || '',
                  projeto: inicial?.projeto || '',
                });
              } finally {
                setSalvando(false);
              }
            }}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AbaContas({
  contas,
  podeEscrever,
  onChange,
  flash,
  setErro,
}: {
  contas: FinConta[];
  podeEscrever: boolean;
  onChange: () => Promise<void>;
  flash: (m: string) => void;
  setErro: (m: string) => void;
}) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<ContaTipo>('caixa');
  const [saldoIni, setSaldoIni] = useState('0');
  const [from, setFrom] = useState(contas[0]?.id || '');
  const [to, setTo] = useState(contas[1]?.id || contas[0]?.id || '');
  const [valorTx, setValorTx] = useState('');

  return (
    <div className="flex flex-col gap-4">
      {podeEscrever && (
        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 text-sm font-medium">Nova conta</p>
          <div className="grid gap-2 sm:grid-cols-4">
            <Input placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Select
              value={tipo}
              onChange={(v) => setTipo(v as ContaTipo)}
              options={(Object.keys(TIPO_CONTA_LABEL) as ContaTipo[]).map((t) => ({
                v: t,
                l: TIPO_CONTA_LABEL[t],
              }))}
            />
            <Input
              placeholder="Saldo inicial"
              value={saldoIni}
              onChange={(e) => setSaldoIni(e.target.value.replace(',', '.'))}
            />
            <Button
              onClick={async () => {
                try {
                  await createConta({
                    nome: nome.trim(),
                    tipo,
                    saldo_inicial: Number(saldoIni) || 0,
                    ativo: true,
                  });
                  setNome('');
                  flash('Conta criada');
                  await onChange();
                } catch (e) {
                  setErro(e instanceof Error ? e.message : 'Erro');
                }
              }}
              disabled={!nome.trim()}
            >
              Criar
            </Button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border rounded-xl border border-border">
        {contas.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{c.nome}</p>
              <p className="text-xs text-muted-foreground">{TIPO_CONTA_LABEL[c.tipo]}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold tabular-nums">{brl(Number(c.saldo_atual) || 0)}</span>
              {podeEscrever && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const ativo = c.ativo === false;
                      try {
                        await updateConta(c.id, { ativo });
                        await onChange();
                      } catch (e) {
                        setErro(e instanceof Error ? e.message : 'Erro');
                      }
                    }}
                  >
                    {c.ativo === false ? 'Ativar' : 'Desativar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm(`Excluir conta “${c.nome}”?`)) return;
                      try {
                        await removeConta(c.id);
                        flash('Conta excluída');
                        await onChange();
                      } catch (e) {
                        setErro(e instanceof Error ? e.message : 'Erro (conta com lançamentos?)');
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {podeEscrever && contas.length >= 2 && (
        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
            <ArrowLeftRight className="size-4" /> Transferência
          </p>
          <div className="grid gap-2 sm:grid-cols-4">
            <Select
              value={from}
              onChange={setFrom}
              options={contas.map((c) => ({ v: c.id, l: `De: ${c.nome}` }))}
            />
            <Select
              value={to}
              onChange={setTo}
              options={contas.map((c) => ({ v: c.id, l: `Para: ${c.nome}` }))}
            />
            <Input
              placeholder="Valor"
              value={valorTx}
              onChange={(e) => setValorTx(e.target.value.replace(',', '.'))}
            />
            <Button
              onClick={async () => {
                try {
                  await transferirEntreContas({
                    from,
                    to,
                    valor: Number(valorTx),
                  });
                  setValorTx('');
                  flash('Transferência feita');
                  await onChange();
                } catch (e) {
                  setErro(e instanceof Error ? e.message : 'Erro na transferência');
                }
              }}
              disabled={!(Number(valorTx) > 0) || from === to}
            >
              Transferir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AbaCategorias({
  cats,
  podeEscrever,
  onChange,
  flash,
  setErro,
}: {
  cats: FinCategoria[];
  podeEscrever: boolean;
  onChange: () => Promise<void>;
  flash: (m: string) => void;
  setErro: (m: string) => void;
}) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoLancamento>('despesa');

  return (
    <div className="flex flex-col gap-4">
      {podeEscrever && (
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Nova categoria"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Select
            value={tipo}
            onChange={(v) => setTipo(v as TipoLancamento)}
            options={[
              { v: 'receita', l: 'Receita' },
              { v: 'despesa', l: 'Despesa' },
            ]}
          />
          <Button
            onClick={async () => {
              try {
                await createCategoria({ nome: nome.trim(), tipo });
                setNome('');
                flash('Categoria criada');
                await onChange();
              } catch (e) {
                setErro(e instanceof Error ? e.message : 'Erro');
              }
            }}
            disabled={!nome.trim()}
          >
            Adicionar
          </Button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {(['receita', 'despesa'] as const).map((t) => (
          <div key={t} className="rounded-xl border border-border">
            <div className="border-b border-border px-3 py-2 text-sm font-medium capitalize">{t}s</div>
            <ul className="divide-y divide-border">
              {cats
                .filter((c) => c.tipo === t)
                .map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      {c.nome}
                      {c.sistema ? (
                        <span className="ml-1 text-[10px] text-muted-foreground">sistema</span>
                      ) : null}
                    </span>
                    {podeEscrever && !c.sistema && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await updateCategoria(c.id, { arquivada: !c.arquivada });
                              await onChange();
                            } catch (e) {
                              setErro(e instanceof Error ? e.message : 'Erro');
                            }
                          }}
                        >
                          {c.arquivada ? 'Restaurar' : 'Arquivar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (!confirm('Excluir categoria?')) return;
                            try {
                              await removeCategoria(c.id);
                              await onChange();
                            } catch (e) {
                              setErro(e instanceof Error ? e.message : 'Erro');
                            }
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <select
      className="flex h-10 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );
}
