import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { FolderKanban, Pencil, CheckCheck, ChevronDown, ChevronRight, ArrowUp, ArrowDown, Repeat } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { pb } from '@/lib/pocketbase';
import { concluirTarefa, reabrirTarefa } from '@/tarefas/tarefasService';
import type { Usuario } from '@/usuarios/types';
import { tarefaConcluida, prazoVencido, prazoBR } from '@/tarefas/format';
import { temEtapas, aguardandoAprovacaoCliente, ehVezDoUsuario, prazoEfetivo, prazoVencidoEfetivo } from '@/tarefas/etapas';
import type { Tarefa } from '@/tarefas/types';
import { statusConcluido, statusInicial, tarefaEhDoUsuario, usuarioDesignadoPeloStatus } from '@/tarefas/status';
import { MinhaSemanaList, parsePrazo } from '@/tarefas/MinhaSemanaList';
import { EtapasStepper } from '@/tarefas/EtapasStepper';
import { QuickAddTarefa } from '@/tarefas/QuickAddTarefa';
import { TarefaSheet } from '@/tarefas/TarefaSheet';
import { TarefaViewSheet } from '@/tarefas/TarefaViewSheet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useDadosAgencia } from '@/dashboard/useDadosAgencia';
import { desempenhoDoUsuario, mesesRecentes } from '@/dashboard/relatoriosService';
import type { MesRef } from '@/dashboard/relatoriosService';
import { PainelDesempenho, resumoDeMembro } from '@/dashboard/blocosDesempenho';
import { MeusDadosSheet } from './MeusDadosSheet';

/* -------------------------------------------------------------------------- */
/*  1. MeuDiaBloco — helpers                                                  */
/* -------------------------------------------------------------------------- */

function heroPesoPrioridade(p?: string): number {
  if (p === 'alta') return 0;
  if (p === 'baixa') return 2;
  return 1;
}

function HeroIconePrioridade({ prioridade }: { prioridade?: string }) {
  if (prioridade === 'alta')
    return <ArrowUp aria-label="Prioridade alta" className="size-3.5 shrink-0 text-orange-500" />;
  if (prioridade === 'baixa')
    return <ArrowDown aria-label="Prioridade baixa" className="size-3.5 shrink-0 text-muted-foreground/60" />;
  return null;
}

