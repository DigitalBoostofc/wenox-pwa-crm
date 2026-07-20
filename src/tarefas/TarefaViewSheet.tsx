import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { getTarefa, atualizarTarefa } from './tarefasService';
import type { Tarefa } from './types';
import { prazoVencido, prazoBR } from './format';
import { StatusOpcaoSelect } from './StatusOpcaoSelect';
import { StatusOpcaoChip } from './StatusOpcaoChip';
import { AtividadeFeed } from '@/atividade/AtividadeFeed';
import { useAuth } from '@/auth/useAuth';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const selectCls =
  'h-9 w-full rounded-md border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50';

function RotuloCampo({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-medium text-muted-foreground">{children}</span>;
}

function contextoTarefa(t: Tarefa): string {
  return (
    t.expand?.projeto?.nome
    ?? t.expand?.cliente?.nome_fantasia
    ?? t.expand?.cliente?.nome
    ?? (t.projeto || t.cliente ? '' : 'Interna')
  );
}

export function TarefaViewSheet({
  tarefaId, aberto, onClose, onMudou, somenteLeitura,
}: {
  tarefaId: string | null;
  aberto: boolean;
  onClose: () => void;
  onMudou: () => void;
  somenteLeitura?: boolean;
}) {
  const { user } = useAuth();
  const [t, setT] = useState<Tarefa | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [statusOpcaoEdit, setStatusOpcaoEdit] = useState('');
  const [salvandoStatus, setSalvandoStatus] = useState(false);

  useEffect(() => {
    if (!aberto || !tarefaId) { setT(null); return; }
    setCarregando(true);
    setErro('');
    getTarefa(tarefaId)
      .then((rec) => {
        setT(rec as Tarefa);
        setStatusOpcaoEdit((rec as Tarefa).status_opcao ?? '');
        setCarregando(false);
      })
      .catch(() => { setErro('Não foi possível carregar a tarefa.'); setCarregando(false); });
  }, [aberto, tarefaId]);

  async function salvarStatus() {
    if (!t || somenteLeitura || statusOpcaoEdit === (t.status_opcao ?? '')) return;
    setSalvandoStatus(true);
    setErro('');
    try {
      const at = await atualizarTarefa(t.id, { status_opcao: statusOpcaoEdit });
      setT(at as Tarefa);
      setStatusOpcaoEdit((at as Tarefa).status_opcao ?? '');
      onMudou();
    } catch {
      setErro('Não foi possível salvar o status.');
    } finally {
      setSalvandoStatus(false);
    }
  }

  // Usado apenas para satisfazer o lint (user pode ser usado em futuras extensões)
  void user;

  const contexto = t ? contextoTarefa(t) : '';
  const vencida = t ? prazoVencido(t.prazo, t.status) : false;

  return (
    <Sheet open={aberto} onOpenChange={(abr) => { if (!abr) onClose(); }}>
      <SheetContent
        side="right"
        className={cn('flex flex-col gap-0 overflow-y-auto p-0 w-full sm:w-[40vw] sm:min-w-[460px] sm:max-w-none')}
      >
        <div className="border-b border-border px-5 py-3 pr-12">
          <SheetTitle className="text-base leading-snug">{t?.nome ?? 'Carregando…'}</SheetTitle>
          {contexto && <p className="mt-0.5 text-xs text-muted-foreground">{contexto}</p>}
        </div>

        <div className="flex flex-col gap-5 px-5 py-5">
          {carregando && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-9 w-full" />
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
                    <StatusOpcaoChip opcaoId={t.status_opcao} statusLegado={t.status} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <StatusOpcaoSelect
                        value={statusOpcaoEdit}
                        statusLegado={t.status}
                        onChange={setStatusOpcaoEdit}
                        className={selectCls}
                      />
                      {statusOpcaoEdit !== (t.status_opcao ?? '') && (
                        <Button size="sm" onClick={salvarStatus} disabled={salvandoStatus} className="shrink-0">
                          {salvandoStatus ? 'Salvando…' : 'Salvar'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {t.prazo && (
                  <div>
                    <RotuloCampo>Prazo</RotuloCampo>
                    <span className={cn('inline-flex items-center gap-1.5 text-sm', vencida ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                      <CalendarDays className="size-3.5" />
                      {prazoBR(t.prazo)}
                    </span>
                  </div>
                )}
              </div>

              {/* Descrição */}
              <div>
                <RotuloCampo>Descrição</RotuloCampo>
                {(t.descricao ?? '').trim() ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{t.descricao}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem descrição.</p>
                )}
              </div>

              {/* Comentários & Histórico */}
              <AtividadeFeed entidade="tarefa" refId={t.id} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
