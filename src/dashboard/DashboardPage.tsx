import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Building2, FolderKanban, ListChecks, AlarmClock, CheckCircle2,
  ArrowRight, CalendarDays,
} from 'lucide-react';
import { carregarDashboard } from './dashboardService';
import type { ResumoDashboard } from './dashboardService';
import type { Tarefa } from '@/tarefas/types';
import { statusTarefaClass, prazoVencido } from '@/tarefas/format';
import { useAuth } from '@/auth/useAuth';
import { dataBR } from '@/clientes/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function primeiroNome(nome?: string, email?: string): string {
  const base = (nome ?? '').trim() || (email ?? '').split('@')[0];
  return base.split(/\s+/)[0] || 'por aqui';
}

function KpiCard({
  icone: Icone, rotulo, valor, cor, onClick, alerta,
}: {
  icone: typeof Building2;
  rotulo: string;
  valor: number;
  cor: string;
  onClick: () => void;
  alerta?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
    >
      <div className={cn('grid size-11 shrink-0 place-items-center rounded-xl', cor)}>
        <Icone className="size-5" />
      </div>
      <div className="min-w-0">
        <p className={cn(
          'text-2xl font-semibold leading-tight',
          alerta && valor > 0 && 'text-destructive',
        )}>
          {valor}
        </p>
        <p className="truncate text-xs text-muted-foreground">{rotulo}</p>
      </div>
    </button>
  );
}

function LinhaTarefa({ t, onClick }: { t: Tarefa; onClick: () => void }) {
  const cli = t.expand?.cliente;
  const cliNome = cli?.nome?.trim() || cli?.nome_fantasia || '';
  const vencida = prazoVencido(t.prazo, t.status);
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-border px-5 py-3 text-left transition-colors last:border-0 hover:bg-secondary/50"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{t.nome}</p>
        <p className="truncate text-xs text-muted-foreground">
          {t.expand?.projeto?.nome ?? (cliNome || 'Tarefa interna')}
        </p>
      </div>
      {t.prazo && (
        <span className={cn(
          'flex shrink-0 items-center gap-1 text-xs',
          vencida ? 'font-medium text-destructive' : 'text-muted-foreground',
        )}>
          <CalendarDays className="size-3.5" />
          {dataBR(t.prazo)}
        </span>
      )}
      {t.status && (
        <Badge className={cn('shrink-0 border text-[10px]', statusTarefaClass(t.status))}>
          {t.status}
        </Badge>
      )}
    </button>
  );
}

export function DashboardPage() {
  const history = useHistory();
  const { user } = useAuth();
  const [r, setR] = useState<ResumoDashboard | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    carregarDashboard()
      .then(setR)
      .catch(() => setErro('Não foi possível carregar o painel.'));
  }, []);

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <div>
        <h2 className="text-2xl font-semibold">
          {saudacao()}, {primeiroNome(user?.nome, user?.email)} 👋
        </h2>
        <p className="text-sm text-muted-foreground">
          Aqui está o resumo da agência hoje.
        </p>
      </div>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {erro}
        </p>
      )}

      {!r ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icone={Building2} rotulo="Clientes" valor={r.totalClientes}
              cor="bg-primary/15 text-primary"
              onClick={() => history.push('/clientes')}
            />
            <KpiCard
              icone={FolderKanban} rotulo="Projetos em andamento" valor={r.projetosAndamento}
              cor="bg-fuchsia-500/15 text-fuchsia-400"
              onClick={() => history.push('/projetos')}
            />
            <KpiCard
              icone={ListChecks} rotulo="Tarefas abertas" valor={r.tarefasAbertas}
              cor="bg-cyan-500/15 text-cyan-400"
              onClick={() => history.push('/tarefas')}
            />
            <KpiCard
              icone={AlarmClock} rotulo="Tarefas vencidas" valor={r.tarefasVencidas}
              cor="bg-destructive/15 text-destructive" alerta
              onClick={() => history.push('/tarefas')}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-amber-400" />
                  Aguardando aprovação do cliente
                  <Badge variant="muted" className="text-[10px]">
                    {r.aguardandoAprovacao.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {r.aguardandoAprovacao.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Nada aguardando aprovação. 🎉
                  </p>
                ) : (
                  r.aguardandoAprovacao.map((t) => (
                    <LinhaTarefa key={t.id} t={t} onClick={() => history.push(`/tarefas/${t.id}`)} />
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="size-4 text-primary" />
                  Minhas tarefas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {r.minhasTarefas.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Você não tem tarefas abertas.
                  </p>
                ) : (
                  <>
                    {r.minhasTarefas.map((t) => (
                      <LinhaTarefa key={t.id} t={t} onClick={() => history.push(`/tarefas/${t.id}`)} />
                    ))}
                    <button
                      onClick={() => history.push('/tarefas')}
                      className="flex w-full items-center justify-center gap-1.5 px-5 py-3 text-xs font-medium text-primary hover:bg-secondary/50"
                    >
                      Ver todas as tarefas <ArrowRight className="size-3.5" />
                    </button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
