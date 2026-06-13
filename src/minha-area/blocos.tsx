import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { FolderKanban, CheckCircle2, AlarmClock, ClipboardList, Pencil, CheckCheck } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { pb } from '@/lib/pocketbase';
import { concluirTarefa, reabrirTarefa } from '@/tarefas/tarefasService';
import type { Usuario } from '@/usuarios/types';
import { tarefaConcluida, prazoVencido, prazoBR } from '@/tarefas/format';
import { STATUS_CONCLUIDO, STATUS_INICIAL } from '@/tarefas/status';
import { MinhaSemanaList } from '@/tarefas/MinhaSemanaList';
import { QuickAddTarefa } from '@/tarefas/QuickAddTarefa';
import { TarefaSheet } from '@/tarefas/TarefaSheet';
import { TarefaViewSheet } from '@/tarefas/TarefaViewSheet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useDadosAgencia } from '@/dashboard/useDadosAgencia';
import { MeusDadosSheet } from './MeusDadosSheet';

/* -------------------------------------------------------------------------- */
/*  Helpers de semana (sem desvio de fuso — usa partes locais)                */
/* -------------------------------------------------------------------------- */

function inicioSemana(): Date {
  const hoje = new Date();
  const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dow = dia.getDay();
  const offsetSegunda = dow === 0 ? -6 : 1 - dow;
  dia.setDate(dia.getDate() + offsetSegunda);
  return dia;
}

function fimSemana(): Date {
  const seg = inicioSemana();
  seg.setDate(seg.getDate() + 6);
  return seg;
}

function dentroSemana(dataStr?: string): boolean {
  if (!dataStr) return false;
  const d = new Date(dataStr);
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return local >= inicioSemana() && local <= fimSemana();
}

/* -------------------------------------------------------------------------- */
/*  1. MeuDiaBloco                                                             */
/* -------------------------------------------------------------------------- */

export function MeuDiaBloco({ somenteLeitura }: { somenteLeitura?: boolean }) {
  const { user } = useAuth();
  const { tarefas: todasTarefas, carregando, erro: erroGlobal, refresh } = useDadosAgencia();
  const [erro, setErro] = useState('');
  /** Clique numa tarefa existente → painel de visualização (somente leitura). */
  const [viewId, setViewId] = useState<string | null>(null);
  /** Quick-add → painel de edição da tarefa recém-criada (preencher detalhes). */
  const [editId, setEditId] = useState<string | null>(null);

  const minhasTarefas = todasTarefas.filter(
    (t) => (t.responsaveis ?? []).includes(user?.id ?? ''),
  );

  async function handleConcluir(id: string) {
    if (somenteLeitura) return;
    try {
      await concluirTarefa(id, STATUS_CONCLUIDO);
      refresh();
    } catch {
      setErro('Não foi possível concluir a tarefa.');
    }
  }

  async function handleReabrir(id: string) {
    if (somenteLeitura) return;
    try {
      await reabrirTarefa(id, STATUS_INICIAL);
      refresh();
    } catch {
      setErro('Não foi possível reabrir a tarefa.');
    }
  }

  const erroExibido = erro || erroGlobal;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Meu Dia</h2>

      {erroExibido && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
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
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      ) : (
        <MinhaSemanaList
          tarefas={minhasTarefas}
          onAbrir={(id) => setViewId(id)}
          onConcluir={handleConcluir}
          onReabrir={handleReabrir}
          agrupar="prazo"
        />
      )}

      {/* Clique numa tarefa: visualização (leitura + checklist + status) */}
      <TarefaViewSheet
        tarefaId={viewId}
        aberto={viewId !== null}
        onClose={() => setViewId(null)}
        onMudou={() => refresh()}
        somenteLeitura={somenteLeitura}
      />

      {/* Quick-add: edição completa da tarefa recém-criada */}
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
    (p) => (p.responsaveis ?? []).includes(user?.id ?? ''),
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

function StatCard({
  icone: Icone,
  rotulo,
  valor,
  cor,
  alerta,
}: {
  icone: typeof CheckCircle2;
  rotulo: string;
  valor: number;
  cor: string;
  alerta?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      <div className={cn('grid size-11 shrink-0 place-items-center rounded-xl', cor)}>
        <Icone className="size-5" />
      </div>
      <div className="min-w-0">
        <p className={cn('text-2xl font-semibold leading-tight', alerta && valor > 0 && 'text-destructive')}>
          {valor}
        </p>
        <p className="truncate text-xs text-muted-foreground">{rotulo}</p>
      </div>
    </div>
  );
}

export function MinhaProdutividadeBloco() {
  const { user } = useAuth();
  const { tarefas: todasTarefas, carregando, erro } = useDadosAgencia();

  const minhasTarefas = todasTarefas.filter(
    (t) => (t.responsaveis ?? []).includes(user?.id ?? ''),
  );

  const concluidas = minhasTarefas.filter(
    (t) => tarefaConcluida(t.status) && dentroSemana(t.updated),
  ).length;

  const abertas = minhasTarefas.filter((t) => !tarefaConcluida(t.status)).length;

  const atrasadas = minhasTarefas.filter((t) => prazoVencido(t.prazo, t.status)).length;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Minha Produtividade</h2>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {erro}
        </p>
      )}

      {carregando ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icone={CheckCircle2}
            rotulo="Concluídas na semana"
            valor={concluidas}
            cor="bg-emerald-500/15 text-emerald-400"
          />
          <StatCard
            icone={ClipboardList}
            rotulo="Abertas"
            valor={abertas}
            cor="bg-cyan-500/15 text-cyan-400"
          />
          <StatCard
            icone={AlarmClock}
            rotulo="Atrasadas"
            valor={atrasadas}
            cor="bg-destructive/15 text-destructive"
            alerta
          />
        </div>
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

export function MinhasAprovacoesBloco() {
  const { user } = useAuth();
  const { tarefas, carregando, refresh } = useDadosAgencia();
  const [viewId, setViewId] = useState<string | null>(null);

  const minhas = tarefas
    .filter(
      (t) =>
        (t.responsaveis ?? []).includes(user?.id ?? '') &&
        (t.status ?? '').toLowerCase().includes('aprova') &&
        t.aprovacao !== 'aprovada' &&
        !tarefaConcluida(t.status),
    )
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
