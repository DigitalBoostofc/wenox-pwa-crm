import { useEffect, useRef, useState } from 'react';
import {
  CheckSquare, Paperclip, Tag, Calendar, Users, X, Trash2, MessageSquare, ImageIcon,
} from 'lucide-react';
import {
  getCartao, atualizarCartao, removerCartao, arquivarCartao,
  subirAnexos, urlUpload,
  listComentariosCartao, addComentarioCartao, removerComentarioCartao,
} from './quadrosService';
import { AvatarMembro } from '@/dashboard/AvatarMembro';
import { Archive } from 'lucide-react';
import type { Cartao, EtiquetaCartao, ComentarioCartao } from './types';
import { progressoChecklist, corEtiquetaSolida, corPrazoCard, capaCartao, capaEhCor, CORES_ETIQUETA, CORES_CAPA } from './types';
import { prazoBR } from '@/tarefas/format';
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Painel = 'membros' | 'etiquetas' | 'datas' | 'capa' | null;

function AcaoBtn({ icon: Icon, label, onClick }: { icon: typeof Tag; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 text-xs font-medium text-foreground/90 transition-colors hover:bg-secondary/70">
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

export function CartaoSheet({ cartaoId, aberto, labelsDisponiveis = [], clienteId, listaNome, onClose, onMudou }: {
  cartaoId: string | null; aberto: boolean; labelsDisponiveis?: EtiquetaCartao[]; clienteId?: string; listaNome?: string;
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
  const [comentarios, setComentarios] = useState<ComentarioCartao[]>([]);
  const [novoComent, setNovoComent] = useState('');
  const [painel, setPainel] = useState<Painel>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cartaoId) { setC(null); setComentarios([]); return; }
    setPainel(null); setEditandoDesc(false);
    setCarregando(true);
    getCartao(cartaoId).then((r) => { setC(r); setDescRasc(r.descricao ?? ''); }).catch(() => setC(null)).finally(() => setCarregando(false));
    listComentariosCartao(cartaoId).then(setComentarios).catch(() => setComentarios([]));
  }, [cartaoId]);
  useEffect(() => { listUsuarios().then((us) => setEquipe(us.filter((u) => u.role !== 'Cliente'))).catch(() => { /* */ }); }, []);

  async function salvar(dados: Partial<Cartao>) {
    if (!c) return;
    setC({ ...c, ...dados });
    try { await atualizarCartao(c.id, dados); onMudou?.(); } catch { /* */ }
  }
  function toggleItem(ci: number, ii: number) { if (c) salvar({ checklists: (c.checklists ?? []).map((ch, i) => i !== ci ? ch : { ...ch, itens: ch.itens.map((it, j) => (j === ii ? { ...it, feito: !it.feito } : it)) }) }); }
  function removerItem(ci: number, ii: number) { if (c) salvar({ checklists: (c.checklists ?? []).map((ch, i) => i !== ci ? ch : { ...ch, itens: ch.itens.filter((_, j) => j !== ii) }) }); }
  function addItem(ci: number) {
    if (!c) return; const txt = (novoItem[ci] ?? '').trim(); if (!txt) return;
    salvar({ checklists: (c.checklists ?? []).map((ch, i) => i !== ci ? ch : { ...ch, itens: [...ch.itens, { texto: txt, feito: false }] }) });
    setNovoItem((m) => ({ ...m, [ci]: '' }));
  }
  function addChecklist(nome?: string) {
    if (!c) return; const n = (nome ?? novaCl).trim() || 'Checklist';
    salvar({ checklists: [...(c.checklists ?? []), { nome: n, itens: [] }] }); setNovaCl('');
  }
  function removerChecklist(ci: number) { if (c) salvar({ checklists: (c.checklists ?? []).filter((_, i) => i !== ci) }); }
  function removerEtiqueta(idx: number) { if (c) salvar({ etiquetas: (c.etiquetas ?? []).filter((_, i) => i !== idx) }); }
  function addEtiqueta(e: EtiquetaCartao) { if (c && !(c.etiquetas ?? []).some((x) => x.nome === e.nome && x.cor === e.cor)) salvar({ etiquetas: [...(c.etiquetas ?? []), e] }); }
  function criarEtiqueta() { const n = novaEtNome.trim(); addEtiqueta({ nome: n, cor: novaEtCor }); setNovaEtNome(''); }
  function toggleMembro(uid: string) { if (!c) return; const a = c.membros_ids ?? []; salvar({ membros_ids: a.includes(uid) ? a.filter((m) => m !== uid) : [...a, uid] }); }
  async function excluirCard() { if (!c || !confirm('Excluir este card? Esta ação não pode ser desfeita.')) return; try { await removerCartao(c.id); onMudou?.(); onClose(); } catch { /* */ } }
  async function arquivar() { if (!c) return; try { await arquivarCartao(c.id, true); onMudou?.(); onClose(); } catch { /* */ } }
  async function enviarComentario() { if (!c) return; const t = novoComent.trim(); if (!t) return; setNovoComent(''); try { await addComentarioCartao(c.id, t, clienteId); setComentarios(await listComentariosCartao(c.id)); } catch { /* */ } }
  async function apagarComentario(cid: string) { try { await removerComentarioCartao(cid); setComentarios((l) => l.filter((x) => x.id !== cid)); } catch { /* */ } }
  async function onUpload(files: FileList | null) {
    if (!c || !files || files.length === 0) return;
    try { setC(await subirAnexos(c, Array.from(files))); onMudou?.(); } catch { /* */ } finally { if (fileRef.current) fileRef.current.value = ''; }
  }

  const ehImg = (n: string) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(n);
  const imgs: { url: string; nome?: string }[] = [
    ...(c?.anexos ?? []).filter((a) => (a.mime ?? '').startsWith('image') && a.url).map((a) => ({ url: a.url!, nome: a.nome })),
    ...(c?.uploads ?? []).filter(ehImg).map((fn) => ({ url: urlUpload(c!, fn), nome: fn })),
  ];
  const outros: { url: string; nome?: string }[] = [
    ...(c?.anexos ?? []).filter((a) => !(a.mime ?? '').startsWith('image') && a.url).map((a) => ({ url: a.url!, nome: a.nome })),
    ...(c?.uploads ?? []).filter((fn) => !ehImg(fn)).map((fn) => ({ url: urlUpload(c!, fn), nome: fn })),
  ];
  const prog = c ? progressoChecklist(c) : { feitos: 0, total: 0 };
  const labelsRestantes = labelsDisponiveis.filter((d) => !(c?.etiquetas ?? []).some((x) => x.nome === d.nome && x.cor === d.cor));
  const capa = c ? capaCartao(c) : null;
  const temEt = (c?.etiquetas ?? []).filter((e) => e.nome || e.cor).length > 0;
  const memUsuarios = (c?.membros_ids ?? []).map((id) => equipe.find((u) => u.id === id)).filter(Boolean) as Usuario[];
  const temMem = memUsuarios.length > 0;

  const inputCls = 'w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

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
            {/* capa em banner (cor ou imagem) com etiqueta da lista + botão de capa */}
            <div className="relative w-full shrink-0">
              {capa
                ? (capaEhCor(capa)
                    ? <div style={{ background: capa }} className="h-32 w-full" />
                    : <img src={capa} alt="" className="h-44 w-full object-cover" />)
                : <div className="h-12 w-full bg-secondary/40" />}
              {listaNome && (
                <span className="absolute left-4 top-3 inline-flex items-center rounded-md bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">{listaNome}</span>
              )}
              <button onClick={() => setPainel(painel === 'capa' ? null : 'capa')} title="Capa"
                className="absolute right-12 top-3 grid size-7 place-items-center rounded-md bg-black/55 text-white backdrop-blur-sm hover:bg-black/75"><ImageIcon className="size-4" /></button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              {/* principal (scroll próprio) */}
              <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
                <DialogTitle className="pr-8">
                  <input defaultValue={c.nome} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.nome) salvar({ nome: v }); }}
                    className="w-full rounded-md bg-transparent text-xl font-semibold leading-snug outline-none focus:bg-secondary/40 focus:px-2 focus:py-1" />
                </DialogTitle>

                {/* chips de props (quando preenchidos) */}
                {(temMem || temEt || c.prazo) && (
                  <div className="flex flex-wrap gap-4">
                    {temMem && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase text-muted-foreground">Membros</span>
                        <div className="flex flex-wrap gap-1">
                          {memUsuarios.map((u) => <AvatarMembro key={u.id} membro={u} className="size-7 text-[11px]" />)}
                        </div>
                      </div>
                    )}
                    {temEt && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase text-muted-foreground">Etiquetas</span>
                        <div className="flex flex-wrap gap-1">
                          {(c.etiquetas ?? []).filter((e) => e.nome || e.cor).map((e, i) => (
                            <span key={i} className={cn('inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold', corEtiquetaSolida(e.cor))}>
                              {e.nome || '—'}<button onClick={() => removerEtiqueta(i)} className="opacity-70 hover:opacity-100"><X className="size-3" /></button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {c.prazo && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase text-muted-foreground">Data</span>
                        <span className={cn('inline-flex w-fit items-center gap-1 rounded px-2 py-0.5 text-xs font-medium', corPrazoCard(c.prazo, c.concluido))}>{prazoBR(c.prazo)}{c.concluido ? ' ✓' : ''}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* barra de ações */}
                <div className="flex flex-wrap gap-2">
                  <AcaoBtn icon={Users} label="Membros" onClick={() => setPainel(painel === 'membros' ? null : 'membros')} />
                  <AcaoBtn icon={Tag} label="Etiquetas" onClick={() => setPainel(painel === 'etiquetas' ? null : 'etiquetas')} />
                  <AcaoBtn icon={Calendar} label="Datas" onClick={() => setPainel(painel === 'datas' ? null : 'datas')} />
                  <AcaoBtn icon={CheckSquare} label="Checklist" onClick={() => addChecklist('Checklist')} />
                  <AcaoBtn icon={Paperclip} label="Anexo" onClick={() => fileRef.current?.click()} />
                  <AcaoBtn icon={ImageIcon} label="Capa" onClick={() => setPainel(painel === 'capa' ? null : 'capa')} />
                  <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onUpload(e.target.files)} />
                </div>

                {/* painel ativo (popover inline estilo Trello) */}
                {painel && (
                  <div className="rounded-md border border-border bg-background/60 p-3">
                    {painel === 'membros' && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold">Membros</span>
                        <div className="flex flex-wrap gap-1.5">
                          {equipe.map((u) => {
                            const ativo = (c.membros_ids ?? []).includes(u.id);
                            return (
                              <button key={u.id} onClick={() => toggleMembro(u.id)} className={cn('inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs transition-colors', ativo ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:bg-secondary')}>
                                <AvatarMembro membro={u} className="size-5 text-[9px]" />{u.nome}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {painel === 'etiquetas' && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold">Etiquetas</span>
                        {labelsRestantes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {labelsRestantes.map((e, i) => (
                              <button key={i} onClick={() => addEtiqueta(e)} className={cn('rounded px-2 py-0.5 text-xs font-semibold', corEtiquetaSolida(e.cor))}>{e.nome || '+'}</button>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
                          <span className="text-[10px] uppercase text-muted-foreground">Nova etiqueta</span>
                          <input value={novaEtNome} onChange={(e) => setNovaEtNome(e.target.value)} placeholder="nome (opcional)" className={inputCls} />
                          <div className="flex flex-wrap gap-1">
                            {CORES_ETIQUETA.map((cor) => (
                              <button key={cor} onClick={() => setNovaEtCor(cor)} title={cor} className={cn('h-6 w-8 rounded', corEtiquetaSolida(cor), novaEtCor === cor && 'ring-2 ring-primary ring-offset-1 ring-offset-card')} />
                            ))}
                          </div>
                          <Button size="sm" variant="outline" className="h-7 w-fit text-xs" onClick={criarEtiqueta}>Criar e aplicar</Button>
                        </div>
                      </div>
                    )}
                    {painel === 'datas' && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold">Data de entrega</span>
                        <input type="date" value={(c.prazo ?? '').slice(0, 10)} onChange={(e) => salvar({ prazo: e.target.value })} className="h-8 w-fit rounded-md border border-input bg-background px-2 text-sm" />
                        <label className="inline-flex items-center gap-1.5 text-xs"><input type="checkbox" checked={!!c.concluido} onChange={(e) => salvar({ concluido: e.target.checked })} /> concluído</label>
                        {c.prazo && <button onClick={() => salvar({ prazo: '' })} className="w-fit text-xs text-destructive hover:underline">Remover data</button>}
                      </div>
                    )}
                    {painel === 'capa' && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold">Capa</span>
                        <div className="flex flex-wrap gap-1.5">
                          {CORES_CAPA.map((hex) => (
                            <button key={hex} onClick={() => salvar({ capa: hex })} style={{ background: hex }} className={cn('h-9 w-14 rounded', c.capa === hex && 'ring-2 ring-primary ring-offset-1 ring-offset-card')} />
                          ))}
                        </div>
                        {imgs.length > 0 && <span className="text-[11px] text-muted-foreground">Pra usar uma imagem como capa, passe o mouse numa imagem em Anexos e clique no ícone.</span>}
                        {c.capa && <button onClick={() => salvar({ capa: '' })} className="w-fit text-xs text-destructive hover:underline">Remover capa</button>}
                      </div>
                    )}
                  </div>
                )}

                {/* Descrição */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><MessageSquare className="size-3.5 opacity-0" /> Descrição</div>
                  {editandoDesc ? (
                    <div className="flex flex-col gap-2">
                      <textarea autoFocus value={descRasc} rows={6} onChange={(e) => setDescRasc(e.target.value)} className="w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
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
                </div>

                {/* Checklists */}
                {(c.checklists ?? []).length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><CheckSquare className="size-3.5" /> Checklists ({prog.feitos}/{prog.total})</div>
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
                          <input value={novoItem[ci] ?? ''} onChange={(e) => setNovoItem((m) => ({ ...m, [ci]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') addItem(ci); }} placeholder="+ adicionar item" className="h-7 rounded border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Anexos */}
                {(imgs.length + outros.length) > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Paperclip className="size-3.5" /> Anexos ({imgs.length + outros.length})</div>
                    {imgs.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {imgs.map((a, i) => (
                          <div key={i} className="group relative overflow-hidden rounded-md border border-border">
                            <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.nome ?? ''} loading="lazy" className={cn('aspect-square w-full object-cover', c.capa === a.url && 'ring-2 ring-primary')} /></a>
                            <button onClick={() => salvar({ capa: a.url })} title="Definir como capa" className="absolute bottom-1 right-1 grid size-6 place-items-center rounded bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/80"><ImageIcon className="size-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {outros.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {outros.map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer" className="truncate text-sm text-primary hover:underline">{a.nome || a.url}</a>)}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button onClick={arquivar} className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary"><Archive className="size-3.5" /> Arquivar</button>
                  <button onClick={excluirCard} className="inline-flex w-fit items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"><Trash2 className="size-3.5" /> Excluir</button>
                </div>
              </div>

              {/* coluna direita: comentários/atividade (input fixo, lista rola — estilo Trello) */}
              <div className="flex max-h-full w-full shrink-0 flex-col gap-3 border-t border-border p-5 md:w-80 md:border-l md:border-t-0">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><MessageSquare className="size-3.5" /> Comentários ({comentarios.length})</div>
                <textarea value={novoComent} onChange={(e) => setNovoComent(e.target.value)} rows={2} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarComentario(); } }} placeholder="Escrever um comentário…" className="w-full resize-none rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
                {novoComent.trim() && <Button size="sm" className="h-7 w-fit text-xs" onClick={enviarComentario}>Comentar</Button>}
                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                  {comentarios.map((cm) => (
                    <div key={cm.id} className="rounded-md border border-border bg-background/40 p-2 text-sm">
                      <div className="mb-0.5 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">{cm.expand?.autor?.nome ?? 'Alguém'}</span>
                        <button onClick={() => apagarComentario(cm.id)} className="hover:text-destructive"><Trash2 className="size-3" /></button>
                      </div>
                      <p className="whitespace-pre-wrap">{cm.texto}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
