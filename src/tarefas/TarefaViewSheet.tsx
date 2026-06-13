import { useEffect, useState } from 'react';
import { Check, CalendarDays, ImagePlus, X } from 'lucide-react';
import {
  getTarefa, atualizarTarefa, concluirEtapa, reabrirEtapa, reenviarAprovacao,
} from './tarefasService';
import type { Tarefa, EtapaTarefa } from './types';
import { statusTarefaClass, prazoVencido, prazoBR } from './format';
import { temEtapas, etapaAtualIndex, progressoEtapas } from './etapas';
import { STATUS_TAREFA } from './status';
import { addComentario } from '@/atividade/atividadeService';
import { AtividadeFeed } from '@/atividade/AtividadeFeed';
import { useAuth } from '@/auth/useAuth';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
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
  const uid = user?.id ?? '';
  const [t, setT] = useState<Tarefa | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  // Estado do formulário de conclusão de etapa
  const [concluindoId, setConcluindoId] = useState<string | null>(null);
  const [comentEtapa, setComentEtapa] = useState('');
  const [imgEtapa, setImgEtapa] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto || !tarefaId) { setT(null); return; }
    setCarregando(true);
    setErro('');
    setConcluindoId(null);
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
      const at = await atualizarTarefa(t.id, { status: novo });
      setT(at as Tarefa);
      onMudou();
    } catch {
      setErro('Não foi possível alterar o status.');
      setT(anterior);
    }
  }

  function nomeResp(id?: string): string {
    if (!id) return '';
    const r = (t?.expand?.responsaveis ?? []).find((u) => u.id === id);
    return r?.nome ?? r?.email ?? 'alguém';
  }

  async function confirmarConcluir(etapaId: string) {
    if (!t) return;
    setSalvando(true);
    setErro('');
    try {
      if (comentEtapa.trim() || imgEtapa) {
        await addComentario('tarefa', t.id, comentEtapa, true, imgEtapa);
      }
      const at = await concluirEtapa(t, etapaId);
      setT(at as Tarefa);
      setConcluindoId(null);
      setComentEtapa('');
      setImgEtapa(null);
      onMudou();
    } catch {
      setErro('Não foi possível concluir a etapa.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleReabrir(etapaId: string) {
    if (!t) return;
    setErro('');
    try {
      const at = await reabrirEtapa(t, etapaId);
      setT(at as Tarefa);
      onMudou();
    } catch {
      setErro('Não foi possível reabrir a etapa.');
    }
  }

  async function handleReenviar() {
    if (!t) return;
    setErro('');
    try {
      const at = await reenviarAprovacao(t);
      setT(at as Tarefa);
      onMudou();
    } catch {
      setErro('Não foi possível reenviar.');
    }
  }

  const contexto = t ? contextoTarefa(t) : '';
  const vencida = t ? prazoVencido(t.prazo, t.status) : false;
  const comEtapas = t ? temEtapas(t) : false;
  const etapas = t?.etapas ?? [];
  const idxAtual = etapaAtualIndex(etapas);
  const prog = progressoEtapas(etapas);

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
                  {comEtapas || somenteLeitura ? (
                    t.status ? (
                      <Badge className={cn('border text-[11px]', statusTarefaClass(t.status))}>{t.status}</Badge>
                    ) : <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <select value={t.status ?? ''} onChange={(e) => mudarStatus(e.target.value)} className={selectCls}>
                      <option value="">—</option>
                      {STATUS_TAREFA.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
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

              {/* Etapas do fluxo */}
              {comEtapas && (
                <div>
                  <RotuloCampo>
                    Etapas do fluxo
                    <span className="ml-1.5 font-normal text-muted-foreground/70">{prog.feitas}/{prog.total}</span>
                  </RotuloCampo>
                  <ul className="flex flex-col gap-1.5">
                    {etapas.map((e: EtapaTarefa, idx: number) => {
                      const ehAtual = idx === idxAtual;
                      const ehFutura = idxAtual >= 0 && idx > idxAtual;
                      const minhaVez = ehAtual && e.tipo === 'interna' && (!e.responsavel || e.responsavel === uid) && !somenteLeitura;
                      const dono = e.tipo === 'aprovacao_cliente' ? 'Cliente' : nomeResp(e.responsavel);
                      return (
                        <li
                          key={e.id}
                          className={cn(
                            'flex flex-col gap-2 rounded-md border px-3 py-2',
                            ehAtual ? 'border-primary/50 bg-primary/5' : 'border-border',
                            ehFutura && 'opacity-60',
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                              e.feito ? 'bg-emerald-500 text-white' : 'bg-secondary text-muted-foreground',
                            )}>
                              {e.feito ? <Check className="size-3" /> : idx + 1}
                            </span>
                            <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', e.feito && 'text-muted-foreground line-through')}>
                              {e.texto}
                            </span>
                            <Badge className={cn(
                              'shrink-0 border text-[10px]',
                              e.tipo === 'aprovacao_cliente'
                                ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                                : 'border-border bg-secondary text-muted-foreground',
                            )}>
                              {e.tipo === 'aprovacao_cliente' ? 'Cliente' : 'Interna'}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pl-7 text-xs text-muted-foreground">
                            {dono && <span>{dono}</span>}
                            {e.feito ? (
                              <span className="text-emerald-500">
                                ✓ por {e.feito_por === 'cliente' ? 'Cliente' : nomeResp(e.feito_por)}
                              </span>
                            ) : ehAtual ? (
                              <span className="font-medium text-primary">Etapa atual</span>
                            ) : (
                              <span>Aguardando</span>
                            )}
                          </div>

                          {/* Ações na etapa atual */}
                          {ehAtual && !somenteLeitura && (
                            <div className="pl-7">
                              {e.tipo === 'aprovacao_cliente' ? (
                                t.aprovacao === 'alteracao' ? (
                                  <Button size="sm" variant="outline" onClick={handleReenviar}>Reenviar para aprovação</Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Aguardando aprovação do cliente</span>
                                )
                              ) : minhaVez ? (
                                concluindoId === e.id ? (
                                  <div className="flex flex-col gap-2">
                                    <textarea
                                      value={comentEtapa}
                                      onChange={(ev) => setComentEtapa(ev.target.value)}
                                      rows={2}
                                      placeholder="Comentário (opcional)…"
                                      className="w-full rounded-md border border-input bg-background/40 p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                                    />
                                    {imgEtapa && (
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <ImagePlus className="size-3.5" />
                                        <span className="min-w-0 flex-1 truncate">{imgEtapa.name}</span>
                                        <button type="button" onClick={() => setImgEtapa(null)} className="hover:text-destructive"><X className="size-3.5" /></button>
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between gap-2">
                                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                                        <ImagePlus className="size-4" /> Anexar imagem
                                        <input type="file" accept="image/*" className="hidden" onChange={(ev) => setImgEtapa(ev.target.files?.[0] ?? null)} />
                                      </label>
                                      <div className="flex gap-2">
                                        <Button size="sm" variant="ghost" onClick={() => { setConcluindoId(null); setComentEtapa(''); setImgEtapa(null); }} disabled={salvando}>Cancelar</Button>
                                        <Button size="sm" onClick={() => confirmarConcluir(e.id)} disabled={salvando}>{salvando ? 'Concluindo…' : 'Concluir etapa'}</Button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <Button size="sm" onClick={() => setConcluindoId(e.id)}>Concluir etapa</Button>
                                )
                              ) : (
                                <span className="text-xs text-muted-foreground">Aguardando {dono || 'responsável'}</span>
                              )}
                            </div>
                          )}

                          {/* Reabrir etapa feita */}
                          {e.feito && !somenteLeitura && (
                            <div className="pl-7">
                              <button type="button" onClick={() => handleReabrir(e.id)} className="text-[11px] text-muted-foreground hover:text-foreground">Reabrir</button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

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
