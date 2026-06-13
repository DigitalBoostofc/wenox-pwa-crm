import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Building2, FolderKanban, ListChecks, AlarmClock, Users,
} from 'lucide-react';
import { listTarefas } from '@/tarefas/tarefasService';
import { listUsuarios } from '@/usuarios/usuariosService';
import { carregarDashboard } from '@/dashboard/dashboardService';
import type { ResumoDashboard } from '@/dashboard/dashboardService';
import type { Tarefa } from '@/tarefas/types';
import type { Usuario } from '@/usuarios/types';
import { tarefaConcluida, prazoVencido } from '@/tarefas/format';
import { dataBR } from '@/clientes/format';
import { corAvatar } from '@/clientes/format';
import { TarefaSheet } from '@/tarefas/TarefaSheet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Helper de iniciais                                                         */
/* -------------------------------------------------------------------------- */

function iniciais(n?: string): string {
  const t = (n ?? '?').trim();
  const partes = t.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return t.charAt(0).toUpperCase() || '?';
}

/* -------------------------------------------------------------------------- */
/*  1. PulsoEquipeBloco                                                        */
/* -------------------------------------------------------------------------- */

interface LinhaEquipe {
  id: string;
  nome: string;
  abertas: number;
  atrasadas: number;
}

export function PulsoEquipeBloco() {
  const history = useHistory();
  const [linhas, setLinhas] = useState<LinhaEquipe[]>([]);
  const [semResponsavel, setSemResponsavel] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setCarregando(true);
    Promise.all([listTarefas({}), listUsuarios()])
      .then(([tarefas, usuarios]) => {
        const equipe = (usuarios as Usuario[]).filter(
          (u) => u.role !== 'Cliente' && u.status === 'Ativo',
        );

        const resultado: LinhaEquipe[] = equipe.map((u) => {
          const abertas = tarefas.filter(
            (t) => !tarefaConcluida(t.status) && (t.responsaveis ?? []).includes(u.id),
          );
          const atrasadas = abertas.filter((t) => prazoVencido(t.prazo, t.status)).length;
          return { id: u.id, nome: u.nome ?? u.email ?? u.id, abertas: abertas.length, atrasadas };
        }).filter((l) => l.abertas > 0);

        resultado.sort((a, b) => {
          if (b.atrasadas !== a.atrasadas) return b.atrasadas - a.atrasadas;
          return b.abertas - a.abertas;
        });

        const semResp = tarefas.filter(
          (t) => !tarefaConcluida(t.status)
            && (t.responsaveis ?? []).length === 0
            && t.lado !== 'cliente',
        ).length;

        setLinhas(resultado);
        setSemResponsavel(semResp);
        setErro('');
      })
      .catch(() => setErro('Não foi possível carregar o pulso da equipe.'))
      .finally(() => setCarregando(false));
  }, []);

  function irParaTarefas() {
    try { localStorage.setItem('wenox-tarefas-agrupar-v1', 'responsavel'); } catch { /* */ }
    history.push('/tarefas');
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Pulso da Equipe</h2>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {erro}
        </p>
      )}

      {carregando ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : linhas.length === 0 && semResponsavel === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <Users className="size-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Ninguém tem tarefas abertas. 🎉</p>
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-border/40">
          {linhas.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={irParaTarefas}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
            >
              <div
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white',
                  corAvatar(l.nome),
                )}
              >
                {iniciais(l.nome)}
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.nome}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{l.abertas} abertas</span>
              {l.atrasadas > 0 && (
                <Badge className="shrink-0 border border-destructive/50 bg-destructive/15 text-[10px] text-destructive">
                  {l.atrasadas} atrasada{l.atrasadas !== 1 ? 's' : ''}
                </Badge>
              )}
            </button>
          ))}

          {semResponsavel > 0 && (
            <button
              type="button"
              onClick={irParaTarefas}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
            >
              <div className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-border bg-secondary text-xs text-muted-foreground">
                ⚠
              </div>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
                Sem responsável
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{semResponsavel} abertas</span>
            </button>
          )}
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  2. AprovacoesPendentesBloco                                                */
/* -------------------------------------------------------------------------- */

