import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  Users, ListChecks, FolderKanban, ArrowRight,
} from 'lucide-react';
import { useDadosAgencia } from './useDadosAgencia';
import { tarefaConcluida, prazoVencido, prazoLimite, statusTarefaClass, prazoBR } from '@/tarefas/format';
import { temEtapas, aguardandoAprovacaoCliente, etapaAtual, prazoVencidoEfetivo, prazoEfetivo } from '@/tarefas/etapas';
import type { Tarefa } from '@/tarefas/types';
import { dataBR, inicial, corAvatar } from '@/clientes/format';
import { logoUrl } from '@/clientes/clientesService';
import { AvatarMembro } from './AvatarMembro';
import { EtapasStepper } from '@/tarefas/EtapasStepper';
import { TarefaSheet } from '@/tarefas/TarefaSheet';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Saúde dos Projetos                                                        */
/* -------------------------------------------------------------------------- */

interface ClienteLogo {
  id: string;
  collectionId?: string;
  collectionName?: string;
  nome?: string;
  nome_fantasia?: string;
  logo?: string;
}

interface LinhaProjeto {
  id: string;
  projetoNome: string;
  clienteNome: string;
  cli?: ClienteLogo;
  abertas: number;
  atrasadas: number;
}

export function SaudeProjetosBloco() {
  const history = useHistory();
  const { tarefas, projetos, carregando } = useDadosAgencia();

  if (carregando) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Saúde dos Projetos</h2>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const ativos = projetos.filter((p) => p.status && p.status !== 'Inativo');

  const linhas: LinhaProjeto[] = ativos.map((p) => {
    const doProj = tarefas.filter(
      (t) => t.expand?.projeto?.id === p.id || t.projeto === p.id,
    );
    const abertas = doProj.filter((t) => !tarefaConcluida(t.status));
    const atrasadas = abertas.filter((t) => prazoVencido(t.prazo, t.status));
    const cli = p.expand?.cliente;
    const clienteNome = cli?.nome_fantasia ?? cli?.nome ?? 'Sem cliente';
    return {
      id: p.id,
      projetoNome: p.nome,
      clienteNome,
      cli,
      abertas: abertas.length,
      atrasadas: atrasadas.length,
    };
  }).filter((l) => l.abertas > 0);

  linhas.sort((a, b) => {
    if (b.atrasadas !== a.atrasadas) return b.atrasadas - a.atrasadas;
    return b.abertas - a.abertas;
  });

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Saúde dos Projetos</h2>

      {linhas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <FolderKanban className="size-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum projeto ativo com tarefas abertas.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-border/40">
          {linhas.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => history.push(`/projetos/${l.id}`)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
            >
              {l.cli?.logo ? (
                <img
                  src={logoUrl(l.cli as never, '100x100')}
                  alt={l.clienteNome}
                  loading="lazy"
                  decoding="async"
                  className="size-9 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className={cn('grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold text-white', corAvatar(l.clienteNome))}>
                  {inicial(l.clienteNome)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.clienteNome}</p>
                <p className="truncate text-xs text-muted-foreground">{l.projetoNome}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {l.abertas} abertas
              </span>
              {l.atrasadas > 0 && (
                <Badge className="shrink-0 border border-destructive/50 bg-destructive/15 text-[10px] text-destructive">
                  {l.atrasadas} atrasada{l.atrasadas !== 1 ? 's' : ''}
                </Badge>
              )}
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pulso da Equipe                                                           */
/* -------------------------------------------------------------------------- */

interface LinhaEquipe {
  id: string;
  nome: string;
  foto?: string;
  collectionId?: string;
  collectionName?: string;
  abertas: number;
  atrasadas: number;
}

export function PulsoEquipeBloco() {
  const history = useHistory();
  const { tarefas, usuarios, carregando } = useDadosAgencia();

  if (carregando) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Pulso da Equipe</h2>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const equipe = usuarios.filter(
    (u) => u.role !== 'Cliente' && u.status === 'Ativo',
  );

  const linhas: LinhaEquipe[] = equipe
    .map((u) => {
      const abertas = tarefas.filter(
        (t) => !tarefaConcluida(t.status) && (t.responsaveis ?? []).includes(u.id),
      );
      const atrasadas = abertas.filter((t) => {
        if (!prazoVencidoEfetivo(t)) return false;
        if (temEtapas(t)) return etapaAtual(t.etapas)?.responsavel === u.id;
        return true;
      }).length;
      return {
        id: u.id,
        nome: u.nome ?? u.email ?? u.id,
        foto: u.foto,
        collectionId: u.collectionId,
        collectionName: u.collectionName,
        abertas: abertas.length,
        atrasadas,
      };
    })
    .filter((l) => l.abertas > 0);

  linhas.sort((a, b) => {
    if (b.atrasadas !== a.atrasadas) return b.atrasadas - a.atrasadas;
    return b.abertas - a.abertas;
  });

  const semResponsavel = tarefas.filter(
    (t) =>
      !tarefaConcluida(t.status) &&
      (t.responsaveis ?? []).length === 0 &&
      t.lado !== 'cliente',
  ).length;

  function irParaTarefas() {
    try { localStorage.setItem('wenox-tarefas-agrupar-v1', 'responsavel'); } catch { /* */ }
    history.push('/tarefas');
  }

  // Clica num membro → página de Tarefas filtrada por ele, só as não concluídas.
  function irParaMembro(id: string, nome: string) {
    history.push(`/tarefas?responsavel=${id}&nome=${encodeURIComponent(nome)}&abertas=1`);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <h2 className="text-lg font-semibold">Pulso da Equipe</h2>

      {linhas.length === 0 && semResponsavel === 0 ? (
        <Card className="flex-1">
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <Users className="size-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Ninguém tem tarefas abertas.</p>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-1 flex-col divide-y divide-border/40">
          {linhas.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => irParaMembro(l.id, l.nome)}
              className="flex w-full flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
            >
              <AvatarMembro membro={l} />
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
              className="flex w-full flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
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
/*  Etapas Pendentes / Validação Pendente                                     */
/* -------------------------------------------------------------------------- */

/** Data da etapa com cor por urgência. */
function dataCor(prazo?: string): { txt: string; cls: string } | null {
  if (!prazo) return null;
  const lim = prazoLimite(prazo);
  if (!lim) return null;
  let cls = 'text-muted-foreground';
  if (lim.getTime() < Date.now()) cls = 'font-medium text-destructive';
  else {
    const h = new Date(); h.setHours(0, 0, 0, 0);
    const d = new Date(lim); d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - h.getTime()) / 86400000);
    if (diff === 0) cls = 'font-medium text-yellow-500';
    else if (diff === 1) cls = 'font-medium text-orange-500';
  }
  return { txt: dataBR(prazo), cls };
}

function contextoTarefa(t: Tarefa): string | undefined {
  return t.expand?.projeto?.nome ?? t.expand?.cliente?.nome_fantasia ?? t.expand?.cliente?.nome;
}

/** Etapas internas pendentes (a vez de algum membro) — de todos. */
export function EtapasPendentesBloco() {
  const { tarefas, carregando, refresh } = useDadosAgencia();
  const [sheetId, setSheetId] = useState<string | null>(null);

  const linhas = tarefas
    .filter((t) => temEtapas(t) && !tarefaConcluida(t.status))
    .map((t) => ({ t, etapa: etapaAtual(t.etapas) }))
    .filter((r): r is { t: Tarefa; etapa: NonNullable<typeof r.etapa> } => !!r.etapa && r.etapa.tipo === 'interna')
    .sort((a, b) => (prazoLimite(a.etapa.prazo)?.getTime() ?? Infinity) - (prazoLimite(b.etapa.prazo)?.getTime() ?? Infinity));

  if (carregando) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Etapas Pendentes</h2>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Etapas Pendentes</h2>
      {linhas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <ListChecks className="size-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma etapa pendente com a equipe.</p>
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-border/40">
          {linhas.map(({ t, etapa }) => {
            const resp = (t.expand?.responsaveis ?? []).find((r) => r.id === etapa.responsavel);
            const data = dataCor(etapa.prazo);
            return (
              <button key={t.id} type="button" onClick={() => setSheetId(t.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50">
                {resp
                  ? <AvatarMembro membro={{ id: resp.id, nome: resp.nome ?? '', foto: resp.foto, collectionId: resp.collectionId, collectionName: resp.collectionName }} />
                  : <div className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-border bg-secondary text-xs text-muted-foreground">?</div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {etapa.texto}{resp ? ` · ${resp.nome ?? resp.email ?? ''}` : ' · sem responsável'}
                  </p>
                </div>
                {data && <span className={cn('shrink-0 text-xs', data.cls)}>{data.txt}</span>}
              </button>
            );
          })}
        </Card>
      )}
      <TarefaSheet tarefaId={sheetId} aberto={sheetId !== null} onClose={() => setSheetId(null)} onMudou={() => refresh()} />
    </div>
  );
}

/** Etapas aguardando validação do cliente — com prazo e etiqueta. */
export function ValidacaoPendenteBloco() {
  const { tarefas, carregando, refresh } = useDadosAgencia();
  const [sheetId, setSheetId] = useState<string | null>(null);

  const linhas = tarefas
    .filter((t) => temEtapas(t) && !tarefaConcluida(t.status) && aguardandoAprovacaoCliente(t))
    .map((t) => ({ t, etapa: etapaAtual(t.etapas) }))
    .filter((r): r is { t: Tarefa; etapa: NonNullable<typeof r.etapa> } => !!r.etapa)
    .sort((a, b) => (prazoLimite(a.etapa.prazo)?.getTime() ?? Infinity) - (prazoLimite(b.etapa.prazo)?.getTime() ?? Infinity));

  if (carregando) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Validação Pendente</h2>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Validação Pendente</h2>
      {linhas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <ListChecks className="size-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma etapa aguardando validação do cliente.</p>
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-border/40">
          {linhas.map(({ t, etapa }) => {
            const data = dataCor(etapa.prazo);
            const cli = t.expand?.cliente;
            const cliNome = cli?.nome_fantasia ?? cli?.nome ?? 'Sem cliente';
            return (
              <button key={t.id} type="button" onClick={() => setSheetId(t.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50">
                {cli?.logo ? (
                  <img src={logoUrl(cli as never, '100x100')} alt={cliNome} loading="lazy"
                    className="size-8 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className={cn('grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white', corAvatar(cliNome))}>
                    {inicial(cliNome)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.nome}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {contextoTarefa(t) && <span className="truncate text-xs text-muted-foreground">{contextoTarefa(t)}</span>}
                    {(t.etiquetas ?? []).slice(0, 3).map((e) => (
                      <Badge key={e} variant="muted" className="text-[10px]">{e}</Badge>
                    ))}
                  </div>
                </div>
                {data && <span className={cn('shrink-0 text-xs', data.cls)}>{data.txt}</span>}
              </button>
            );
          })}
        </Card>
      )}
      <TarefaSheet tarefaId={sheetId} aberto={sheetId !== null} onClose={() => setSheetId(null)} onMudou={() => refresh()} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Estágio de todas as tarefas (painel gestor — R3.b)                        */
/* -------------------------------------------------------------------------- */

export function EstagioTarefasBloco() {
  const history = useHistory();
  const { tarefas, carregando, refresh } = useDadosAgencia();
  const [sheetId, setSheetId] = useState<string | null>(null);

  if (carregando) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Estágio das Tarefas</h2>
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  const abertas = tarefas.filter((t) => !tarefaConcluida(t.status));

  // Urgência: vencidas primeiro, depois por prazoEfetivo mais próximo
  const linhas = [...abertas].sort((a, b) => {
    const av = prazoVencidoEfetivo(a);
    const bv = prazoVencidoEfetivo(b);
    if (av !== bv) return av ? -1 : 1;
    const pa = prazoEfetivo(a);
    const pb = prazoEfetivo(b);
    if (!pa && !pb) return 0;
    if (!pa) return 1;
    if (!pb) return -1;
    return pa.localeCompare(pb);
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Estágio das Tarefas</h2>
        <button
          type="button"
          onClick={() => history.push('/tarefas')}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Ver todas as tarefas"
        >
          Ver todas <ArrowRight className="size-3.5" />
        </button>
      </div>

      {linhas.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <ListChecks className="size-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma tarefa aberta.</p>
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-border/40">
          {linhas.map((t) => {
            const vencida = prazoVencidoEfetivo(t);
            const prazoEf = prazoEfetivo(t);
            const hasSteps = temEtapas(t);
            const etapaAtu = etapaAtual(t.etapas);
            const isAprovacao = etapaAtu?.tipo === 'aprovacao_cliente';
            const respAtual = (() => {
              if (!hasSteps) return t.expand?.responsaveis?.[0] ?? null;
              if (etapaAtu?.tipo === 'interna') {
                return (t.expand?.responsaveis ?? []).find(
                  (r) => r.id === etapaAtu.responsavel,
                ) ?? null;
              }
              return null;
            })();
            const contexto =
              t.expand?.projeto?.nome
              ?? t.expand?.cliente?.nome_fantasia
              ?? t.expand?.cliente?.nome;

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSheetId(t.id)}
                aria-label={`Abrir tarefa: ${t.nome}`}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50"
              >
                {/* Avatar do responsável da etapa atual */}
                {respAtual ? (
                  <AvatarMembro
                    membro={respAtual}
                    className="size-8 shrink-0 text-[10px]"
                  />
                ) : isAprovacao ? (
                  <div
                    aria-label="Aguardando aprovação do cliente"
                    className="grid size-8 shrink-0 place-items-center rounded-full border border-amber-500/40 bg-amber-500/10 text-xs font-bold text-amber-500"
                  >
                    C
                  </div>
                ) : (
                  <div className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-border bg-secondary text-xs text-muted-foreground">
                    ?
                  </div>
                )}

                {/* Conteúdo principal */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.nome}</p>
                  {contexto && (
                    <p className="truncate text-xs text-muted-foreground">{contexto}</p>
                  )}
                  <div className="mt-1">
                    <EtapasStepper
                      etapas={t.etapas}
                      responsaveis={t.expand?.responsaveis ?? []}
                      variant="compact"
                      prazo={t.prazo}
                      status={t.status}
                    />
                  </div>
                </div>

                {/* Direita: status + prazo/atraso */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {t.status && (
                    <Badge className={cn('border text-[10px]', statusTarefaClass(t.status))}>
                      {t.status}
                    </Badge>
                  )}
                  {vencida ? (
                    <Badge className="border border-destructive/50 bg-destructive/15 text-[10px] text-destructive">
                      Atrasada
                    </Badge>
                  ) : prazoEf ? (
                    <span className="text-[10px] text-muted-foreground">{prazoBR(prazoEf)}</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </Card>
      )}

      <TarefaSheet
        tarefaId={sheetId}
        aberto={sheetId !== null}
        onClose={() => setSheetId(null)}
        onMudou={() => refresh()}
      />
    </div>
  );
}
