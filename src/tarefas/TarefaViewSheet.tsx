import { useEffect, useState } from 'react';
import { Check, CalendarDays } from 'lucide-react';
import { getTarefa, atualizarTarefa } from './tarefasService';
import type { Tarefa } from './types';
import { statusTarefaClass, prazoVencido, prazoBR } from './format';
import { STATUS_TAREFA } from './status';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const selectCls =
  'h-9 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50';

function RotuloCampo({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-medium text-muted-foreground">{children}</span>
  );
}

/** Contexto da tarefa: projeto, senão cliente, senão "Interna". */
function contextoTarefa(t: Tarefa): string {
  return (
    t.expand?.projeto?.nome
    ?? t.expand?.cliente?.nome_fantasia
    ?? t.expand?.cliente?.nome
    ?? (t.projeto || t.cliente ? '' : 'Interna')
  );
}

/**
 * Painel de VISUALIZAÇÃO de uma tarefa (somente leitura) usado no "Meu Dia".
 * Mostra nome, contexto, prazo e descrição em modo leitura. As únicas ações
 * permitidas são marcar itens do checklist e alterar o status — e mesmo essas
 * ficam desativadas quando `somenteLeitura` (papel Visualizador).
 */
export function TarefaViewSheet({
  tarefaId, aberto, onClose, onMudou, somenteLeitura,
}: {
  tarefaId: string | null;
  aberto: boolean;
  onClose: () => void;
  onMudou: () => void;
  somenteLeitura?: boolean;
}) {
  const [t, setT] = useState<Tarefa | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!aberto || !tarefaId) { setT(null); return; }
    setCarregando(true);
    setErro('');
    getTarefa(tarefaId)
      .then((rec) => { setT(rec as Tarefa); setCarregando(false); })
      .catch(() => { setErro('Não foi possível carregar a tarefa.'); setCarregando(false); });
  }, [aberto, tarefaId]);

  async function mudarStatus(novo: string) {
    if (!t || somenteLeitura) return;
    const anterior = t;
    setT({ ...t, status: novo });
    setErro('');
    try {
      const atualizado = await atualizarTarefa(t.id, { status: novo });
      setT(atualizado as Tarefa);
      onMudou();
    } catch {
      setErro('Não foi possível alterar o status.');
      setT(anterior);
    }
  }

  async function toggleChecklist(idx: number) {
    if (!t || somenteLeitura) return;
    const novo = (t.checklist ?? []).map((item, i) =>
      i === idx ? { ...item, feito: !item.feito } : item,
    );
    const anterior = t;
    setT({ ...t, checklist: novo });
    setErro('');
    try {
      const atualizado = await atualizarTarefa(t.id, { checklist: novo });
      setT(atualizado as Tarefa);
      onMudou();
    } catch {
      setErro('Não foi possível atualizar o checklist.');
      setT(anterior);
    }
  }

  const checklist = t?.checklist ?? [];
  const checklistFeitos = checklist.filter((i) => i.feito).length;
  const contexto = t ? contextoTarefa(t) : '';
  const vencida = t ? prazoVencido(t.prazo, t.status) : false;

  return (
    <Sheet open={aberto} onOpenChange={(abr) => { if (!abr) onClose(); }}>
      <SheetContent
        side="right"
        className={cn('flex flex-col gap-0 overflow-y-auto p-0 w-full sm:w-[33vw] sm:min-w-[420px] sm:max-w-none')}
      >
        {/* Topo */}
        <div className="border-b border-border px-5 py-3 pr-12">
          <SheetTitle className="text-base leading-snug">
            {t?.nome ?? 'Carregando…'}
          </SheetTitle>
          {contexto && (
            <p className="mt-0.5 text-xs text-muted-foreground">{contexto}</p>
          )}
        </div>

        {/* Corpo */}
        <div className="flex flex-col gap-5 px-5 py-5">
          {carregando && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {erro && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erro}
            </p>
          )}

          {!carregando && t && (
            <>
              {/* Status + Prazo */}
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-40 flex-1">
                  <RotuloCampo>Status</RotuloCampo>
                  {somenteLeitura ? (
                    t.status ? (
                      <Badge className={cn('border text-[11px]', statusTarefaClass(t.status))}>
                        {t.status}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )
                  ) : (
                    <select
                      value={t.status ?? ''}
                      onChange={(e) => mudarStatus(e.target.value)}
                      className={selectCls}
                    >
                      <option value="">—</option>
                      {STATUS_TAREFA.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </div>
                {t.prazo && (
                  <div>
                    <RotuloCampo>Prazo</RotuloCampo>
                    <span className={cn(
                      'inline-flex items-center gap-1.5 text-sm',
                      vencida ? 'font-medium text-destructive' : 'text-muted-foreground',
                    )}>
                      <CalendarDays className="size-3.5" />
                      {prazoBR(t.prazo)}
                    </span>
                  </div>
                )}
              </div>

              {/* Checklist */}
              <div>
                <RotuloCampo>
                  Checklist{checklist.length > 0 && (
                    <span className="ml-1.5 font-normal text-muted-foreground/70">
                      {checklistFeitos}/{checklist.length}
                    </span>
                  )}
                </RotuloCampo>
                {checklist.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem checklist.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {checklist.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={somenteLeitura}
                          onClick={() => toggleChecklist(idx)}
                          aria-label={item.feito ? 'Desmarcar' : 'Marcar como feito'}
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                            item.feito
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background',
                            !somenteLeitura && !item.feito && 'hover:border-primary/60',
                            somenteLeitura && 'cursor-default',
                          )}
                        >
                          {item.feito && <Check className="size-2.5" />}
                        </button>
                        <span className={cn('flex-1 text-sm', item.feito && 'text-muted-foreground line-through')}>
                          {item.texto}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Descrição */}
              <div>
                <RotuloCampo>Descrição</RotuloCampo>
                {(t.descricao ?? '').trim() ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {t.descricao}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem descrição.</p>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
