import { useEffect, useState } from 'react';
import { CheckSquare, Paperclip, Tag, Calendar, Users, FileText, Plus, X, Trash2 } from 'lucide-react';
import { getCartao, atualizarCartao, removerCartao } from './quadrosService';
import type { Cartao, EtiquetaCartao } from './types';
import { progressoChecklist, corEtiquetaClass, capaCartao, CORES_ETIQUETA } from './types';
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

function Secao({ icon: Icon, titulo, children }: { icon: typeof Tag; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Icon className="size-3.5" /> {titulo}</div>
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
  const [novoItem, setNovoItem] = useState<Record<number, string>>({});
  const [novaCl, setNovaCl] = useState('');
  const [novaEtNome, setNovaEtNome] = useState('');
  const [novaEtCor, setNovaEtCor] = useState<string>('green');

  useEffect(() => {
    if (!cartaoId) { setC(null); return; }
    setCarregando(true);
    getCartao(cartaoId).then((r) => { setC(r); setDescRasc(r.descricao ?? ''); }).catch(() => setC(null)).finally(() => setCarregando(false));
  }, [cartaoId]);
  useEffect(() => { listUsuarios().then((us) => setEquipe(us.filter((u) => u.role !== 'Cliente'))).catch(() => { /* */ }); }, []);

  async function salvar(dados: Partial<Cartao>) {
    if (!c) return;
    setC({ ...c, ...dados });
    try { await atualizarCartao(c.id, dados); onMudou?.(); } catch { /* */ }
  }

  // checklists
  function toggleItem(ci: number, ii: number) {
    if (!c) return;
    salvar({ checklists: (c.checklists ?? []).map((ch, i) => i !== ci ? ch : { ...ch, itens: ch.itens.map((it, j) => (j === ii ? { ...it, feito: !it.feito } : it)) }) });
  }
  function removerItem(ci: number, ii: number) {
    if (!c) return;
    salvar({ checklists: (c.checklists ?? []).map((ch, i) => i !== ci ? ch : { ...ch, itens: ch.itens.filter((_, j) => j !== ii) }) });
  }
  function addItem(ci: number) {
    if (!c) return;
    const txt = (novoItem[ci] ?? '').trim(); if (!txt) return;
    salvar({ checklists: (c.checklists ?? []).map((ch, i) => i !== ci ? ch : { ...ch, itens: [...ch.itens, { texto: txt, feito: false }] }) });
    setNovoItem((m) => ({ ...m, [ci]: '' }));
  }
  function addChecklist() {
    if (!c) return;
    const n = novaCl.trim(); if (!n) return;
    salvar({ checklists: [...(c.checklists ?? []), { nome: n, itens: [] }] });
    setNovaCl('');
  }
  function removerChecklist(ci: number) {
    if (!c) return;
    salvar({ checklists: (c.checklists ?? []).filter((_, i) => i !== ci) });
  }
  // etiquetas
  function removerEtiqueta(idx: number) { if (c) salvar({ etiquetas: (c.etiquetas ?? []).filter((_, i) => i !== idx) }); }
  function addEtiqueta(e: EtiquetaCartao) {
    if (!c || (c.etiquetas ?? []).some((x) => x.nome === e.nome && x.cor === e.cor)) return;
    salvar({ etiquetas: [...(c.etiquetas ?? []), e] });
  }
  function criarEtiqueta() {
    const n = novaEtNome.trim();
    if (!n && !novaEtCor) return;
    addEtiqueta({ nome: n, cor: novaEtCor });
    setNovaEtNome('');
  }
  function toggleMembro(nome: string) {
    if (!c) return;
    const a = c.membros ?? [];
    salvar({ membros: a.includes(nome) ? a.filter((m) => m !== nome) : [...a, nome] });
  }
  async function excluirCard() {
    if (!c) return;
    if (!confirm('Excluir este card? Esta ação não pode ser desfeita.')) return;
    try { await removerCartao(c.id); onMudou?.(); onClose(); } catch { /* */ }
  }

  const imgs = (c?.anexos ?? []).filter((a) => (a.mime ?? '').startsWith('image') && a.url);
  const outros = (c?.anexos ?? []).filter((a) => !(a.mime ?? '').startsWith('image') && a.url);
  const prog = c ? progressoChecklist(c) : { feitos: 0, total: 0 };
  const labelsRestantes = labelsDisponiveis.filter((d) => !(c?.etiquetas ?? []).some((x) => x.nome === d.nome && x.cor === d.cor));
  const capa = c ? capaCartao(c) : null;

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        {carregando || !c ? (
          <div className="flex flex-col gap-3 p-6">
            <DialogTitle className="sr-only">Carregando card</DialogTitle>
            <Skeleton className="h-6 w-2/3" /><Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            {capa && <img src={capa} alt="" className="max-h-48 w-full shrink-0 object-cover" />}
            <div className="flex flex-col gap-4 overflow-y-auto p-5 md:flex-row">
              {/* principal */}
              <div className="flex min-w-0 flex-1 flex-col gap-5">
                <DialogTitle className="pr-8">
                  <input
                    defaultValue={c.nome}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.nome) salvar({ nome: v }); }}
                    className="w-full rounded-md bg-transparent text-lg font-semibold leading-snug outline-none focus:bg-secondary/40 focus:px-2 focus:py-1"
                  />
                </DialogTitle>

                <Secao icon={FileText} titulo="Descrição">
                  {editandoDesc ? (
                    <div className="flex flex-col gap-2">
                      <textarea autoFocus value={descRasc} rows={6} onChange={(e) => setDescRasc(e.target.value)}
                        className="w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={() => { salvar({ descricao: descRasc }); setEditandoDesc(false); }}>Salvar</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setDescRasc(c.descricao ?? ''); setEditandoDesc(false); }}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setEditandoDesc(true)} className="rounded-md border border-border bg-background/40 p-2 text-left text-sm hover:border-primary/40">
                      {(c.descricao ?? '').trim() ? <span className="whitespace-pre-wrap text-foreground/90">{c.descricao}</span> : <span className="text-muted-foreground">Adicionar uma descrição…</span>}
                    </button>
                  )}
                </Secao>

                <Secao icon={CheckSquare} titulo={`Checklists (${prog.feitos}/${prog.total})`}>
                  <div className="flex flex-col gap-4">
                    {(c.checklists ?? []).map((ch, ci) => (
                      <div key={ci} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          {ch.nome && <p className="text-sm font-medium">{ch.nome}</p>}
                          <button onClick={() => removerChecklist(ci)} className="text-muted-foreground hover:text-destructive" title="Remover checklist"><Trash2 className="size-3.5" /></button>
                        </div>
                        <ul className="flex flex-col gap-1">
                          {ch.itens.map((it, ii) => (
                            <li key={ii} className="group flex items-start gap-2 rounded px-1 py-0.5 text-sm hover:bg-secondary/40">
                              <button onClick={() => toggleItem(ci, ii)} className="flex flex-1 items-start gap-2 text-left">
                                <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded border text-[10px]', it.feito ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-border')}>{it.feito ? '✓' : ''}</span>
                                <span className={cn(it.feito && 'text-muted-foreground line-through')}>{it.texto}</span>
                              </button>
                              <button onClick={() => removerItem(ci, ii)} className="opacity-0 transition group-hover:opacity-100 text-muted-foreground hover:text-destructive"><X className="size-3.5" /></button>
                            </li>
                          ))}
                        </ul>
                        <input value={novoItem[ci] ?? ''} onChange={(e) => setNovoItem((m) => ({ ...m, [ci]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') addItem(ci); }} placeholder="+ adicionar item"
                          className="h-7 rounded border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input value={novaCl} onChange={(e) => setNovaCl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addChecklist(); }}
                        placeholder="Nova checklist…" className="h-7 flex-1 rounded border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addChecklist}>Adicionar</Button>
                    </div>
                  </div>
                </Secao>

                {imgs.length > 0 && (
                  <Secao icon={Paperclip} titulo={`Imagens (${imgs.length})`}>
                    <div className="grid grid-cols-3 gap-2">
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
                      {outros.map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer" className="truncate text-sm text-primary hover:underline">{a.nome || a.url}</a>)}
                    </div>
                  </Secao>
                )}
              </div>

              {/* sidebar */}
              <div className="flex w-full shrink-0 flex-col gap-4 md:w-52">
                <Secao icon={Calendar} titulo="Data">
                  <input type="date" value={(c.prazo ?? '').slice(0, 10)} onChange={(e) => salvar({ prazo: e.target.value })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
                  <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={!!c.concluido} onChange={(e) => salvar({ concluido: e.target.checked })} /> concluído</label>
                </Secao>

                <Secao icon={Tag} titulo="Etiquetas">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(c.etiquetas ?? []).filter((e) => e.nome || e.cor).map((e, i) => (
                      <span key={i} className={cn('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium', corEtiquetaClass(e.cor))}>
                        {e.nome || '—'}<button onClick={() => removerEtiqueta(i)} className="opacity-60 hover:opacity-100"><X className="size-3" /></button>
                      </span>
                    ))}
                  </div>
                  {labelsRestantes.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><button className="inline-flex w-fit items-center gap-1 rounded border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"><Plus className="size-3" /> do quadro</button></DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
                        <DropdownMenuLabel>Etiquetas do quadro</DropdownMenuLabel><DropdownMenuSeparator />
                        {labelsRestantes.map((e, i) => (
                          <DropdownMenuItem key={i} onClick={() => addEtiqueta(e)}><span className={cn('mr-2 inline-block h-3 w-6 rounded border', corEtiquetaClass(e.cor))} />{e.nome || '(sem nome)'}</DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
                    <span className="text-[10px] uppercase text-muted-foreground">Nova etiqueta</span>
                    <input value={novaEtNome} onChange={(e) => setNovaEtNome(e.target.value)} placeholder="nome (opcional)"
                      className="h-7 rounded border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
                    <div className="flex flex-wrap gap-1">
                      {CORES_ETIQUETA.map((cor) => (
                        <button key={cor} onClick={() => setNovaEtCor(cor)} title={cor}
                          className={cn('h-5 w-5 rounded border', corEtiquetaClass(cor), novaEtCor === cor && 'ring-2 ring-primary ring-offset-1 ring-offset-card')} />
                      ))}
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={criarEtiqueta}>Criar e aplicar</Button>
                  </div>
                </Secao>

                <Secao icon={Users} titulo="Membros">
                  <div className="flex flex-wrap gap-1.5">
                    {equipe.map((u) => {
                      const ativo = (c.membros ?? []).includes(u.nome ?? '');
                      return (
                        <button key={u.id} onClick={() => toggleMembro(u.nome ?? '')}
                          className={cn('rounded-full border px-2 py-0.5 text-[11px] transition-colors', ativo ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-secondary')}>{u.nome}</button>
                      );
                    })}
                  </div>
                </Secao>

                <button onClick={excluirCard} className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10">
                  <Trash2 className="size-3.5" /> Excluir card
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
