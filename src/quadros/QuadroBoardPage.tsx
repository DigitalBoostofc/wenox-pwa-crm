import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckSquare, Paperclip, AlignLeft, Plus, X, GripVertical, MoreHorizontal, Clock } from 'lucide-react';
import {
  getQuadro, listListas, listCartoes, moverCartao,
  criarCartao, criarLista, atualizarLista, arquivarLista,
} from './quadrosService';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import type { Quadro, Lista, Cartao, EtiquetaCartao } from './types';
import { capaCartao, capaEhCor, progressoChecklist, corEtiquetaSolida, corPrazoCard, fundoBoardStyle } from './types';
import { CartaoSheet } from './CartaoSheet';
import { prazoBR } from '@/tarefas/format';
import { logoUrl } from '@/clientes/clientesService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// arraste atual (módulo-local; dataTransfer não é legível no dragover).
let dragCardId: string | null = null;
let dragListId: string | null = null;

function MiniCard({ c, onClick, onSoltarAntes }: {
  c: Cartao; onClick: () => void; onSoltarAntes: (cardId: string) => void;
}) {
  const capa = capaCartao(c);
  const { feitos, total } = progressoChecklist(c);
  const nAnexos = (c.anexos ?? []).length;
  const [over, setOver] = useState(false);
  return (
    <div
      draggable
      onDragStart={(e) => { dragCardId = c.id; dragListId = null; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/card', c.id); }}
      onDragOver={(e) => { if (dragCardId && dragCardId !== c.id) { e.preventDefault(); e.stopPropagation(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (dragCardId) { e.preventDefault(); e.stopPropagation(); setOver(false); onSoltarAntes(c.id); } }}
      onClick={onClick}
      className={cn(
        'cursor-pointer overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40',
        over ? 'border-primary border-t-2' : 'border-border',
      )}
    >
      {capa && (capaEhCor(capa)
        ? <div style={{ background: capa }} className="h-20 w-full" />
        : <img src={capa} alt="" loading="lazy" className="h-28 w-full object-cover" />)}
      <div className="flex flex-col gap-1.5 p-2.5">
        {(c.etiquetas?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {c.etiquetas!.filter((e) => e.nome || e.cor).slice(0, 6).map((e, i) => (
              <span key={i} className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight', corEtiquetaSolida(e.cor), !e.nome && 'min-w-9')}>{e.nome || ''}</span>
            ))}
          </div>
        )}
        <p className="text-sm leading-snug">{c.nome}</p>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          {c.prazo && (
            <span className={cn('inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-medium', corPrazoCard(c.prazo, c.concluido))}>
              <Clock className="size-3" />{prazoBR(c.prazo)}
            </span>
          )}
          {total > 0 && <span className="inline-flex items-center gap-0.5"><CheckSquare className="size-3" />{feitos}/{total}</span>}
          {nAnexos > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip className="size-3" />{nAnexos}</span>}
          {(c.descricao ?? '').trim() && <AlignLeft className="size-3" />}
          {(c.membros?.length ?? 0) > 0 && (
            <span className="ml-auto inline-flex -space-x-1">
              {c.membros!.slice(0, 3).map((m, i) => (
                <span key={i} title={m} className="grid size-4 place-items-center rounded-full bg-secondary text-[8px] font-bold ring-1 ring-card">{(m || '?').trim().charAt(0).toUpperCase()}</span>
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function QuadroBoardPage({ id }: { id: string }) {
  const [quadro, setQuadro] = useState<Quadro | null>(null);
  const [listas, setListas] = useState<Lista[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [recebendo, setRecebendo] = useState<string | null>(null);
  const [addEm, setAddEm] = useState<string | null>(null);   // listaId onde está criando card
  const [addTexto, setAddTexto] = useState('');
  const [novaLista, setNovaLista] = useState<string | null>(null); // '' = input aberto
  const [renomeando, setRenomeando] = useState<string | null>(null);

  async function recarregar() {
    const [ls, cs] = await Promise.all([listListas(id), listCartoes(id)]);
    setListas(ls); setCartoes(cs);
  }

  useEffect(() => {
    setCarregando(true);
    Promise.all([getQuadro(id), listListas(id), listCartoes(id)])
      .then(([q, ls, cs]) => { setQuadro(q); setListas(ls); setCartoes(cs); setErro(''); })
      .catch(() => setErro('Não foi possível carregar o quadro.'))
      .finally(() => setCarregando(false));
  }, [id]);

  const porLista = useMemo(() => {
    const m = new Map<string, Cartao[]>();
    for (const l of listas) m.set(l.id, []);
    for (const c of cartoes) if (c.lista && m.has(c.lista)) m.get(c.lista)!.push(c);
    for (const arr of m.values()) arr.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    return m;
  }, [listas, cartoes]);

  const labelsDisponiveis = useMemo<EtiquetaCartao[]>(() => {
    const seen = new Map<string, EtiquetaCartao>();
    for (const c of cartoes) for (const e of c.etiquetas ?? []) {
      const k = (e.nome || '') + '|' + (e.cor || '');
      if ((e.nome || e.cor) && !seen.has(k)) seen.set(k, { nome: e.nome || '', cor: e.cor || '' });
    }
    return [...seen.values()];
  }, [cartoes]);

  async function persistirMover(cardId: string, listaId: string, ordem: number) {
    setCartoes((lst) => lst.map((x) => (x.id === cardId ? { ...x, lista: listaId, ordem } : x)));
    try { await moverCartao(cardId, listaId, ordem); } catch { setErro('Não foi possível mover o card.'); }
  }

  function soltarNoFim(listaId: string) {
    setRecebendo(null);
    if (!dragCardId) return;
    const c = cartoes.find((x) => x.id === dragCardId);
    if (!c) return;
    const alvo = (porLista.get(listaId) ?? []).filter((x) => x.id !== dragCardId);
    const ordem = (alvo.length ? Math.max(...alvo.map((x) => x.ordem ?? 0)) : 0) + 1;
    const cid = dragCardId; dragCardId = null;
    persistirMover(cid, listaId, ordem);
  }

  function soltarAntes(alvoCardId: string) {
    setRecebendo(null);
    if (!dragCardId || dragCardId === alvoCardId) return;
    const alvo = cartoes.find((x) => x.id === alvoCardId);
    if (!alvo || !alvo.lista) return;
    const lista = alvo.lista;
    const irmaos = (porLista.get(lista) ?? []).filter((x) => x.id !== dragCardId);
    const idx = irmaos.findIndex((x) => x.id === alvoCardId);
    const anterior = idx > 0 ? irmaos[idx - 1] : null;
    const ordem = anterior ? ((anterior.ordem ?? 0) + (alvo.ordem ?? 0)) / 2 : (alvo.ordem ?? 1) - 1;
    const cid = dragCardId; dragCardId = null;
    persistirMover(cid, lista, ordem);
  }

  async function soltarLista(alvoListaId: string) {
    if (!dragListId || dragListId === alvoListaId) { dragListId = null; return; }
    const ordenadas = [...listas].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const movida = ordenadas.find((l) => l.id === dragListId)!;
    const resto = ordenadas.filter((l) => l.id !== dragListId);
    const idx = resto.findIndex((l) => l.id === alvoListaId);
    resto.splice(idx, 0, movida);
    const reord = resto.map((l, i) => ({ ...l, ordem: i }));
    setListas(reord);
    dragListId = null;
    try { await Promise.all(reord.map((l) => atualizarLista(l.id, { ordem: l.ordem }))); }
    catch { setErro('Não foi possível reordenar as listas.'); }
  }

  async function adicionarCard(listaId: string) {
    const nome = addTexto.trim();
    if (!nome) { setAddEm(null); return; }
    const alvo = porLista.get(listaId) ?? [];
    const ordem = (alvo.length ? Math.max(...alvo.map((x) => x.ordem ?? 0)) : 0) + 1;
    try {
      const novo = await criarCartao(id, listaId, nome, ordem);
      setCartoes((lst) => [...lst, novo]);
      setAddTexto('');
    } catch { setErro('Não foi possível criar o card.'); }
  }

  async function adicionarLista() {
    const nome = (novaLista ?? '').trim();
    if (!nome) { setNovaLista(null); return; }
    const ordem = (listas.length ? Math.max(...listas.map((l) => l.ordem ?? 0)) : 0) + 1;
    try {
      const nl = await criarLista(id, nome, ordem);
      setListas((lst) => [...lst, nl]);
      setNovaLista(null);
    } catch { setErro('Não foi possível criar a lista.'); }
  }

  async function arquivar(listaId: string) {
    if (!confirm('Arquivar esta lista? Ela some do quadro (os dados ficam guardados).')) return;
    setListas((lst) => lst.filter((l) => l.id !== listaId));
    try { await arquivarLista(listaId); } catch { setErro('Não foi possível arquivar a lista.'); }
  }

  async function renomearLista(listaId: string, nome: string) {
    setRenomeando(null);
    const n = nome.trim();
    const atual = listas.find((l) => l.id === listaId);
    if (!n || !atual || n === atual.nome) return;
    setListas((lst) => lst.map((l) => (l.id === listaId ? { ...l, nome: n } : l)));
    try { await atualizarLista(listaId, { nome: n }); } catch { setErro('Não foi possível renomear a lista.'); }
  }

  if (carregando) return <Skeleton className="h-[70vh] w-full rounded-xl" />;
  if (erro && !quadro) return <p className="text-sm text-destructive">{erro}</p>;
  if (!quadro) return null;

  const cli = quadro.expand?.cliente;
  const logo = cli?.logo ? logoUrl(cli as never, '100x100') : '';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link to="/quadros" className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><ArrowLeft className="size-5" /></Link>
        {logo && <img src={logo} alt="" className="size-7 rounded-md object-cover" />}
        <h2 className="text-lg font-semibold">{quadro.nome}</h2>
        <Badge variant="muted" className="text-[10px]">{cartoes.length} cards</Badge>
        {erro && <span className="text-xs text-destructive">{erro}</span>}
      </div>

      <div style={fundoBoardStyle(quadro)} className="flex flex-1 items-start gap-3 overflow-x-auto rounded-xl border border-border/60 p-3">
        {listas.map((l) => {
          const cards = porLista.get(l.id) ?? [];
          return (
            <div
              key={l.id}
              onDragOver={(e) => { if (dragCardId || dragListId) { e.preventDefault(); if (recebendo !== l.id) setRecebendo(l.id); } }}
              onDragLeave={() => setRecebendo((r) => (r === l.id ? null : r))}
              onDrop={(e) => { e.preventDefault(); if (dragListId) soltarLista(l.id); else soltarNoFim(l.id); }}
              className={cn('flex max-h-full w-72 shrink-0 flex-col gap-2 rounded-xl border bg-background/40 p-2', recebendo === l.id ? 'border-primary bg-primary/5' : 'border-border')}
            >
              <div
                draggable
                onDragStart={(e) => { dragListId = l.id; dragCardId = null; e.dataTransfer.effectAllowed = 'move'; }}
                className="flex cursor-grab items-center justify-between gap-1 px-1.5 py-1"
              >
                {renomeando === l.id ? (
                  <input
                    autoFocus defaultValue={l.nome}
                    onBlur={(e) => renomearLista(l.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenomeando(null); }}
                    className="h-7 flex-1 rounded border border-input bg-background px-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  />
                ) : (
                  <span className="flex items-center gap-1 text-sm font-semibold" onClick={() => setRenomeando(l.id)} role="button">
                    <GripVertical className="size-3.5 text-muted-foreground/40" />{l.nome}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <Badge variant="muted" className="text-[10px]">{cards.length}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button onClick={(e) => e.stopPropagation()} className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Ações da lista"><MoreHorizontal className="size-4" /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setRenomeando(l.id)}>Renomear</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => arquivar(l.id)} className="text-destructive">Arquivar lista</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto pr-0.5">
                {cards.map((c) => (
                  <MiniCard key={c.id} c={c} onClick={() => setAbertoId(c.id)} onSoltarAntes={soltarAntes} />
                ))}
              </div>

              {addEm === l.id ? (
                <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-2">
                  <textarea
                    autoFocus value={addTexto} rows={2}
                    onChange={(e) => setAddTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); adicionarCard(l.id); } if (e.key === 'Escape') { setAddEm(null); setAddTexto(''); } }}
                    placeholder="Insira um título para o cartão…"
                    className="w-full resize-none rounded border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="h-7 text-xs" onClick={() => adicionarCard(l.id)}>Adicionar</Button>
                    <button onClick={() => { setAddEm(null); setAddTexto(''); }} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setAddEm(l.id); setAddTexto(''); }} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                  <Plus className="size-3.5" /> Adicionar um cartão
                </button>
              )}
            </div>
          );
        })}

        {/* Adicionar lista */}
        <div className="w-72 shrink-0">
          {novaLista !== null ? (
            <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-background/40 p-2">
              <input
                autoFocus value={novaLista}
                onChange={(e) => setNovaLista(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') adicionarLista(); if (e.key === 'Escape') setNovaLista(null); }}
                placeholder="Insira o nome da lista…"
                className="h-8 rounded border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              />
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={adicionarLista}>Adicionar lista</Button>
                <button onClick={() => setNovaLista(null)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
              </div>
            </div>
          ) : (
            <button onClick={() => setNovaLista('')} className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <Plus className="size-4" /> Adicionar uma lista
            </button>
          )}
        </div>
      </div>

      <CartaoSheet
        cartaoId={abertoId}
        aberto={abertoId !== null}
        labelsDisponiveis={labelsDisponiveis}
        clienteId={quadro.cliente}
        onClose={() => setAbertoId(null)}
        onMudou={recarregar}
      />
    </div>
  );
}
