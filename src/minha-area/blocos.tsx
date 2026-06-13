import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { ListChecks, FolderKanban, CheckCircle2, AlarmClock, ClipboardList } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { listTarefas, concluirTarefa, reabrirTarefa } from '@/tarefas/tarefasService';
import { listProjetos } from '@/projetos/projetosService';
import type { Tarefa } from '@/tarefas/types';
import type { Projeto } from '@/projetos/types';
import { tarefaConcluida, prazoVencido } from '@/tarefas/format';
import { STATUS_CONCLUIDO, STATUS_INICIAL } from '@/tarefas/status';
import { MinhaSemanaList } from '@/tarefas/MinhaSemanaList';
import { QuickAddTarefa } from '@/tarefas/QuickAddTarefa';
import { TarefaSheet } from '@/tarefas/TarefaSheet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Helpers de semana (sem desvio de fuso — usa partes locais)                */
/* -------------------------------------------------------------------------- */

function inicioSemana(): Date {
  const hoje = new Date();
  const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dow = dia.getDay(); // 0=dom, 1=seg, ...
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
  // updated vem como datetime ISO do PocketBase
  const d = new Date(dataStr);
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return local >= inicioSemana() && local <= fimSemana();
}

/* -------------------------------------------------------------------------- */
/*  1. MeuDiaBloco                                                             */
/* -------------------------------------------------------------------------- */

export function MeuDiaBloco({ somenteLeitura }: { somenteLeitura?: boolean }) {
  const { user } = useAuth();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [recarrega, setRecarrega] = useState(0);
  const [erro, setErro] = useState('');
  const [sheetId, setSheetId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    setCarregando(true);
    listTarefas({ responsavelId: user.id })
      .then((res) => { setTarefas(res); setErro(''); })
      .catch(() => setErro('Não foi possível carregar as tarefas.'))
      .finally(() => setCarregando(false));
  }, [user?.id, recarrega]);

  async function handleConcluir(id: string) {
    if (somenteLeitura) return;
    setTarefas((lst) => lst.map((t) => (t.id === id ? { ...t, status: STATUS_CONCLUIDO } : t)));
    try {
      await concluirTarefa(id, STATUS_CONCLUIDO);
      setRecarrega((n) => n + 1);
    } catch {
      setErro('Não foi possível concluir a tarefa.');
      setRecarrega((n) => n + 1);
    }
  }

  async function handleReabrir(id: string) {
    if (somenteLeitura) return;
    setTarefas((lst) => lst.map((t) => (t.id === id ? { ...t, status: STATUS_INICIAL } : t)));
    try {
      await reabrirTarefa(id, STATUS_INICIAL);
      setRecarrega((n) => n + 1);
    } catch {
      setErro('Não foi possível reabrir a tarefa.');
      setRecarrega((n) => n + 1);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Meu Dia</h2>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {erro}
        </p>
      )}

      {!somenteLeitura && (
        <QuickAddTarefa
          onCriada={(id) => { setRecarrega((n) => n + 1); setSheetId(id); }}
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
          tarefas={tarefas}
          onAbrir={(id) => setSheetId(id)}
          onConcluir={handleConcluir}
          onReabrir={handleReabrir}
          agrupar="prazo"
        />
      )}

      <TarefaSheet
        tarefaId={sheetId}
        aberto={sheetId !== null}
        onClose={() => setSheetId(null)}
        onMudou={() => setRecarrega((n) => n + 1)}
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
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setCarregando(true);
    listProjetos()
      .then((res) => {
        setProjetos(res.filter((p) => (p.responsaveis ?? []).includes(user?.id ?? '')));
        setErro('');
      })
      .catch(() => setErro('Não foi possível carregar os projetos.'))
      .finally(() => setCarregando(false));
  }, [user?.id]);

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
  icone: typeof ListChecks;
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
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    setCarregando(true);
    listTarefas({ responsavelId: user.id })
      .then((res) => { setTarefas(res); setErro(''); })
      .catch(() => setErro('Não foi possível carregar as estatísticas.'))
      .finally(() => setCarregando(false));
  }, [user?.id]);

  const concluidas = tarefas.filter(
    (t) => tarefaConcluida(t.status) && dentroSemana(t.updated),
  ).length;

  const abertas = tarefas.filter((t) => !tarefaConcluida(t.status)).length;

  const atrasadas = tarefas.filter((t) => prazoVencido(t.prazo, t.status)).length;

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
