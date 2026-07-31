import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
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
import { listClientes } from '@/clientes/clientesService';
import type { Cliente } from '@/clientes/types';
import { usePodeEscreverFin } from './usePodeEscreverFin';
import {
  brl,
  clientesFromLancamentos,
  filtrarLancamentos,
  mergeClientesFiltro,
  nomeCliente,
  STATUS_LABEL,
  topCategoriasPagas,
  TIPO_CONTA_LABEL,
  hojeISO,
  type ClienteFiltro,
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

const MESES_CURTOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const;

function labelMesAno(ano: number, mes1a12: number): string {
  const idx = Math.min(11, Math.max(0, mes1a12 - 1));
  return `${MESES_CURTOS[idx]}/${String(ano).slice(-2)}`;
}

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
  const now = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(() => now.getFullYear());
  const [mes, setMes] = useState(() => now.getMonth() + 1); // 1–12
  const [contas, setContas] = useState<FinConta[]>([]);
  const [cats, setCats] = useState<FinCategoria[]>([]);
  const [lancs, setLancs] = useState<FinLancamento[]>([]);
  const [abertos, setAbertos] = useState<FinLancamento[]>([]);
  /** Clientes vindos do PB (Admin); Membro costuma vir vazio. */
  const [clientesPb, setClientesPb] = useState<ClienteFiltro[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [carregandoMes, setCarregandoMes] = useState(false);

  /** Base: não depende do mês (contas, categorias, abertos, lista clientes PB). */
  const loadBase = useCallback(async () => {
    setErro('');
    try {
      const [c, k, a, cli] = await Promise.all([
        listContas(),
        listCategorias({ incluirArquivadas: false }),
        listLancamentos({ abertos: true }),
        listClientes('').catch(() => [] as Cliente[]),
      ]);
      setContas(c);
      setCats(k);
      setAbertos(a);
      setClientesPb(cli);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar financeiro');
    }
  }, []);

  /** Só lançamentos do mês selecionado. */
  const loadMes = useCallback(async () => {
    setErro('');
    setCarregandoMes(true);
    try {
      const de = primeiroDiaMes(ano, mes);
      const ate = ultimoDiaMes(ano, mes);
      const l = await listLancamentos({ de, ate });
      setLancs(l);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o mês');
    } finally {
      setCarregandoMes(false);
    }
  }, [ano, mes]);

  const reload = useCallback(async () => {
    setCarregando(true);
    try {
      await loadBase();
      await loadMes();
    } finally {
      setCarregando(false);
    }
  }, [loadBase, loadMes]);

  // Carga inicial da base (1×)
  useEffect(() => {
    void (async () => {
      setCarregando(true);
      try {
        await loadBase();
      } finally {
        setCarregando(false);
      }
    })();
  }, [loadBase]);

  // Ao mudar mês (e na 1ª vez): só o período
  useEffect(() => {
    void loadMes();
  }, [loadMes]);

  // Opções do filtro: PB + expand dos lançamentos (mês + abertos)
  const clientes = useMemo(() => {
    const fromExpand = clientesFromLancamentos([...lancs, ...abertos]);
    return mergeClientesFiltro(clientesPb, fromExpand);
  }, [clientesPb, lancs, abertos]);

  // P2 Opus: se o cliente sumiu da lista (ex.: Membro ao mudar mês), limpa o filtro
  useEffect(() => {
    if (clienteId && !clientes.some((c) => c.id === clienteId)) {
      setClienteId('');
    }
  }, [clienteId, clientes]);

  function mudarMes(delta: number) {
    let m = mes + delta;
    let y = ano;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    setMes(m);
    setAno(y);
  }

  const filtro = useMemo(() => ({ clienteId, q: busca }), [clienteId, busca]);
  const lancsFiltrados = useMemo(() => filtrarLancamentos(lancs, filtro), [lancs, filtro]);
  const abertosFiltrados = useMemo(() => filtrarLancamentos(abertos, filtro), [abertos, filtro]);
  const resumo = useMemo(() => resumirLancamentos(lancsFiltrados), [lancsFiltrados]);
  const saldoTotal = useMemo(
    () => contas.filter((c) => c.ativo !== false).reduce((s, c) => s + (Number(c.saldo_atual) || 0), 0),
    [contas],
  );
  const mesLabel = labelMesAno(ano, mes);
  const mesCorrente = useMemo(() => {
    const d = new Date();
    return ano === d.getFullYear() && mes === d.getMonth() + 1;
  }, [ano, mes]);

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
        <div className="flex flex-wrap items-center gap-2">
          {(aba === 'visao' || aba === 'lancamentos') && (
            <div
              className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card/60 p-0.5"
              role="group"
              aria-label="Navegação de mês"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => mudarMes(-1)}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-[4.25rem] text-center text-sm font-medium tabular-nums capitalize">
                {mesLabel}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => mudarMes(1)}
                aria-label="Próximo mês"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="size-4" /> Atualizar
          </Button>
        </div>
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

      {(aba === 'visao' || aba === 'lancamentos' || aba === 'apagar') && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card/40 p-3">
          <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Cliente
            <Select
              name="filtro_cliente"
              value={clienteId}
              onChange={setClienteId}
              options={[
                { v: '', l: 'Todos os clientes' },
                ...clientes.map((c) => ({ v: c.id, l: nomeCliente(c) || c.id })),
              ]}
            />
          </label>
          <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Buscar descrição
            <Input
              name="filtro_q"
              placeholder="Ex.: mensalidade, freela…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          {(clienteId || busca) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setClienteId('');
                setBusca('');
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {carregando && !lancs.length ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          {carregandoMes && (
            <p className="text-xs text-muted-foreground">Atualizando {mesLabel}…</p>
          )}
          {aba === 'visao' && (
            <VisaoGeral
              saldoTotal={saldoTotal}
              saldoLabel={mesCorrente ? 'Saldo atual das contas' : 'Saldo atual das contas (agora)'}
              resumo={resumo}
              contas={contas}
              abertos={abertosFiltrados}
              lancsMes={lancsFiltrados}
              filtroAtivo={!!(clienteId || busca)}
              onIr={(a) => setAba(a)}
            />
          )}
          {aba === 'lancamentos' && (
            <AbaLancamentos
              contas={contas}
              cats={cats}
              clientes={clientes}
              lancs={lancsFiltrados}
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
              lista={abertosFiltrados}
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
  saldoLabel,
  resumo,
  contas,
  abertos,
  lancsMes,
  filtroAtivo,
  onIr,
}: {
  saldoTotal: number;
  saldoLabel: string;
  resumo: ReturnType<typeof resumirLancamentos>;
  contas: FinConta[];
  abertos: FinLancamento[];
  lancsMes: FinLancamento[];
  filtroAtivo: boolean;
  onIr: (a: Aba) => void;
}) {
  // Totais de abertos usam a lista completa (todas as datas), não só o mês.
  const abertosResumo = useMemo(() => resumirLancamentos(abertos), [abertos]);
  const qtdReceber = abertos.filter((l) => l.tipo === 'receita').length;
  const qtdPagar = abertos.filter((l) => l.tipo === 'despesa').length;
  const topCats = useMemo(() => topCategoriasPagas(lancsMes, 6), [lancsMes]);
  const maxCat = Math.max(1, ...topCats.map((c) => c.valor));
  const maxBar = Math.max(resumo.receitasPagas, resumo.despesasPagas, 1);

  return (
    <div className="flex flex-col gap-4">
      {filtroAtivo && (
        <p className="text-xs text-muted-foreground">
          Números abaixo respeitam o filtro de cliente/busca (saldo das contas continua global).
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CardStat label={saldoLabel} valor={brl(saldoTotal)} tom="text-foreground" />
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
          <p className="text-2xl font-bold tabular-nums text-emerald-400">
            {brl(abertosResumo.aReceber)}
          </p>
          <p className="text-xs text-muted-foreground">
            {qtdReceber} lançamento(s) aberto(s)
          </p>
        </button>
        <button
          type="button"
          onClick={() => onIr('apagar')}
          className="rounded-xl border border-border bg-card/40 p-4 text-left hover:bg-secondary/40"
        >
          <p className="text-sm font-medium">A pagar</p>
          <p className="text-2xl font-bold tabular-nums text-red-400">
            {brl(abertosResumo.aPagar)}
          </p>
          <p className="text-xs text-muted-foreground">
            {qtdPagar} lançamento(s) aberto(s)
          </p>
        </button>
      </div>

      {/* Gráfico simples: barras CSS, sem lib */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 text-sm font-medium">Receitas × despesas (mês)</p>
          <div className="flex h-36 items-end gap-6 px-2">
            <div className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs tabular-nums text-emerald-400">
                {brl(resumo.receitasPagas)}
              </span>
              <div
                className="w-full max-w-[72px] rounded-t-md bg-emerald-500/80 transition-all"
                style={{ height: `${Math.max(8, (resumo.receitasPagas / maxBar) * 100)}%` }}
                title="Receitas pagas"
              />
              <span className="text-[11px] text-muted-foreground">Receitas</span>
            </div>
            <div className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs tabular-nums text-red-400">{brl(resumo.despesasPagas)}</span>
              <div
                className="w-full max-w-[72px] rounded-t-md bg-red-500/80 transition-all"
                style={{ height: `${Math.max(8, (resumo.despesasPagas / maxBar) * 100)}%` }}
                title="Despesas pagas"
              />
              <span className="text-[11px] text-muted-foreground">Despesas</span>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 text-sm font-medium">Top categorias (pagas no mês)</p>
          {topCats.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sem pagamentos no período.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {topCats.map((c) => (
                <li key={`${c.tipo}-${c.nome}`} className="text-xs">
                  <div className="mb-0.5 flex justify-between gap-2">
                    <span className="truncate text-muted-foreground">
                      {c.tipo === 'receita' ? '↑' : '↓'} {c.nome}
                    </span>
                    <span
                      className={cn(
                        'tabular-nums font-medium',
                        c.tipo === 'receita' ? 'text-emerald-400' : 'text-red-400',
                      )}
                    >
                      {brl(c.valor)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        c.tipo === 'receita' ? 'bg-emerald-500/70' : 'bg-red-500/70',
                      )}
                      style={{ width: `${(c.valor / maxCat) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
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
  clientes,
  lancs,
  podeEscrever,
  onChange,
  flash,
  setErro,
}: {
  contas: FinConta[];
  cats: FinCategoria[];
  clientes: ClienteFiltro[];
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
        <p className="text-sm text-muted-foreground">
          Lançamentos do mês selecionado
          {lancs.length ? ` · ${lancs.length} item(ns)` : ''}
        </p>
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
          clientes={clientes}
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
                    ? ` · ${nomeCliente(l.expand.cliente)}`
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

function preferCategoria(cats: FinCategoria[], tipo: TipoLancamento, atual?: string): string {
  const lista = cats.filter((c) => c.tipo === tipo && !c.arquivada);
  if (atual && lista.some((c) => c.id === atual)) return atual;
  // Prefere categorias de negócio; evita "Ajuste"/"Transferência" como default.
  const preferidas =
    tipo === 'receita'
      ? ['Mensalidade / retainer', 'Serviços de clientes', 'Outras receitas']
      : ['Ferramentas e software', 'Freelancers / terceiros', 'Marketing e anúncios'];
  for (const nome of preferidas) {
    const hit = lista.find((c) => c.nome === nome);
    if (hit) return hit.id;
  }
  const semSistema = lista.find((c) => !c.sistema);
  return semSistema?.id || lista[0]?.id || '';
}

function LancamentoModal({
  contas,
  cats,
  clientes,
  inicial,
  onClose,
  onSave,
}: {
  contas: FinConta[];
  cats: FinCategoria[];
  clientes: ClienteFiltro[];
  inicial: FinLancamento | null;
  onClose: () => void;
  onSave: (input: Parameters<typeof createLancamento>[0]) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<TipoLancamento>(inicial?.tipo || 'receita');
  const [descricao, setDescricao] = useState(inicial?.descricao || '');
  const [valor, setValor] = useState(String(inicial?.valor ?? ''));
  const [conta, setConta] = useState(
    inicial?.conta || contas.find((c) => c.padrao)?.id || contas[0]?.id || '',
  );
  const [categoria, setCategoria] = useState(
    inicial?.categoria || preferCategoria(cats, inicial?.tipo || 'receita'),
  );
  const [cliente, setCliente] = useState(inicial?.cliente || '');
  const [data, setData] = useState(inicial?.data?.slice(0, 10) || hojeISO());
  const [vencimento, setVencimento] = useState(inicial?.vencimento?.slice(0, 10) || '');
  const [status, setStatus] = useState<StatusLancamento>(inicial?.status || 'pago');
  const [recorrencia, setRecorrencia] = useState<RecorrenciaTipo>(inicial?.recorrencia || 'unica');
  const [frequencia, setFrequencia] = useState<FrequenciaRecorrencia>(
    (inicial?.frequencia as FrequenciaRecorrencia) || 'mensal',
  );
  const [obs, setObs] = useState(inicial?.observacao || '');
  const [salvando, setSalvando] = useState(false);

  const catsTipo = useMemo(
    () => cats.filter((c) => c.tipo === tipo && !c.arquivada),
    [cats, tipo],
  );

  // Ao trocar receita/despesa, escolhe categoria válida (não "Ajuste" se houver melhor).
  useEffect(() => {
    setCategoria((prev) => preferCategoria(cats, tipo, prev));
  }, [tipo, cats]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // FormData é a fonte da verdade (select nativo sempre reflete o valor atual).
    const tipoF = String(fd.get('tipo') || tipo) as TipoLancamento;
    const descF = String(fd.get('descricao') || '').trim();
    const valorF = Number(String(fd.get('valor') || '0').replace(',', '.'));
    const contaF = String(fd.get('conta') || '');
    const catF = String(fd.get('categoria') || '');
    const clienteF = String(fd.get('cliente') || '');
    const dataF = String(fd.get('data') || hojeISO());
    const vencF = String(fd.get('vencimento') || '');
    const statusF = String(fd.get('status') || 'pago') as StatusLancamento;
    const recF = String(fd.get('recorrencia') || 'unica') as RecorrenciaTipo;
    const freqF = String(fd.get('frequencia') || 'mensal') as FrequenciaRecorrencia;
    const obsF = String(fd.get('observacao') || '');
    if (!descF || !contaF || !catF || !(valorF > 0)) return;
    // Garante que a categoria pertence ao tipo escolhido.
    const catOk = cats.some((c) => c.id === catF && c.tipo === tipoF);
    if (!catOk) {
      return;
    }
    setSalvando(true);
    try {
      await onSave({
        tipo: tipoF,
        descricao: descF,
        valor: valorF,
        conta: contaF,
        categoria: catF,
        data: dataF,
        vencimento: vencF,
        status: statusF,
        recorrencia: recF,
        frequencia: recF === 'unica' ? '' : freqF,
        origem: inicial?.origem || 'manual',
        observacao: obsF,
        cliente: clienteF,
        projeto: inicial?.projeto || '',
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 className="text-base font-semibold">
          {inicial ? 'Editar lançamento' : 'Novo lançamento'}
        </h2>
        <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => void handleSubmit(e)}>
          <input type="hidden" name="tipo" value={tipo} />
          <div className="flex gap-2" role="group" aria-label="Tipo do lançamento">
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
            <Input
              name="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Valor (R$)">
              <Input
                name="valor"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(',', '.'))}
                required
              />
            </Campo>
            <Campo label="Data">
              <Input
                name="data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Conta">
              <Select
                name="conta"
                value={conta}
                onChange={setConta}
                options={contas.map((c) => ({ v: c.id, l: c.nome }))}
              />
            </Campo>
            <Campo label="Categoria">
              <Select
                name="categoria"
                value={categoria}
                onChange={setCategoria}
                options={catsTipo.map((c) => ({ v: c.id, l: c.nome }))}
              />
            </Campo>
          </div>
          <Campo label="Cliente (opcional)">
            <Select
              name="cliente"
              value={cliente}
              onChange={setCliente}
              options={[
                { v: '', l: '— Sem cliente —' },
                ...clientes.map((c) => ({ v: c.id, l: nomeCliente(c) || c.id })),
              ]}
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Status">
              <Select
                name="status"
                value={status}
                onChange={(v) => setStatus(v as StatusLancamento)}
                options={(Object.keys(STATUS_LABEL) as StatusLancamento[]).map((s) => ({
                  v: s,
                  l: STATUS_LABEL[s],
                }))}
              />
            </Campo>
            <Campo label="Vencimento">
              <Input
                name="vencimento"
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Recorrência">
              <Select
                name="recorrencia"
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
                  name="frequencia"
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
            <Input name="observacao" value={obs} onChange={(e) => setObs(e.target.value)} />
          </Campo>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando || !descricao.trim() || !conta || !categoria || !(Number(valor) > 0)}
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </form>
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
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [valorTx, setValorTx] = useState('');

  // Mantém selects de transferência alinhados à lista de contas.
  useEffect(() => {
    setFrom((prev) => (prev && contas.some((c) => c.id === prev) ? prev : contas[0]?.id || ''));
    setTo((prev) => {
      if (prev && contas.some((c) => c.id === prev)) return prev;
      return contas[1]?.id || contas[0]?.id || '';
    });
  }, [contas]);

  return (
    <div className="flex flex-col gap-4">
      {podeEscrever && (
        <div className="rounded-xl border border-border p-4">
          <p className="mb-3 text-sm font-medium">Nova conta</p>
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Tipo da conta">
            {(Object.keys(TIPO_CONTA_LABEL) as ContaTipo[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium',
                  tipo === t
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border text-muted-foreground hover:bg-secondary',
                )}
              >
                {TIPO_CONTA_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              name="nome_conta"
              placeholder="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <Input
              name="saldo_inicial"
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
                  setTipo('caixa');
                  setSaldoIni('0');
                  flash(`Conta criada (${TIPO_CONTA_LABEL[tipo]})`);
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
              <p className="text-xs text-muted-foreground">
                {TIPO_CONTA_LABEL[c.tipo] || c.tipo}
                {c.ativo === false ? ' · inativa' : ''}
              </p>
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
          <form
            className="grid gap-2 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const fromF = String(fd.get('from') || from);
              const toF = String(fd.get('to') || to);
              const valorF = Number(String(fd.get('valor_tx') || valorTx).replace(',', '.'));
              void (async () => {
                try {
                  await transferirEntreContas({ from: fromF, to: toF, valor: valorF });
                  setValorTx('');
                  flash('Transferência feita');
                  await onChange();
                } catch (err) {
                  setErro(err instanceof Error ? err.message : 'Erro na transferência');
                }
              })();
            }}
          >
            <Select
              name="from"
              value={from}
              onChange={setFrom}
              options={contas.map((c) => ({ v: c.id, l: `De: ${c.nome}` }))}
            />
            <Select
              name="to"
              value={to}
              onChange={setTo}
              options={contas.map((c) => ({ v: c.id, l: `Para: ${c.nome}` }))}
            />
            <Input
              name="valor_tx"
              placeholder="Valor"
              value={valorTx}
              onChange={(e) => setValorTx(e.target.value.replace(',', '.'))}
            />
            <Button type="submit" disabled={!(Number(valorTx) > 0) || from === to}>
              Transferir
            </Button>
          </form>
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
  name,
  value,
  onChange,
  options,
}: {
  name?: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <select
      name={name}
      aria-label={name}
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
