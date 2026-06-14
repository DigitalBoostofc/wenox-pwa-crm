import { useEffect, useState } from 'react';
import { CheckSquare, Paperclip, Tag, Calendar, Users, FileText } from 'lucide-react';
import { getCartao } from './quadrosService';
import type { Cartao } from './types';
import { progressoChecklist, corEtiquetaClass } from './types';
import { prazoBR } from '@/tarefas/format';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function Secao({ icon: Icon, titulo, children }: { icon: typeof Tag; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" /> {titulo}
      </div>
      {children}
    </div>
  );
}

export function CartaoSheet({ cartaoId, aberto, onClose }: {
  cartaoId: string | null; aberto: boolean; onClose: () => void;
}) {
  const [c, setC] = useState<Cartao | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!cartaoId) { setC(null); return; }
    setCarregando(true);
    getCartao(cartaoId).then(setC).catch(() => setC(null)).finally(() => setCarregando(false));
  }, [cartaoId]);

  const imgs = (c?.anexos ?? []).filter((a) => (a.mime ?? '').startsWith('image') && a.url);
  const outros = (c?.anexos ?? []).filter((a) => !(a.mime ?? '').startsWith('image') && a.url);
  const prog = c ? progressoChecklist(c) : { feitos: 0, total: 0 };

  return (
    <Sheet open={aberto} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-xl">
        {carregando || !c ? (
          <div className="flex flex-col gap-3 pt-6">
            <SheetTitle className="sr-only">Carregando card</SheetTitle>
            <Skeleton className="h-6 w-2/3" /><Skeleton className="h-40 w-full" /><Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            <SheetTitle className="pr-8 text-lg leading-snug">{c.nome}</SheetTitle>

            <div className="flex flex-wrap gap-3 text-sm">
              {c.prazo && (
                <span className={cn('inline-flex items-center gap-1 rounded-md border border-border px-2 py-1', c.concluido && 'text-emerald-400')}>
                  <Calendar className="size-3.5" /> {prazoBR(c.prazo)}{c.concluido ? ' ✓' : ''}
                </span>
              )}
              {(c.membros?.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">
                  <Users className="size-3.5" /> {c.membros!.join(', ')}
                </span>
              )}
            </div>

            {(c.etiquetas?.length ?? 0) > 0 && (
              <Secao icon={Tag} titulo="Etiquetas">
                <div className="flex flex-wrap gap-1.5">
                  {c.etiquetas!.filter((e) => e.nome || e.cor).map((e, i) => (
                    <span key={i} className={cn('rounded border px-2 py-0.5 text-xs font-medium', corEtiquetaClass(e.cor))}>
                      {e.nome || '—'}
                    </span>
                  ))}
                </div>
              </Secao>
            )}

            {(c.descricao ?? '').trim() && (
              <Secao icon={FileText} titulo="Descrição">
                <p className="whitespace-pre-wrap text-sm text-foreground/90">{c.descricao}</p>
              </Secao>
            )}

            {prog.total > 0 && (
              <Secao icon={CheckSquare} titulo={`Checklists (${prog.feitos}/${prog.total})`}>
                <div className="flex flex-col gap-3">
                  {c.checklists!.map((ch, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      {ch.nome && <p className="text-sm font-medium">{ch.nome}</p>}
                      <ul className="flex flex-col gap-1">
                        {ch.itens.map((it, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm">
                            <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded border text-[10px]',
                              it.feito ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-border')}>
                              {it.feito ? '✓' : ''}
                            </span>
                            <span className={cn(it.feito && 'text-muted-foreground line-through')}>{it.texto}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Secao>
            )}

            {imgs.length > 0 && (
              <Secao icon={Paperclip} titulo={`Imagens (${imgs.length})`}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {imgs.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-border">
                      <img src={a.url} alt={a.nome ?? ''} loading="lazy" className="aspect-square w-full object-cover transition-transform hover:scale-105" />
                    </a>
                  ))}
                </div>
              </Secao>
            )}

            {outros.length > 0 && (
              <Secao icon={Paperclip} titulo={`Anexos (${outros.length})`}>
                <div className="flex flex-col gap-1">
                  {outros.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="truncate text-sm text-primary hover:underline">
                      {a.nome || a.url}
                    </a>
                  ))}
                </div>
              </Secao>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