function CardHeroTarefa({
  t,
  onAbrir,
  onConcluir,
  onReabrir,
}: {
  t: Tarefa;
  onAbrir: (id: string) => void;
  onConcluir: (id: string) => Promise<void>;
  onReabrir: (id: string) => Promise<void>;
}) {
  const [otimista, setOtimista] = useState(false);
  const concluida = tarefaConcluida(t.status);
  const vencida = prazoVencidoEfetivo(t);
  const prazoEx = prazoEfetivo(t);
  const resps = (t.expand?.responsaveis ?? []).map((r) => ({
    id: r.id,
    nome: r.nome ?? r.email ?? '—',
    foto: r.foto,
    collectionId: r.collectionId,
    collectionName: r.collectionName,
  }));
  const contexto =
    t.expand?.projeto?.nome ??
    t.expand?.cliente?.nome_fantasia ??
    t.expand?.cliente?.nome ??
    (t.projeto || t.cliente ? undefined : 'Interna');

  async function handleToggle() {
    setOtimista((v) => !v);
    try {
      if (concluida) await onReabrir(t.id);
      else await onConcluir(t.id);
    } catch {
      setOtimista((v) => !v);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAbrir(t.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAbrir(t.id);
        }
      }}
      aria-label={`Abrir tarefa: ${t.nome}`}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card px-4 py-3.5',
        'transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        (concluida || otimista) && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleToggle(); }}
        aria-label={(concluida || otimista) ? 'Reabrir tarefa' : 'Concluir tarefa'}
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          (concluida || otimista)
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-border hover:border-emerald-400',
        )}
      >
        {(concluida || otimista) && (
          <svg viewBox="0 0 10 10" className="size-3 stroke-current" fill="none" strokeWidth={2} aria-hidden="true">
            <polyline points="2,5 4.5,7.5 8,3" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <HeroIconePrioridade prioridade={t.prioridade} />
          <span className={cn('text-sm font-semibold leading-snug', (concluida || otimista) && 'line-through')}>
            {t.nome}
          </span>
        </div>
        {contexto && (
          <span className="block text-xs text-muted-foreground">{contexto}</span>
        )}
        <div className="mt-2">
          <EtapasStepper
            etapas={t.etapas}
            responsaveis={resps}
            variant="compact"
            prazo={t.prazo}
            status={t.status}
          />
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
        {prazoEx && (
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[11px] font-medium',
              vencida
                ? 'bg-destructive/10 text-destructive'
                : 'bg-secondary text-muted-foreground',
            )}
          >
            {prazoBR(prazoEx)}
          </span>
        )}
        {t.recorrencia && (
          <span title={`Repete: ${t.recorrencia}`} aria-label={`Recorrência: ${t.recorrencia}`}>
            <Repeat className="size-3 text-muted-foreground" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  1. MeuDiaBloco                                                             */
/* -------------------------------------------------------------------------- */

export function MeuDiaBloco({ somenteLeitura }: { somenteLeitura?: boolean }) {
  const { user } = useAuth();
  const { tarefas: todasTarefas, carregando, erro: erroGlobal, refresh } = useDadosAgencia();
  const [erro, setErro] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [aguardandoAberta, setAguardandoAberta] = useState(false);
  const [concluidasAberta, setConcluidasAberta] = useState(false);

  const uid = user?.id ?? '';
  // Responsável direto da tarefa OU designado pelo status atual.
  const minhasTarefas = todasTarefas.filter((t) => tarefaEhDoUsuario(t, uid));

  const suaVezAgora = [...minhasTarefas]
    .filter((t) => {
      if (tarefaConcluida(t.status)) return false;
      // Designado pelo status = "sua vez" neste status.
      if (usuarioDesignadoPeloStatus(t, uid)) return true;
      return ehVezDoUsuario(t, uid) || !temEtapas(t);
    })
    .sort((a, b) => {
      const pa = parsePrazo(prazoEfetivo(a))?.getTime() ?? Infinity;
      const pb = parsePrazo(prazoEfetivo(b))?.getTime() ?? Infinity;
      if (pa !== pb) return pa - pb;
      return heroPesoPrioridade(a.prioridade) - heroPesoPrioridade(b.prioridade);
    });

  const aguardando = minhasTarefas.filter(
    (t) =>
      temEtapas(t) &&
      !tarefaConcluida(t.status) &&
      !ehVezDoUsuario(t, uid) &&
      !usuarioDesignadoPeloStatus(t, uid),
  );
  const concluidas = minhasTarefas.filter((t) => tarefaConcluida(t.status));

  async function handleConcluir(id: string) {
    if (somenteLeitura) return;
    try {
      await concluirTarefa(id, statusConcluido());
      refresh();
    } catch (err) {
      setErro('Não foi possível concluir a tarefa.');
      throw err;
    }
  }

  async function handleReabrir(id: string) {
    if (somenteLeitura) return;
    try {
      await reabrirTarefa(id, statusInicial());
      refresh();
    } catch (err) {
      setErro('Não foi possível reabrir a tarefa.');
      throw err;
    }
  }

  const erroExibido = erro || erroGlobal;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Meu Dia</h2>

      {erroExibido && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {erroExibido}
        </p>
      )}

      {!somenteLeitura && (
        <QuickAddTarefa
          onCriada={(id) => { refresh(); setEditId(id); }}
        />
      )}

      {carregando ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : (
        <>
          {/* HERO — Sua vez agora */}
          <section aria-labelledby="sua-vez-heading">
            <h3
              id="sua-vez-heading"
              className="mb-2 px-1 text-sm font-semibold tracking-wide text-foreground"
            >
              Sua vez agora
            </h3>

            {suaVezAgora.length === 0 ? (
              <div
                role="status"
                aria-live="polite"
                className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 px-5 py-10 text-center"
              >
                <CheckCheck className="size-9 text-emerald-500/70" aria-hidden="true" />
                <p className="text-sm font-medium">Tudo em dia!</p>
                <p className="text-xs text-muted-foreground">Nenhuma tarefa aguardando por você agora.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {suaVezAgora.map((t) => (
                  <CardHeroTarefa
                    key={t.id}
                    t={t}
                    onAbrir={(id) => setViewId(id)}
                    onConcluir={handleConcluir}
                    onReabrir={handleReabrir}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Aguardando — colapsível */}
          {aguardando.length > 0 && (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                aria-expanded={aguardandoAberta}
                onClick={() => setAguardandoAberta((v) => !v)}
                className="flex items-center gap-2 px-1 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
              >
                {aguardandoAberta ? (
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                ) : (
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                )}
                Aguardando
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold">
                  {aguardando.length}
                </span>
              </button>
              {aguardandoAberta && (
                <MinhaSemanaList
                  tarefas={aguardando}
                  onAbrir={(id) => setViewId(id)}
                  onConcluir={(id) => { handleConcluir(id).catch(() => {}); }}
                  onReabrir={(id) => { handleReabrir(id).catch(() => {}); }}
                  agrupar="prazo"
                />
              )}
            </div>
          )}

          {/* Concluídas — colapsível */}
          {concluidas.length > 0 && (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                aria-expanded={concluidasAberta}
                onClick={() => setConcluidasAberta((v) => !v)}
                className="flex items-center gap-2 px-1 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
              >
                {concluidasAberta ? (
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                ) : (
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                )}
                Concluídas
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold">
                  {concluidas.length}
                </span>
              </button>
              {concluidasAberta && (
                <MinhaSemanaList
                  tarefas={concluidas}
                  onAbrir={(id) => setViewId(id)}
                  onConcluir={(id) => { handleConcluir(id).catch(() => {}); }}
                  onReabrir={(id) => { handleReabrir(id).catch(() => {}); }}
                  agrupar="prazo"
                />
              )}
            </div>
          )}
        </>
      )}

      <TarefaViewSheet
        tarefaId={viewId}
        aberto={viewId !== null}
        onClose={() => setViewId(null)}
        onMudou={() => refresh()}
        somenteLeitura={somenteLeitura}
      />

      <TarefaSheet
        tarefaId={editId}
        aberto={editId !== null}
        onClose={() => setEditId(null)}
        onMudou={() => refresh()}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  2. MeusProjetosBloco                                                       */
/* -------------------------------------------------------------------------- */

export function MeusProjetosBloco() {
  const { user } = useAuth();
  const history = useHistory();
  const { projetos: todosProjetos, carregando, erro } = useDadosAgencia();

  const projetos = todosProjetos.filter(
    (p) => (p.responsaveis ?? []).includes(user?.id ?? '')
      && p.status && p.status !== 'Inativo',
  );

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Meus Projetos</h2>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {erro}
        </p>
      )}

      {carregando ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full rounded-md" />
          <Skeleton className="h-14 w-full rounded-md" />
          <Skeleton className="h-14 w-full rounded-md" />
        </div>
      ) : projetos.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <FolderKanban className="size-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Você não está em nenhum projeto.</p>
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-border/40">
          {projetos.map((p) => {
            const cli = p.expand?.cliente;
            const nomeCliente = cli?.nome_fantasia ?? cli?.nome;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => history.push(`/projetos/${p.id}`)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.nome}</p>
                  {nomeCliente && (
                    <p className="truncate text-xs text-muted-foreground">{nomeCliente}</p>
                  )}
                </div>
                {p.etapa && (
                  <Badge className="shrink-0 border border-border bg-secondary text-[10px] text-muted-foreground">
                    {p.etapa}
                  </Badge>
                )}
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  3. MinhaProdutividadeBloco                                                 */
/* -------------------------------------------------------------------------- */

const MESES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
function rotuloMesFull(m: MesRef): string {
  return `${MESES_FULL[m.mes - 1]} ${m.ano}`;
}

export function MinhaProdutividadeBloco() {
  const { user } = useAuth();
  const { tarefas, carregando, erro } = useDadosAgencia();

  // Mês atual + 2 anteriores (mais recente primeiro).
  const opcoesMes = [...mesesRecentes(3)].reverse();
  const [sel, setSel] = useState<MesRef>(opcoesMes[0]);

  const nome = user?.nome || user?.email || '';
  const d = desempenhoDoUsuario(user?.id ?? '', nome, tarefas, [sel]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Minha Produtividade</h2>
        <select
          value={`${sel.ano}-${sel.mes}`}
          onChange={(e) => {
            const [a, m] = e.target.value.split('-').map(Number);
            setSel({ ano: a, mes: m });
          }}
          className="h-8 rounded-md border border-input bg-background/40 px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {opcoesMes.map((m) => (
            <option key={`${m.ano}-${m.mes}`} value={`${m.ano}-${m.mes}`}>{rotuloMesFull(m)}</option>
          ))}
        </select>
      </div>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {erro}
        </p>
      )}

      {carregando ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <Card className="p-4">
          <PainelDesempenho resumo={resumoDeMembro(d)} />
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  4. MeusDadosBloco                                                          */
/* -------------------------------------------------------------------------- */

function LinhaDado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{rotulo}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{valor}</span>
    </div>
  );
}

export function MeusDadosBloco() {
  const { user } = useAuth();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [recarrega, setRecarrega] = useState(0);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setCarregando(true);
    pb.collection('usuarios')
      .getOne(user.id)
      .then((r) => { setUsuario(r as unknown as Usuario); })
      .catch(() => null)
      .finally(() => setCarregando(false));
  }, [user?.id, recarrega]);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Meus Dados</h2>

      {carregando ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-full rounded-md" />
          <Skeleton className="h-5 w-full rounded-md" />
          <Skeleton className="h-5 w-3/4 rounded-md" />
        </div>
      ) : (
        <Card className="flex flex-col gap-3 p-4">
          <LinhaDado rotulo="E-mail"      valor={usuario?.email ?? user?.email ?? '—'} />
          <LinhaDado rotulo="Telefone"    valor={usuario?.telefone || '—'} />
          <LinhaDado rotulo="Chave Pix"   valor={usuario?.chave_pix || '—'} />
          <LinhaDado rotulo="Endereço"    valor={usuario?.endereco || '—'} />

          <Button
            variant="outline"
            size="sm"
            className="mt-1 w-fit gap-2"
            onClick={() => setAberto(true)}
          >
            <Pencil className="size-3.5" />
            Editar meus dados
          </Button>
        </Card>
      )}

      <MeusDadosSheet
        aberto={aberto}
        onClose={() => setAberto(false)}
        onSalvo={() => { setRecarrega((n) => n + 1); setAberto(false); }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  5. MinhasAprovacoesBloco — tarefas MINHAS aguardando aprovação do cliente  */
/* -------------------------------------------------------------------------- */

function aguardandoCliente(t: Tarefa): boolean {
  if (temEtapas(t)) return aguardandoAprovacaoCliente(t) && t.aprovacao !== 'alteracao';
  return (t.status ?? '').toLowerCase().includes('aprova') && t.aprovacao !== 'aprovada' && !tarefaConcluida(t.status);
}

export function MinhasAprovacoesBloco() {
  const { user } = useAuth();
  const { tarefas, carregando, refresh } = useDadosAgencia();
  const [viewId, setViewId] = useState<string | null>(null);

  const minhas = tarefas
    .filter((t) => tarefaEhDoUsuario(t, user?.id) && aguardandoCliente(t))
    .sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Aprovações Pendentes</h2>

      {carregando ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      ) : minhas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
            <CheckCheck className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhuma tarefa sua aguardando aprovação do cliente.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-border/40">
          {minhas.map((t) => {
            const cli = t.expand?.cliente;
            const contexto = t.expand?.projeto?.nome ?? cli?.nome_fantasia ?? cli?.nome;
            const vencida = prazoVencido(t.prazo, t.status);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setViewId(t.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.nome}</p>
                  {contexto && (
                    <p className="truncate text-xs text-muted-foreground">{contexto}</p>
                  )}
                </div>
                {t.prazo && (
                  <span className={cn(
                    'shrink-0 text-xs',
                    vencida ? 'font-medium text-destructive' : 'text-muted-foreground',
                  )}>
                    {prazoBR(t.prazo)}
                  </span>
                )}
              </button>
            );
          })}
        </Card>
      )}

      <TarefaViewSheet
        tarefaId={viewId}
        aberto={viewId !== null}
        onClose={() => setViewId(null)}
        onMudou={() => refresh()}
      />
    </div>
  );
}
