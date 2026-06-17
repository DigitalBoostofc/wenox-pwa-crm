import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Building2, FolderKanban, ListChecks, AlarmClock, ArrowRight,
} from 'lucide-react';
import { DadosAgenciaProvider, useDadosAgencia } from './useDadosAgencia';
import { PulsoEquipeBloco, EtapasPendentesBloco, ValidacaoPendenteBloco } from './blocosNegocio';
import { SeletorMeses } from './SeletorMeses';
import { VisaoGeralDesempenho, RankingMembros } from './blocosDesempenho';
import { mesesRecentes } from './relatoriosService';
import type { MesRef } from './relatoriosService';
import { tarefaConcluida } from '@/tarefas/format';
import { prazoVencidoEfetivo } from '@/tarefas/etapas';
import { useAuth } from '@/auth/useAuth';
import { canGerirEquipe } from '@/auth/perms';
import { Button } from '@/components/ui/button';
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

/* -------------------------------------------------------------------------- */
/*  Cockpit do Negócio (Owner / Admin / Gestor)                               */
/* -------------------------------------------------------------------------- */

function CockpitNegocio() {
  const history = useHistory();
  const { user } = useAuth();
  const { tarefas, projetos, clientes, carregando, erro } = useDadosAgencia();
  const [meses, setMeses] = useState<MesRef[]>(() => mesesRecentes(1));

  const abertas = tarefas.filter((t) => !tarefaConcluida(t.status));
  const vencidas = tarefas.filter((t) => prazoVencidoEfetivo(t));
  const projetosAndamento = projetos.filter((p) => p.status && p.status !== 'Inativo');

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">
          {saudacao()}, {primeiroNome(user?.nome, user?.email)}
        </h2>
        <p className="text-sm text-muted-foreground">
          Cockpit da agência — visão geral do negócio.
        </p>
      </div>

      <SeletorMeses selecionados={meses} onChange={setMeses} meses={12} />

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {erro}
        </p>
      )}

      {carregando ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icone={Building2} rotulo="Clientes" valor={clientes.length}
              cor="bg-primary/15 text-primary"
              onClick={() => history.push('/clientes')}
            />
            <KpiCard
              icone={FolderKanban} rotulo="Projetos em andamento" valor={projetosAndamento.length}
              cor="bg-fuchsia-500/15 text-fuchsia-400"
              onClick={() => history.push('/projetos')}
            />
            <KpiCard
              icone={ListChecks} rotulo="Tarefas abertas" valor={abertas.length}
              cor="bg-cyan-500/15 text-cyan-400"
              onClick={() => history.push('/tarefas')}
            />
            <KpiCard
              icone={AlarmClock} rotulo="Tarefas atrasadas" valor={vencidas.length}
              cor="bg-destructive/15 text-destructive" alerta
              onClick={() => history.push('/tarefas')}
            />
          </div>

          <VisaoGeralDesempenho meses={meses} />

          {/* Desempenho por membro | Pulso da Equipe — metade cada */}
          <div className="grid gap-5 lg:grid-cols-2">
            <RankingMembros meses={meses} />
            <PulsoEquipeBloco />
          </div>

          {/* Etapas Pendentes | Validação Pendente */}
          <div className="grid gap-5 lg:grid-cols-2">
            <EtapasPendentesBloco />
            <ValidacaoPendenteBloco />
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Visão Membro / Visualizador                                               */
/* -------------------------------------------------------------------------- */

function VisaoMembro() {
  const history = useHistory();
  const { user } = useAuth();

  return (
    <div className="flex max-w-md flex-col items-center gap-5 py-16 text-center">
      <h2 className="text-2xl font-semibold">
        {saudacao()}, {primeiroNome(user?.nome, user?.email)}
      </h2>
      <p className="text-sm text-muted-foreground">
        Acesse a Minha Área para ver suas tarefas, projetos e dados.
      </p>
      <Button onClick={() => history.push('/minha-area')} className="gap-2">
        Ir para Minha Área <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Página raiz                                                               */
/* -------------------------------------------------------------------------- */

export function DashboardPage() {
  const { user } = useAuth();
  const gestao = canGerirEquipe(user?.role);

  if (!gestao) return <VisaoMembro />;

  return (
    <DadosAgenciaProvider comClientes comUsuarios>
      <CockpitNegocio />
    </DadosAgenciaProvider>
  );
}
