import { cn } from '@/lib/utils';
import { etapaAtualIndex, progressoEtapas } from '@/tarefas/etapas';
import type { EtapaTarefa } from '@/tarefas/types';
import { AvatarMembro, type MembroAvatar } from '@/dashboard/AvatarMembro';
import { corStatusClass } from '@/tarefas/status';
import { prazoBR, prazoVencido } from '@/tarefas/format';

export interface EtapasStepperProps {
  etapas?: EtapaTarefa[];
  /** Usuários expandidos para resolver IDs de responsavel → nome/foto. */
  responsaveis: MembroAvatar[];
  variant: 'compact' | 'full';
  /** Prazo da tarefa — exibido no segmento único sem etapas (prepara R3.c). */
  prazo?: string;
  /** Status da tarefa — cor e rótulo do segmento único sem etapas. */
  status?: string;
  /** Exibe a data de prazo no caption (compact). Desligue quando houver coluna de prazo dedicada. */
  mostrarPrazo?: boolean;
  /** Exibe as bolinhas de progresso (compact). Desligue para mostrar só o caption. */
  mostrarDots?: boolean;
  /** Contador de cards que concluíram a etapa atual (ex.: 3/8), exibido no caption (compact). */
  contador?: { feitos: number; total: number };
}

/* -------------------------------------------------------------------------- */
/*  Helpers internos                                                           */
/* -------------------------------------------------------------------------- */

type EstadoEtapa = 'feita' | 'atual-interna' | 'atual-aprovacao' | 'futura';

function estadoDaEtapa(
  i: number,
  etapa: EtapaTarefa,
  atualIdx: number,
): EstadoEtapa {
  if (etapa.feito) return 'feita';
  if (i === atualIdx) {
    return etapa.tipo === 'aprovacao_cliente' ? 'atual-aprovacao' : 'atual-interna';
  }
  return 'futura';
}

const COMPACT_DOT: Record<EstadoEtapa, string> = {
  feita:             'size-2 bg-emerald-500',
  'atual-interna':   'size-2.5 bg-primary ring-2 ring-primary/30',
  'atual-aprovacao': 'size-2.5 bg-amber-500 ring-2 ring-amber-500/30',
  futura:            'size-2 border border-border bg-muted-foreground/20',
};

const FULL_DOT: Record<EstadoEtapa, string> = {
  feita:             'size-4 bg-emerald-500',
  'atual-interna':   'size-5 bg-primary ring-4 ring-primary/20',
  'atual-aprovacao': 'size-5 bg-amber-500 ring-4 ring-amber-500/20',
  futura:            'size-4 border-2 border-border bg-secondary',
};

function dotBgSemEtapas(status?: string): string {
  const cls = corStatusClass(status);
  if (cls.includes('emerald'))     return 'bg-emerald-500';
  if (cls.includes('amber'))       return 'bg-amber-500';
  if (cls.includes('destructive')) return 'bg-destructive';
  if (cls.includes('primary'))     return 'bg-primary';
  if (cls.includes('violet'))      return 'bg-violet-500';
  return 'bg-muted-foreground/30 border border-border';
}

function ringDeSemEtapas(dotBg: string): string {
  if (dotBg.includes('emerald'))     return 'ring-emerald-500/20';
  if (dotBg.includes('amber'))       return 'ring-amber-500/20';
  if (dotBg.includes('destructive')) return 'ring-destructive/20';
  if (dotBg.includes('primary'))     return 'ring-primary/20';
  if (dotBg.includes('violet'))      return 'ring-violet-500/20';
  return 'ring-muted-foreground/10';
}

function resolverResp(
  id: string | undefined,
  lista: MembroAvatar[],
): MembroAvatar | undefined {
  if (!id) return undefined;
  return lista.find((r) => r.id === id);
}

