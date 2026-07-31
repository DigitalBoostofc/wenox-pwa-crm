import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  Plus,
  RefreshCw,
  Scale,
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
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { useAuth } from '@/auth/useAuth';
import { usePodeEscreverFin } from './usePodeEscreverFin';
import {
  brl,
  clientesFromLancamentos,
  ehGanhoDoMembro,
  filtrarLancamentos,
  filtrarPrivacidadeMembro,
  isCategoriaSalarioProlabore,
  mergeClientesFiltro,
  nomeCliente,
  nomeMembro,
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
import {
  DonutChart,
  FinBarraAbas,
  FinCard,
  FinPillsAbas,
  IconBubble,
  KpiStripItem,
  MonthPill,
  PillTabs,
  TipoFilterPills,
} from './finUi';
import { balanceBar, corCategoria } from './finUi.helpers';

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
  const { user } = useAuth();
  const isMembroRole = user?.role === 'Membro';
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
  const [membros, setMembros] = useState<Usuario[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [carregandoMes, setCarregandoMes] = useState(false);

  /** Base: não depende do mês (contas, categorias, abertos, lista clientes PB, membros). */
  const loadBase = useCallback(async () => {
    setErro('');
    try {
      const [c, k, a, cli, us] = await Promise.all([
        listContas(),
        listCategorias({ incluirArquivadas: true }),
        listLancamentos({ abertos: true }),
        listClientes('').catch(() => [] as Cliente[]),
        listUsuarios().catch(() => [] as Usuario[]),
      ]);
      setContas(c);
      setCats(k);
      setAbertos(a);
      setClientesPb(cli);
      setMembros(
        us.filter((u) => u.role !== 'Cliente' && (u.status === 'Ativo' || !u.status)),
      );
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
  // Membro: esconde salário de outros antes dos filtros de UI
  const lancsVisiveis = useMemo(() => {
    if (!isMembroRole || !user?.id) return lancs;
    return filtrarPrivacidadeMembro(lancs, user.id);
  }, [isMembroRole, user?.id, lancs]);
  const abertosVisiveis = useMemo(() => {
    if (!isMembroRole || !user?.id) return abertos;
    return filtrarPrivacidadeMembro(abertos, user.id);
  }, [isMembroRole, user?.id, abertos]);
  const lancsFiltrados = useMemo(
    () => filtrarLancamentos(lancsVisiveis, filtro),
    [lancsVisiveis, filtro],
  );
  const abertosFiltrados = useMemo(
    () => filtrarLancamentos(abertosVisiveis, filtro),
    [abertosVisiveis, filtro],
  );
  /** Para Membro, salário próprio entra no resumo como receita (ganho). */
  const mapGanho = useCallback(
    (lista: FinLancamento[]) => {
      if (!isMembroRole || !user?.id) return lista;
      return lista.map((l) =>
        ehGanhoDoMembro(l, user.id) ? { ...l, tipo: 'receita' as const } : l,
      );
    },
    [isMembroRole, user?.id],
  );
  const lancsParaResumo = useMemo(
    () => mapGanho(lancsFiltrados),
    [mapGanho, lancsFiltrados],
  );
  const abertosParaResumo = useMemo(
    () => mapGanho(abertosFiltrados),
    [mapGanho, abertosFiltrados],
  );
  const resumo = useMemo(() => resumirLancamentos(lancsParaResumo), [lancsParaResumo]);
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
    <div className="flex w-full gap-4">
      <FinBarraAbas items={ABAS} value={aba} onChange={setAba} />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Financeiro
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              {aba === 'visao' ? 'Dashboard' : ABAS.find((a) => a.id === aba)?.label}
            </h1>
            <p className="text-sm text-muted-foreground">
              {podeEscrever ? 'Caixa da agência · edição liberada' : 'Somente leitura'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(aba === 'visao' || aba === 'lancamentos') && (
              <MonthPill label={mesLabel} onPrev={() => mudarMes(-1)} onNext={() => mudarMes(1)} />
            )}
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-border"
              onClick={() => void reload()}
            >
              <RefreshCw className="size-4" /> Atualizar
            </Button>
          </div>
        </header>

        {erro && (
          <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erro}
          </p>
        )}
        {ok && (
          <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            {ok}
          </p>
        )}

        <FinPillsAbas items={ABAS} value={aba} onChange={setAba} />

        {(aba === 'visao' || aba === 'lancamentos' || aba === 'apagar') && (
          <FinCard className="flex flex-wrap items-end gap-3 !p-3">
            <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-muted-foreground">
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
            <label className="flex min-w-[200px] flex-[1.2] flex-col gap-1 text-xs text-muted-foreground">
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
          </FinCard>
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
                abertos={abertosParaResumo}
                lancsMes={lancsParaResumo}
                filtroAtivo={!!(clienteId || busca)}
                onIr={(a) => setAba(a)}
              />
            )}
            {aba === 'lancamentos' && (
              <AbaLancamentos
                contas={contas}
                cats={cats}
                clientes={clientes}
                membros={membros}
                viewerUserId={user?.id}
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
                viewerUserId={user?.id}
                onChange={async () => {
                  await reload();
                }}
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
  const topReceitas = useMemo(
    () => topCategoriasPagas(lancsMes.filter((l) => l.tipo === 'receita'), 6),
    [lancsMes],
  );
  const topDespesas = useMemo(
    () => topCategoriasPagas(lancsMes.filter((l) => l.tipo === 'despesa'), 6),
    [lancsMes],
  );
  const receitasCat = useMemo(
    () => topReceitas.map((c, i) => ({ nome: c.nome, valor: c.valor, color: corCategoria(c.nome, i) })),
    [topReceitas],
  );
  const despesasCat = useMemo(
    () =>
      topDespesas.map((c, i) => ({ nome: c.nome, valor: c.valor, color: corCategoria(c.nome, i + 3) })),
    [topDespesas],
  );
  const bal = balanceBar(resumo.receitasPagas, resumo.despesasPagas);

  return (
    <div className="flex flex-col gap-4">
      {filtroAtivo && (
        <p className="text-xs text-muted-foreground">
          Números abaixo respeitam o filtro de cliente/busca (saldo das contas continua global).
        </p>
      )}

      {/* KPI strip estilo Cleanox */}
      <FinCard className="!p-0 overflow-hidden">
        <div className="flex flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
          <KpiStripItem
            icon={<Wallet className="size-4" />}
            label={saldoLabel}
            valor={brl(saldoTotal)}
            tone="info"
          />
          <KpiStripItem
            icon={<ArrowUpCircle className="size-4" />}
            label="Receitas do mês"
            valor={brl(resumo.receitasPagas)}
            tom="text-emerald-400"
            tone="ok"
          />
          <KpiStripItem
            icon={<ArrowDownCircle className="size-4" />}
            label="Despesas do mês"
            valor={brl(resumo.despesasPagas)}
            tom="text-red-400"
            tone="danger"
          />
          <KpiStripItem
            icon={<Scale className="size-4" />}
            label="Balanço do mês"
            valor={brl(resumo.saldoPeriodo)}
            tom={resumo.saldoPeriodo >= 0 ? 'text-emerald-400' : 'text-red-400'}
            tone="primary"
          />
        </div>
      </FinCard>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
        <FinCard>
          <p className="mb-3 text-sm font-medium">Receitas por categoria</p>
          <DonutChart
            segments={receitasCat}
            centerLabel="Receitas"
            centerValue={brl(resumo.receitasPagas)}
            total={resumo.receitasPagas}
            size={160}
          />
        </FinCard>
        <FinCard>
          <p className="mb-3 text-sm font-medium">Despesas por categoria</p>
          <DonutChart
            segments={despesasCat}
            centerLabel="Despesas"
            centerValue={brl(resumo.despesasPagas)}
            total={resumo.despesasPagas}
            size={160}
          />
        </FinCard>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <FinCard>
          <p className="mb-3 text-sm font-medium">Balanço mensal</p>
          <div className="mb-2 flex h-32 items-end gap-4">
            <div className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] tabular-nums text-emerald-400">{bal.labelR}</span>
              <div
                className="w-full max-w-[72px] rounded-t-md bg-emerald-500/85"
                style={{ height: `${Math.max(8, bal.rPct)}%` }}
              />
              <span className="text-[10px] text-muted-foreground">Receitas</span>
            </div>
            <div className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] tabular-nums text-red-400">{bal.labelD}</span>
              <div
                className="w-full max-w-[72px] rounded-t-md bg-red-500/85"
                style={{ height: `${Math.max(8, bal.dPct)}%` }}
              />
              <span className="text-[10px] text-muted-foreground">Despesas</span>
            </div>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Resultado</span>
            <span
              className={cn(
                'font-semibold tabular-nums',
                resumo.saldoPeriodo >= 0 ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              {brl(resumo.saldoPeriodo)}
            </span>
          </div>
        </FinCard>

        <button
          type="button"
          onClick={() => onIr('apagar')}
          className="rounded-2xl border border-border bg-card/80 p-4 text-left shadow-sm dark:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.55)] transition hover:bg-secondary/40"
        >
          <p className="text-sm font-medium">Pendências e alertas</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">A receber</span>
              <span className="font-semibold tabular-nums text-emerald-400">
                {brl(abertosResumo.aReceber)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">A pagar</span>
              <span className="font-semibold tabular-nums text-red-400">
                {brl(abertosResumo.aPagar)}
              </span>
            </div>
            <p className="pt-1 text-[11px] text-muted-foreground">
              {qtdReceber} a receber · {qtdPagar} a pagar · toque para ver
            </p>
          </div>
        </button>

        <FinCard>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Minhas contas</p>
            <button
              type="button"
              className="text-[11px] font-medium text-info hover:underline"
              onClick={() => onIr('contas')}
            >
              Ver mais
            </button>
          </div>
          <ul className="divide-y divide-border">
            {contas.filter((c) => c.ativo !== false).slice(0, 4).map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <IconBubble tone="info" className="size-8">
                    <Wallet className="size-3.5" />
                  </IconBubble>
                  <span className="truncate">
                    {c.nome}
                    <span className="block text-[10px] text-muted-foreground">
                      {TIPO_CONTA_LABEL[c.tipo] || c.tipo}
                    </span>
                  </span>
                </span>
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    (Number(c.saldo_atual) || 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {brl(Number(c.saldo_atual) || 0)}
                </span>
              </li>
            ))}
            {contas.filter((c) => c.ativo !== false).length === 0 && (
              <li className="py-4 text-sm text-muted-foreground">
                {contas.length === 0 ? 'Nenhuma conta ainda.' : 'Nenhuma conta ativa.'}
              </li>
            )}
          </ul>
        </FinCard>
      </div>
    </div>
  );
}

function AbaLancamentos({
  contas,
  cats,
  clientes,
  membros,
  viewerUserId,
  lancs,
  podeEscrever,
  onChange,
  flash,
  setErro,
}: {
  contas: FinConta[];
  cats: FinCategoria[];
  clientes: ClienteFiltro[];
  membros: Usuario[];
  viewerUserId?: string;
  lancs: FinLancamento[];
  podeEscrever: boolean;
  onChange: () => Promise<void>;
  flash: (m: string) => void;
  setErro: (m: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [edit, setEdit] = useState<FinLancamento | null>(null);
  const [tipoFiltro, setTipoFiltro] = useState<'' | TipoLancamento>('');

  const lista = useMemo(() => {
    if (!tipoFiltro) return lancs;
    return lancs.filter((l) => l.tipo === tipoFiltro);
  }, [lancs, tipoFiltro]);

  return (
    <div className="flex flex-col gap-3">
      <FinCard className="!p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TipoFilterPills value={tipoFiltro} onChange={setTipoFiltro} />
          <div className="flex flex-wrap items-center gap-2">
            {podeEscrever && (
              <Button
                size="sm"
                className="rounded-full bg-info text-background hover:bg-info/90"
                onClick={() => {
                  setEdit(null);
                  setAberto(true);
                }}
              >
                <Plus className="size-4" /> Novo
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {lista.length} lançamento(s) no mês
          {tipoFiltro ? ` · ${tipoFiltro}` : ''}
        </p>
      </FinCard>
      <TabelaLancamentos
        lista={lista}
        podeEscrever={podeEscrever}
        viewerUserId={viewerUserId}
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
          membros={membros}
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
  viewerUserId,
  onChange,
  flash,
  setErro,
}: {
  lista: FinLancamento[];
  podeEscrever: boolean;
  viewerUserId?: string;
  onChange: () => Promise<void>;
  flash: (m: string) => void;
  setErro: (m: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <FinCard className="!p-3">
        <p className="text-sm font-medium">A pagar / receber</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pendentes, previstos e em atraso (todas as datas) · {lista.length} aberto(s)
        </p>
      </FinCard>
      <TabelaLancamentos
        lista={lista}
        podeEscrever={podeEscrever}
        viewerUserId={viewerUserId}
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
  viewerUserId,
  onEdit,
  onDelete,
  onPagar,
  onGerarRec,
}: {
  lista: FinLancamento[];
  podeEscrever: boolean;
  viewerUserId?: string;
  onEdit?: (l: FinLancamento) => void;
  onDelete?: (l: FinLancamento) => void;
  onPagar?: (l: FinLancamento) => void;
  onGerarRec?: (l: FinLancamento) => void;
}) {
  if (!lista.length) {
    return (
      <FinCard className="border-dashed py-10 text-center text-sm text-muted-foreground">
        Nenhum lançamento.
      </FinCard>
    );
  }
  return (
    <FinCard className="!p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Data</th>
              <th className="px-3 py-2.5 font-medium">Descrição</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium text-right">Valor</th>
              <th className="px-3 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lista.map((l) => {
              const ganho = ehGanhoDoMembro(l, viewerUserId);
              const positivo = ganho || l.tipo === 'receita';
              const catNome = l.expand?.categoria?.nome || '';
              return (
              <tr key={l.id} className="hover:bg-secondary/50">
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <IconBubble
                      tone={positivo ? 'ok' : 'danger'}
                      className="size-7"
                    >
                      {positivo ? (
                        <ArrowUpCircle className="size-3.5" />
                      ) : (
                        <ArrowDownCircle className="size-3.5" />
                      )}
                    </IconBubble>
                    {l.data?.slice(0, 10)}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-medium">{l.descricao}</div>
                  <div className="text-xs text-muted-foreground">
                    {ganho ? 'Ganho · ' : ''}
                    {catNome || '—'} · {l.expand?.conta?.nome || '—'}
                    {l.expand?.cliente
                      ? ` · ${nomeCliente(l.expand.cliente)}`
                      : ''}
                    {l.expand?.membro
                      ? ` · ${nomeMembro(l.expand.membro)}`
                      : l.membro
                        ? ` · membro`
                        : ''}
                    {l.recorrencia !== 'unica' ? ` · ${l.recorrencia}` : ''}
                  </div>
                </td>
                <td className="px-3 py-2.5">
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
                    'px-3 py-2.5 text-right font-semibold tabular-nums',
                    positivo ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {positivo ? '+' : '−'}
                  {brl(Number(l.valor) || 0)}
                </td>
                <td className="px-3 py-2.5">
                  {podeEscrever && (
                    <div className="flex justify-end gap-1">
                      {l.status !== 'pago' && onPagar && (
                        <Button
                          size="sm"
                          className="rounded-full bg-info text-background hover:bg-info/90"
                          onClick={() => onPagar(l)}
                        >
                          Pagar
                        </Button>
                      )}
                      {(l.recorrencia === 'fixa' || l.recorrencia === 'recorrente') && onGerarRec && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full"
                          title="Gerar 3 próximas"
                          onClick={() => onGerarRec(l)}
                        >
                          +3
                        </Button>
                      )}
                      {onEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full"
                          onClick={() => onEdit(l)}
                        >
                          Editar
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full"
                          onClick={() => onDelete(l)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </FinCard>
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
  membros,
  inicial,
  onClose,
  onSave,
}: {
  contas: FinConta[];
  cats: FinCategoria[];
  clientes: ClienteFiltro[];
  membros: Usuario[];
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
  const [membro, setMembro] = useState(inicial?.membro || '');
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

  const catAtual = useMemo(
    () => cats.find((c) => c.id === categoria) || null,
    [cats, categoria],
  );
  const isSalario = isCategoriaSalarioProlabore(catAtual);

  const membrosOpts = useMemo(() => {
    const map = new Map(membros.map((m) => [m.id, m]));
    // editar lançamento de membro inativo: mantém opção
    const exp = inicial?.expand?.membro;
    if (inicial?.membro && !map.has(inicial.membro)) {
      map.set(inicial.membro, {
        id: inicial.membro,
        nome: exp?.nome || exp?.nome_completo || 'Membro (inativo)',
        email: exp?.email || '',
        role: (exp?.role as Usuario['role']) || 'Membro',
        status: 'Inativo',
      });
    }
    return [...map.values()];
  }, [membros, inicial]);

  // Ao trocar receita/despesa, escolhe categoria válida (não "Ajuste" se houver melhor).
  useEffect(() => {
    setCategoria((prev) => preferCategoria(cats, tipo, prev));
  }, [tipo, cats]);

  // Categoria salário → força despesa e limpa cliente
  useEffect(() => {
    if (!isSalario) return;
    if (tipo !== 'despesa') setTipo('despesa');
    setCliente('');
  }, [isSalario, tipo]);

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
    const membroF = String(fd.get('membro') || '');
    const dataF = String(fd.get('data') || hojeISO());
    const vencF = String(fd.get('vencimento') || '');
    const statusF = String(fd.get('status') || 'pago') as StatusLancamento;
    const recF = String(fd.get('recorrencia') || 'unica') as RecorrenciaTipo;
    const freqF = String(fd.get('frequencia') || 'mensal') as FrequenciaRecorrencia;
    const obsF = String(fd.get('observacao') || '');
    if (!descF || !contaF || !catF || !(valorF > 0)) return;
    // Garante que a categoria pertence ao tipo escolhido.
    const catObj = cats.find((c) => c.id === catF);
    if (!catObj || catObj.tipo !== tipoF) return;
    const salario = isCategoriaSalarioProlabore(catObj);
    if (salario && !membroF) return;
    setSalvando(true);
    try {
      await onSave({
        tipo: salario ? 'despesa' : tipoF,
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
        cliente: salario ? '' : clienteF,
        membro: salario ? membroF : '',
        projeto: inicial?.projeto || '',
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.65)]"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 className="text-base font-semibold">
          {inicial ? 'Editar lançamento' : 'Novo lançamento'}
        </h2>
        <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => void handleSubmit(e)}>
          <input type="hidden" name="tipo" value={tipo} />
          <div
            className="inline-flex w-full rounded-full border border-border bg-secondary/50 p-0.5"
            role="group"
            aria-label="Tipo do lançamento"
          >
            {(['receita', 'despesa'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  if (isSalario && t === 'receita') return;
                  setTipo(t);
                }}
                className={cn(
                  'flex-1 rounded-full px-3 py-2 text-sm capitalize transition-colors',
                  tipo === t
                    ? t === 'receita'
                      ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                      : 'bg-red-500/20 text-red-400 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                  isSalario && t === 'receita' && 'opacity-40 cursor-not-allowed',
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
          {isSalario ? (
            <Campo label="Membro">
              <Select
                name="membro"
                value={membro}
                onChange={setMembro}
                options={[
                  { v: '', l: '— Selecione o membro —' },
                  ...membrosOpts.map((m) => ({
                    v: m.id,
                    l: nomeMembro(m) || m.email || m.id,
                  })),
                ]}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Sai como despesa no caixa da agência. O membro vê como ganho.
              </p>
              <input type="hidden" name="cliente" value="" />
            </Campo>
          ) : (
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
              <input type="hidden" name="membro" value="" />
            </Campo>
          )}
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
            <Button type="button" variant="ghost" className="rounded-full" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="rounded-full bg-info text-background hover:bg-info/90"
              disabled={
                salvando ||
                !descricao.trim() ||
                !conta ||
                !categoria ||
                !(Number(valor) > 0) ||
                (isSalario && !membro)
              }
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
        <FinCard>
          <p className="mb-3 text-sm font-medium">Nova conta</p>
          <div
            className="mb-3 inline-flex flex-wrap gap-0.5 rounded-full border border-border bg-secondary/50 p-0.5"
            role="group"
            aria-label="Tipo da conta"
          >
            {(Object.keys(TIPO_CONTA_LABEL) as ContaTipo[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  tipo === t
                    ? 'bg-info/20 text-info shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {TIPO_CONTA_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              name="nome_conta"
              className="rounded-full border-border"
              placeholder="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <Input
              name="saldo_inicial"
              className="rounded-full border-border"
              placeholder="Saldo inicial"
              value={saldoIni}
              onChange={(e) => setSaldoIni(e.target.value.replace(',', '.'))}
            />
            <Button
              className="rounded-full bg-info text-background hover:bg-info/90"
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
              <Plus className="size-4" /> Criar
            </Button>
          </div>
        </FinCard>
      )}

      <FinCard className="!p-0 overflow-hidden">
        <ul className="divide-y divide-border">
          {contas.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-3">
                <IconBubble tone={c.ativo === false ? 'neutral' : 'info'} className="size-9">
                  <Wallet className="size-3.5" />
                </IconBubble>
                <span className="min-w-0">
                  <p className="truncate font-medium">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {TIPO_CONTA_LABEL[c.tipo] || c.tipo}
                    {c.ativo === false ? ' · inativa' : ''}
                  </p>
                </span>
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'font-bold tabular-nums',
                    (Number(c.saldo_atual) || 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {brl(Number(c.saldo_atual) || 0)}
                </span>
                {podeEscrever && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full border-border"
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
                      className="rounded-full"
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
          {contas.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma conta ainda.
            </li>
          )}
        </ul>
      </FinCard>

      {podeEscrever && contas.length >= 2 && (
        <FinCard>
          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
            <IconBubble tone="primary" className="size-8">
              <ArrowLeftRight className="size-3.5" />
            </IconBubble>
            Transferência
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
              className="rounded-full border-border"
              placeholder="Valor"
              value={valorTx}
              onChange={(e) => setValorTx(e.target.value.replace(',', '.'))}
            />
            <Button
              type="submit"
              className="rounded-full bg-info text-background hover:bg-info/90"
              disabled={!(Number(valorTx) > 0) || from === to}
            >
              Transferir
            </Button>
          </form>
        </FinCard>
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
  const [tipoNovo, setTipoNovo] = useState<TipoLancamento>('despesa');
  const [tipoView, setTipoView] = useState<TipoLancamento>('despesa');

  return (
    <div className="flex flex-col gap-4">
      {podeEscrever && (
        <FinCard className="flex flex-wrap items-end gap-2 !p-3">
          <Input
            className="max-w-xs rounded-full border-border"
            placeholder="Nova categoria"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Select
            value={tipoNovo}
            onChange={(v) => setTipoNovo(v as TipoLancamento)}
            options={[
              { v: 'receita', l: 'Receita' },
              { v: 'despesa', l: 'Despesa' },
            ]}
          />
          <Button
            className="rounded-full bg-info text-background hover:bg-info/90"
            onClick={async () => {
              try {
                await createCategoria({ nome: nome.trim(), tipo: tipoNovo });
                setNome('');
                flash('Categoria criada');
                await onChange();
              } catch (e) {
                setErro(e instanceof Error ? e.message : 'Erro');
              }
            }}
            disabled={!nome.trim()}
          >
            <Plus className="size-4" /> Nova categoria
          </Button>
        </FinCard>
      )}
      <div className="mb-1">
        <PillTabs
          value={tipoView}
          onChange={setTipoView}
          items={[
            { id: 'despesa' as TipoLancamento, label: 'Despesas' },
            { id: 'receita' as TipoLancamento, label: 'Receitas' },
          ]}
        />
      </div>
      <ul className="flex flex-col gap-2">
        {cats
          .filter((c) => c.tipo === tipoView && !c.arquivada)
          .map((c, i) => (
            <li key={c.id}>
              <FinCard className="flex items-center justify-between !py-3">
                <span className="flex items-center gap-3 min-w-0">
                  <span
                    className="grid size-9 place-items-center rounded-full text-sm font-bold text-white"
                    style={{ background: corCategoria(c.nome, i) }}
                  >
                    {c.nome.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate">
                    <span className="font-medium">{c.nome}</span>
                    {c.sistema ? (
                      <span className="ml-2 text-[10px] text-muted-foreground">sistema</span>
                    ) : null}
                  </span>
                </span>
                {podeEscrever && !c.sistema && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await updateCategoria(c.id, { arquivada: true });
                          await onChange();
                        } catch (e) {
                          setErro(e instanceof Error ? e.message : 'Erro');
                        }
                      }}
                    >
                      Arquivar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm('Excluir categoria?')) return;
                        try {
                          await removeCategoria(c.id);
                          flash('Excluída');
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
              </FinCard>
            </li>
          ))}
      </ul>
      {cats.some((c) => c.tipo === tipoView && c.arquivada) && (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer">Arquivadas</summary>
          <ul className="mt-2 space-y-1">
            {cats
              .filter((c) => c.tipo === tipoView && c.arquivada)
              .map((c) => (
                <li key={c.id} className="flex justify-between px-2">
                  <span>{c.nome}</span>
                  {podeEscrever && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await updateCategoria(c.id, { arquivada: false });
                        await onChange();
                      }}
                    >
                      Restaurar
                    </Button>
                  )}
                </li>
              ))}
          </ul>
        </details>
      )}
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
      className="flex h-10 w-full rounded-full border border-border bg-background/40 px-3 text-sm text-foreground"
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