export function AprovacoesPendentesBloco() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [recarrega, setRecarrega] = useState(0);
  const [erro, setErro] = useState('');
  const [sheetId, setSheetId] = useState<string | null>(null);

  useEffect(() => {
    setCarregando(true);
    listTarefas({})
      .then((res) => {
        const pendentes = res
          .filter(
            (t) =>
              (t.status ?? '').toLowerCase().includes('aprova') &&
              t.aprovacao !== 'aprovada' &&
              !tarefaConcluida(t.status),
          )
          .sort((a, b) => {
            if (!a.prazo && !b.prazo) return 0;
            if (!a.prazo) return 1;
            if (!b.prazo) return -1;
            return a.prazo.localeCompare(b.prazo);
          })
          .slice(0, 8);
        setTarefas(pendentes);
        setErro('');
      })
      .catch(() => setErro('Não foi possível carregar as aprovações.'))
      .finally(() => setCarregando(false));
  }, [recarrega]);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Aprovações Pendentes</h2>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
          {erro}
        </p>
      )}

      {carregando ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : tarefas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <ListChecks className="size-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhuma tarefa aguardando aprovação de cliente.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-border/40">
          {tarefas.map((t) => {
            const cli = t.expand?.cliente;
            const contexto =
              t.expand?.projeto?.nome ??
              cli?.nome_fantasia ??
              cli?.nome;
            const vencida = prazoVencido(t.prazo, t.status);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSheetId(t.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.nome}</p>
                  {contexto && (
                    <p className="truncate text-xs text-muted-foreground">{contexto}</p>
                  )}
                </div>
                {t.prazo && (
                  <span
                    className={cn(
                      'shrink-0 text-xs',
                      vencida ? 'font-medium text-destructive' : 'text-muted-foreground',
                    )}
                  >
                    {dataBR(t.prazo)}
                  </span>
                )}
              </button>
            );
          })}
        </Card>
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
/*  3. PulsoNegocioBloco                                                       */
/* -------------------------------------------------------------------------- */

function StatCardClicavel({
  icone: Icone,
  rotulo,
  valor,
  cor,
  alerta,
  onClick,
}: {
  icone: typeof Building2;
  rotulo: string;
  valor: number;
  cor: string;
  alerta?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40"
    >
      <div className={cn('grid size-11 shrink-0 place-items-center rounded-xl', cor)}>
        <Icone className="size-5" />
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            'text-2xl font-semibold leading-tight',
            alerta && valor > 0 && 'text-destructive',
          )}
        >
          {valor}
        </p>
        <p className="truncate text-xs text-muted-foreground">{rotulo}</p>
      </div>
    </button>
  );
}

export function PulsoNegocioBloco() {
  const history = useHistory();
  const [dados, setDados] = useState<ResumoDashboard | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setCarregando(true);
    carregarDashboard()
      .then((r) => { setDados(r); setErro(''); })
      .catch(() => setErro('Não foi possível carregar os dados do negócio.'))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Pulso do Negócio</h2>

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
      ) : dados ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCardClicavel
              icone={Building2}
              rotulo="Clientes"
              valor={dados.totalClientes}
              cor="bg-primary/15 text-primary"
              onClick={() => history.push('/clientes')}
            />
            <StatCardClicavel
              icone={FolderKanban}
              rotulo="Projetos em andamento"
              valor={dados.projetosAndamento}
              cor="bg-fuchsia-500/15 text-fuchsia-400"
              onClick={() => history.push('/projetos')}
            />
            <StatCardClicavel
              icone={ListChecks}
              rotulo="Tarefas abertas"
              valor={dados.tarefasAbertas}
              cor="bg-cyan-500/15 text-cyan-400"
              onClick={() => history.push('/tarefas')}
            />
            <StatCardClicavel
              icone={AlarmClock}
              rotulo="Atrasadas"
              valor={dados.tarefasVencidas}
              cor="bg-destructive/15 text-destructive"
              alerta
              onClick={() => history.push('/tarefas')}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => history.push('/usuarios')}>
              Usuários
            </Button>
            <Button variant="ghost" size="sm" onClick={() => history.push('/config/parametros')}>
              Parâmetros
            </Button>
            <Button variant="ghost" size="sm" onClick={() => history.push('/equipe')}>
              Equipe
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