function PrazoSpan({ prazo, feito }: { prazo?: string; feito?: boolean }) {
  if (!prazo) return null;
  const vencido = !feito && prazoVencido(prazo);
  return (
    <span
      className={cn(
        'shrink-0 text-[10px]',
        vencido ? 'font-medium text-destructive' : 'text-muted-foreground',
      )}
    >
      {prazoBR(prazo)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Compact — substitui "Etapa X/Y" em listas                                 */
/* -------------------------------------------------------------------------- */

function StepperCompact({
  etapas,
  responsaveis,
  mostrarPrazo = true,
  mostrarDots = true,
  contador,
}: {
  etapas: EtapaTarefa[];
  responsaveis: MembroAvatar[];
  mostrarPrazo?: boolean;
  mostrarDots?: boolean;
  contador?: { feitos: number; total: number };
}) {
  const atualIdx = etapaAtualIndex(etapas);
  const { feitas, total } = progressoEtapas(etapas);
  const atual = atualIdx >= 0 ? etapas[atualIdx] : null;
  const resp =
    atual !== null && atual.tipo === 'interna'
      ? resolverResp(atual.responsavel, responsaveis)
      : undefined;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {/* dots row */}
      {mostrarDots && (
      <ol aria-label={`Etapas: ${feitas} de ${total} concluídas`} className="flex items-center">
        {etapas.map((etapa, i) => {
          const estado = estadoDaEtapa(i, etapa, atualIdx);
          const isCurrent = i === atualIdx;
          return (
            <li
              key={etapa.id}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={
                isCurrent
                  ? `Etapa atual: ${etapa.texto}`
                  : etapa.feito
                  ? `Concluída: ${etapa.texto}`
                  : `Próxima: ${etapa.texto}`
              }
              className="flex items-center"
            >
              {i > 0 && (
                <div
                  aria-hidden="true"
                  className={cn(
                    'mx-1 h-px w-2.5 shrink-0',
                    etapas[i - 1].feito ? 'bg-emerald-500/50' : 'bg-border',
                  )}
                />
              )}
              <div
                aria-hidden="true"
                title={etapa.texto}
                className={cn('shrink-0 rounded-full transition-colors', COMPACT_DOT[estado])}
              />
            </li>
          );
        })}
      </ol>
      )}

      {/* caption da etapa atual */}
      {atual && (
        <div className="flex min-w-0 items-center gap-1">
          {atual.tipo === 'aprovacao_cliente' ? (
            <span className="truncate text-[11px] text-amber-500/90">
              Aprovação do cliente
            </span>
          ) : (
            <>
              <span
                className="max-w-[9rem] truncate text-[11px] text-muted-foreground"
                title={atual.texto}
              >
                {atual.texto}
              </span>
              {resp && (
                <>
                  <AvatarMembro membro={resp} className="size-4 shrink-0 text-[7px]" />
                  <span className="max-w-[5rem] truncate text-[11px] text-muted-foreground">
                    {resp.nome?.split(' ')[0] ?? ''}
                  </span>
                </>
              )}
            </>
          )}
          {mostrarPrazo && <PrazoSpan prazo={atual.prazo} feito={atual.feito} />}
          {contador && contador.total > 0 && (
            <span className={cn(
              'shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium tabular-nums',
              contador.feitos >= contador.total
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                : 'border-border bg-secondary/60 text-muted-foreground',
            )}>
              {contador.feitos}/{contador.total}
            </span>
          )}
        </div>
      )}

      {/* todas concluídas */}
      {atualIdx === -1 && (
        <span className="text-[11px] font-medium text-emerald-500">Concluído</span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Full — sheets e painel do gestor                                          */
/* -------------------------------------------------------------------------- */

function StepperFull({
  etapas,
  responsaveis,
}: {
  etapas: EtapaTarefa[];
  responsaveis: MembroAvatar[];
}) {
  const atualIdx = etapaAtualIndex(etapas);
  const { feitas, total } = progressoEtapas(etapas);

  return (
    <ol aria-label={`Etapas: ${feitas} de ${total} concluídas`} className="flex flex-col">
      {etapas.map((etapa, i) => {
        const estado = estadoDaEtapa(i, etapa, atualIdx);
        const isCurrent = i === atualIdx;
        const isLast = i === etapas.length - 1;
        const isAprovacao = etapa.tipo === 'aprovacao_cliente';
        const resp = isAprovacao
          ? undefined
          : resolverResp(etapa.responsavel, responsaveis);

        return (
          <li
            key={etapa.id}
            aria-current={isCurrent ? 'step' : undefined}
            className="flex gap-3"
          >
            {/* coluna: bolinha + linha vertical */}
            <div aria-hidden="true" className="flex flex-col items-center">
              <div
                className={cn(
                  'mt-0.5 shrink-0 rounded-full transition-all',
                  FULL_DOT[estado],
                )}
              />
              {!isLast && (
                <div
                  className={cn(
                    'mt-1 w-px flex-1',
                    etapa.feito ? 'bg-emerald-500/40' : 'bg-border',
                  )}
                />
              )}
            </div>

            {/* conteúdo */}
            <div className={cn('min-w-0 flex-1', !isLast && 'pb-4')}>
              <p
                className={cn(
                  'text-sm leading-snug',
                  isCurrent && !etapa.feito && 'font-medium',
                  etapa.feito
                    ? 'text-muted-foreground line-through'
                    : !isCurrent && 'text-muted-foreground',
                )}
              >
                {etapa.texto}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {isAprovacao ? (
                  <span className="text-[11px] text-amber-500/90">
                    Aprovação do cliente
                  </span>
                ) : resp ? (
                  <div className="flex items-center gap-1">
                    <AvatarMembro membro={resp} className="size-4 text-[7px]" />
                    <span className="text-[11px] text-muted-foreground">{resp.nome}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground/60">
                    Sem responsável
                  </span>
                )}
                <PrazoSpan prazo={etapa.prazo} feito={etapa.feito} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sem etapas — segmento único (prepara R3.c)                                */
/* -------------------------------------------------------------------------- */

function StepperSemEtapas({
  responsaveis,
  prazo,
  status,
  variant,
  mostrarPrazo = true,
  mostrarDots = true,
}: {
  responsaveis: MembroAvatar[];
  prazo?: string;
  status?: string;
  variant: 'compact' | 'full';
  mostrarPrazo?: boolean;
  mostrarDots?: boolean;
}) {
  const resp: MembroAvatar | undefined =
    responsaveis.length > 0 ? responsaveis[0] : undefined;
  const dotBg = dotBgSemEtapas(status);
  const vencido = prazoVencido(prazo, status);

  if (variant === 'compact') {
    return (
      <ol aria-label="Tarefa: 1 etapa" className="flex items-center gap-1.5">
        <li aria-current="step" className="flex items-center gap-1.5">
          {mostrarDots && (
            <div
              aria-hidden="true"
              className={cn('size-2.5 shrink-0 rounded-full', dotBg)}
            />
          )}
          {status && (
            <span className="text-[11px] text-muted-foreground">{status}</span>
          )}
          {resp && (
            <AvatarMembro membro={resp} className="size-4 shrink-0 text-[7px]" />
          )}
          {resp?.nome && (
            <span className="max-w-[5rem] truncate text-[11px] text-muted-foreground">
              {resp.nome.split(' ')[0]}
            </span>
          )}
          {mostrarPrazo && prazo && (
            <span
              className={cn(
                'shrink-0 text-[10px]',
                vencido ? 'font-medium text-destructive' : 'text-muted-foreground',
              )}
            >
              {prazoBR(prazo)}
            </span>
          )}
        </li>
      </ol>
    );
  }

  return (
    <ol aria-label="Tarefa: 1 etapa" className="flex flex-col">
      <li aria-current="step" className="flex gap-3">
        <div aria-hidden="true" className="flex flex-col items-center">
          <div
            className={cn(
              'mt-0.5 size-5 shrink-0 rounded-full ring-4',
              dotBg,
              ringDeSemEtapas(dotBg),
            )}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{status ?? 'Tarefa'}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {resp ? (
              <div className="flex items-center gap-1">
                <AvatarMembro membro={resp} className="size-4 text-[7px]" />
                <span className="text-[11px] text-muted-foreground">{resp.nome}</span>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground/60">
                Sem responsável
              </span>
            )}
            {prazo && (
              <span
                className={cn(
                  'shrink-0 text-[10px]',
                  vencido ? 'font-medium text-destructive' : 'text-muted-foreground',
                )}
              >
                {prazoBR(prazo)}
              </span>
            )}
          </div>
        </div>
      </li>
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/*  Ponto de entrada público                                                   */
/* -------------------------------------------------------------------------- */

export function EtapasStepper({
  etapas,
  responsaveis,
  variant,
  prazo,
  status,
  mostrarPrazo = true,
  mostrarDots = true,
  contador,
}: EtapasStepperProps) {
  if ((etapas?.length ?? 0) === 0) {
    return (
      <StepperSemEtapas
        responsaveis={responsaveis}
        prazo={prazo}
        status={status}
        variant={variant}
        mostrarPrazo={mostrarPrazo}
        mostrarDots={mostrarDots}
      />
    );
  }

  if (variant === 'compact') {
    return <StepperCompact etapas={etapas!} responsaveis={responsaveis} mostrarPrazo={mostrarPrazo} mostrarDots={mostrarDots} contador={contador} />;
  }

  return <StepperFull etapas={etapas!} responsaveis={responsaveis} />;
}
