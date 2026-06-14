import { useEffect, useState } from 'react';
import { CheckSquare, Paperclip, Tag, Calendar, Users, FileText, Plus, X } from 'lucide-react';
import { getCartao, atualizarCartao } from './quadrosService';
import type { Cartao, EtiquetaCartao } from './types';
import { progressoChecklist, corEtiquetaClass } from './types';
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
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

export function CartaoSheet({ cartaoId, aberto, labelsDisponiveis = [], onClose, onMudou }: {
  cartaoId: string | null; aberto: boolean; labelsDisponiveis?: EtiquetaCartao[];
  onClose: () => void; onMudou?: () => void;
}) {
  const [c, setC] = useState<Cartao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [equipe, setEquipe] = useState<Usuario[]>([]);
  const [descRasc, setDescRasc] = useState('');
  const [editandoDesc, setEditandoDesc] = useState(false);

  useEffect(() => {
    if (!cartaoId) { setC(null); return; }
    setCarregando(true);
    getCartao(cartaoId).then((r) => { setC(r); setDescRasc(r.descricao ?? ''); }).catch(() => setC(null)).finally(() => setCarregando(false));
  }, [cartaoId]);
  useEffect(() => { listUsuarios().then((us) => setEquipe(us.filter((u) => u.role !== 'Cliente'))).catch(() => { /* */ }); }, []);

  async function salvar(dados: Partial<Cartao>) {
    if (!c) return;
    const novo = { ...c, ...dados };
    setC(novo);
    try { await atualizarCartao(c.id, dados); onMudou?.(); } catch { /* */ }
  }

  function toggleItem(ci: number, ii: number) {
    if (!c) return;
    const checklists = (c.checklists ?? []).map((ch, i) => i !== ci ? ch
      : { ...ch, itens: ch.itens.map((it, j) => (j === ii ? { ...it, feito: !it.feito } : it)) });
    salvar({ checklists });
  }
  function removerEtiqueta(idx: number) {
    if (!c) return;
    salvar({ etiquetas: (c.etiquetas ?? []).filter((_, i) => i !== idx) });
  }
  function addEtiqueta(e: EtiquetaCartao) {
    if (!c) return;
    if ((c.etiquetas ?? []).some((x) => x.nome === e.nome && x.cor === e.cor)) return;
    salvar({ etiquetas: [...(c.etiquetas ?? []), e] });
  }
  function toggleMembro(nome: string) {
    if (!c) return;
    const atual = c.membros ?? [];
    salvar({ membros: atual.includes(nome) ? atual.filter((m) => m !== nome) : [...atual, nome] });
  }

  const imgs = (c?.anexos ?? []).filter((a) => (a.mime ?? '').startsWith('image') && a.url);
  const outros = (c?.anexos ?? []).filter((a) => !(a.mime ?? '').startsWith('image') && a.url);
  const prog = c ? progressoChecklist(c) : { feitos: 0, total: 0 };
  const labelsRestantes = labelsDisponiveis.filter((d) => !(c?.etiquetas ?? []).some((x) => x.nome === d.nome && x.cor === d.cor));

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
            <SheetTitle className="pr-8">
              <input
                defaultValue={c.nome}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.nome) salvar({ nome: v }); }}
                className="w-full rounded-md bg-transparent text-lg font-semibold leading-snug outline-none focus:bg-secondary/40 focus:px-2 focus:py-1"
              />
            </SheetTitle>

            {/* Data + ações rápidas */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5 text-muted-foreground" />
                <input
                  type="date"
                  value={(c.prazo ?? '').slice(0, 10)}
                  onChange={(e) => salvar({ prazo: e.target.value })}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                />
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={!!c.concluido} onChange={(e) => salvar({ concluido: e.target.checked })} /> concluído
              </label>
            </div>

            {/* Etiquetas */}
            <Secao icon={Tag} titulo="Etiquetas">
              <div className="flex flex-wrap items-center gap-1.5">
                {(c.etiquetas ?? []).filter((e) => e.nome || e.cor).map((e, i) => (
                  <span key={i} className={cn('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium', corEtiquetaClass(e.cor))}>
                    {e.nome || '—'}
                    <button onClick={() => removerEtiqueta(i)} className="opacity-60 hover:opacity-100"><X className="size-3" /></button>
                  </span>
                ))}
                {labelsRestantes.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center gap-1 rounded border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"><Plus className="size-3" /> etiqueta</button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                      {labelsRestantes.map((e, i) => (
                        <DropdownMenuItem key={i} onClick={() => addEtiqueta(e)}>
                          <span className={cn('mr-2 inline-block h-3 w-6 rounded border', corEtiquetaClass(e.cor))} />{e.nome || '(sem nome)'}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </Secao>

            {/* Membros */}
            <Secao icon={Users} titulo="Membros">
              <div className="flex flex-wrap gap-1.5">
                {equipe.map((u) => {
                  const ativo = (c.membros ?? []).includes(u.nome ?? '');
                  return (
                    <button key={u.id} onClick={() => toggleMembro(u.nome ?? '')}
                      className={cn('rounded-full border px-2.5 py-1 text-xs transition-colors', ativo ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-secondary')}>
                      {u.nome}
                    </button>
                  );
                })}
              </div>
            </Secao>

            {/* Descrição */}
            <Secao icon={FileText} titulo="Descrição">
              {editandoDesc ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus value={descRasc} rows={6}
                    onChange={(e) => setDescRasc(e.target.value)}
                    className="w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={() => { salvar({ descricao: descRasc }); setEditandoDesc(false); }}>Salvar</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setDescRasc(c.descricao ?? ''); setEditandoDesc(false); }}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setEditandoDesc(true)} className="rounded-md border border-border bg-background/40 p-2 text-left text-sm hover:border-primary/40">
                  {(c.descricao ?? '').trim()
                    ? <span className="whitespace-pre-wrap text-foreground/90">{c.descricao}</span>
                    : <span className="text-muted-foreground">Adicionar uma descrição…</span>}
                </button>
              )}
            </Secao>

            {/* Checklists */}
            {prog.total > 0 && (
              <Secao icon={CheckSquare} titulo={`Checklists (${prog.feitos}/${prog.total})`}>
                <div className="flex flex-col gap-3">
                  {c.checklists!.map((ch, ci) => (
                    <div key={ci} className="flex flex-col gap-1">
                      {ch.nome && <p className="text-sm font-medium">{ch.nome}</p>}
                      <ul className="flex flex-col gap-1">
                        {ch.itens.map((it, ii) => (
                          <li key={ii}>
                            <button onClick={() => toggleItem(ci, ii)} className="flex w-full items-start gap-2 text-left text-sm hover:bg-secondary/40 rounded px-1 py-0.5">
                              <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded border text-[10px]', it.feito ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-border')}>{it.feito ? '✓' : ''}</span>
                              <span className={cn(it.feito && 'text-muted-foreground line-through')}>{it.texto}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Secao>
            )}

            {/* Imagens */}
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
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="truncate text-sm text-primary hover:underline">{a.nome || a.url}</a>
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
