import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckSquare, Paperclip, AlignLeft, Plus, X, GripVertical, MoreHorizontal, Clock, Search, SlidersHorizontal, CalendarDays } from 'lucide-react';
import {
  getQuadro, listListas, listCartoes, moverCartao,
  criarCartao, criarLista, atualizarLista, arquivarLista,
  listCartoesArquivados, arquivarCartao,
  criarListaMes, clonarCardCheckup, gerarPostsMes, vincularTarefaLista, criarTarefaSocialMedia,
  MESES_PT, DIAS_SEMANA_CURTO,
} from './quadrosService';
import { listUsuarios } from '@/usuarios/usuariosService';
import type { Usuario } from '@/usuarios/types';
import { AvatarMembro } from '@/dashboard/AvatarMembro';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Archive } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { Quadro, Lista, Cartao, EtiquetaCartao } from './types';
import { capaCartao, capaEhCor, progressoChecklist, corEtiquetaSolida, corPrazoCard, fundoBoardStyle, STATUS_POST, corStatusPost, alertaAgendar, TIPO_POST_LABEL, OBJETIVO_POST } from './types';
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

const REDES_SIGLA: Record<string, string> = {
  instagram: 'IG', facebook: 'FB', tiktok: 'TK', linkedin: 'LI',
  youtube: 'YT', twitter: 'TW', pinterest: 'PI', google: 'GO',
};

function MiniCard({ c, onClick, onSoltarAntes, expandidas, onToggleEt, usuariosMap, ehPost }: {
  c: Cartao; onClick: () => void; onSoltarAntes: (cardId: string) => void;
  expandidas: boolean; onToggleEt: () => void; usuariosMap: Record<string, Usuario>;
  ehPost?: boolean;
}) {
  const memU = (c.membros_ids ?? []).map((id) => usuariosMap[id]).filter(Boolean) as Usuario[];
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
        'shrink-0 cursor-pointer overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40',
        over ? 'border-primary border-t-[3px] mt-1.5 shadow-[0_-3px_0_0_hsl(var(--primary))]' : 'border-border',
      )}
    >
      {capa && (capaEhCor(capa)
        ? <div style={{ background: capa }} className="h-20 w-full" />
        : <img src={capa} alt="" loading="lazy" className="h-28 w-full object-cover" />)}
      <div className="flex flex-col gap-1.5 p-2.5">
        {(c.etiquetas?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1" onClick={(e) => { e.stopPropagation(); onToggleEt(); }} role="button" title="Alternar etiquetas">
            {c.etiquetas!.filter((e) => e.nome || e.cor).slice(0, 8).map((e, i) => (
              expandidas
                ? <span key={i} className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight', corEtiquetaSolida(e.cor), !e.nome && 'min-w-9')}>{e.nome || ''}</span>
                : <span key={i} title={e.nome} className={cn('h-2 w-9 rounded-full', corEtiquetaSolida(e.cor).split(' ')[0])} />
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
          {memU.length > 0 ? (
            <span className="ml-auto inline-flex -space-x-1.5">
              {memU.slice(0, 4).map((u) => <AvatarMembro key={u.id} membro={u} className="size-5 border border-card text-[8px]" />)}
            </span>
          ) : (c.membros?.length ?? 0) > 0 && (
            <span className="ml-auto inline-flex -space-x-1">
              {c.membros!.slice(0, 3).map((m, i) => (
                <span key={i} title={m} className="grid size-5 place-items-center rounded-full bg-secondary text-[8px] font-bold ring-1 ring-card">{(m || '?').trim().charAt(0).toUpperCase()}</span>
              ))}
            </span>
          )}
        </div>
        {/* Info compacta de post (só em listas-mês) */}
        {ehPost && (c.status_post || c.formato || (c.redes?.length ?? 0) > 0) && (
          <div className="flex flex-wrap items-center gap-1 border-t border-border/40 pt-1.5">
            {c.status_post && (
              <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-semibold', corStatusPost(c.status_post))}>
                {STATUS_POST.find((s) => s.id === c.status_post)?.label ?? c.status_post}
              </span>
            )}
            {c.formato && (
              <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
                {TIPO_POST_LABEL[c.formato] ?? c.formato}
              </span>
            )}
            {c.objetivo && (
              <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
                {OBJETIVO_POST.find((o) => o.id === c.objetivo)?.label ?? c.objetivo}
              </span>
            )}
            {(c.redes ?? []).slice(0, 4).map((r) => (
              <span key={r} className="rounded bg-secondary/70 px-1 py-0.5 text-[8px] font-bold text-muted-foreground">
                {REDES_SIGLA[r] ?? r.slice(0, 2).toUpperCase()}
              </span>
            ))}
            {alertaAgendar(c) && (
              <span className="ml-auto rounded border border-amber-500/40 bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium text-amber-400" title="Agendar em breve!">⚠</span>
            )}
          </div>
        )}
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
  const [busca, setBusca] = useState('');
  const [fEt, setFEt] = useState<Set<string>>(new Set());
  const [fMem, setFMem] = useState<Set<string>>(new Set());
  const [etExpand, setEtExpand] = useState<boolean>(() => { try { return localStorage.getItem('wenox-kanban-et') !== 'bar'; } catch { return true; } });
  function toggleEtExpand() { setEtExpand((v) => { const n = !v; try { localStorage.setItem('wenox-kanban-et', n ? 'txt' : 'bar'); } catch { /* */ } return n; }); }
  function toggleSet(setFn: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) {
    setFn((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }
  const [usuariosMap, setUsuariosMap] = useState<Record<string, Usuario>>({});
  const [verArq, setVerArq] = useState(false);
  const [arquivados, setArquivados] = useState<Cartao[]>([]);
  const anoAtual = new Date().getFullYear();
  const [addMesOpen, setAddMesOpen] = useState(false);
  const [mesSel, setMesSel] = useState<number>(new Date().getMonth() + 1);
  const [anoSel, setAnoSel] = useState<number>(anoAtual);
  const [criandoMes, setCriandoMes] = useState(false);
  const [tipoQtd, setTipoQtd] = useState<'padrao8' | 'padrao12' | 'personalizado'>('padrao8');
  const [qtdCustom, setQtdCustom] = useState(8);
  const [diasCustom, setDiasCustom] = useState<number[]>([1, 3, 5]);
  useEffect(() => { listUsuarios().then((us) => { const m: Record<string, Usuario> = {}; for (const u of us) m[u.id] = u; setUsuariosMap(m); }).catch(() => { /* */ }); }, []);

  async function abrirArquivados() {
    setVerArq(true);
    try { setArquivados(await listCartoesArquivados(id)); } catch { /* */ }
  }
  async function restaurarCard(cid: string) {
    try { await arquivarCartao(cid, false); setArquivados((l) => l.filter((x) => x.id !== cid)); await recarregar(); } catch { /* */ }
  }

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

  const membrosDisponiveis = useMemo<string[]>(() => {
    const s = new Set<string>();
    for (const c of cartoes) for (const m of c.membros ?? []) if (m) s.add(m);
    return [...s].sort();
  }, [cartoes]);

  function passaFiltro(c: Cartao): boolean {
    if (busca) { const t = busca.toLowerCase(); if (!((c.nome ?? '').toLowerCase().includes(t) || (c.descricao ?? '').toLowerCase().includes(t))) return false; }
    if (fEt.size && !(c.etiquetas ?? []).some((e) => fEt.has((e.nome || '') + '|' + (e.cor || '')))) return false;
    if (fMem.size && !(c.membros ?? []).some((m) => fMem.has(m))) return false;
    return true;
  }
  const filtrando = !!busca || fEt.size > 0 || fMem.size > 0;

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

  async function adicionarMes() {
    if (criandoMes) return;
    setCriandoMes(true);
    setErro('');
    try {
      const ordem = (listas.length ? Math.max(...listas.map((l) => l.ordem ?? 0)) : 0) + 1;
      const listaCriada = await criarListaMes(id, mesSel, anoSel, ordem);

      // seedTemplateMes removido — posts agora vêm de gerarPostsMes
      const diasSemana = tipoQtd === 'padrao8' ? [2, 4] : tipoQtd === 'padrao12' ? [1, 3, 5] : diasCustom;
      const quantidade = tipoQtd === 'padrao8' ? 8 : tipoQtd === 'padrao12' ? 12 : qtdCustom;

      await clonarCardCheckup(id, listaCriada.id);
      await gerarPostsMes(id, listaCriada.id, mesSel, anoSel, diasSemana, quantidade);

      if (quadro?.cliente) {
        const tarefa = await criarTarefaSocialMedia(quadro.cliente, mesSel, anoSel);
        await vincularTarefaLista(listaCriada.id, tarefa.id);
      }
      setAddMesOpen(false);
      await recarregar();
    } catch {
      setErro('Não foi possível criar o mês.');
    } finally {
      setCriandoMes(false);
    }
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
        <div className="ml-auto flex items-center gap-1.5">
          {listas.some(l => l.tipo === 'mes') && (
            <Link
              to={`/quadros/${id}/calendario`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary"
            >
              <CalendarDays className="size-3.5" /> Calendário
            </Link>
          )}
          <button onClick={abrirArquivados} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary">
            <Archive className="size-3.5" /> Arquivados
          </button>
        </div>
        {erro && <span className="text-xs text-destructive">{erro}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar card"
            className="h-8 w-full rounded-md border border-input bg-background/40 pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={cn(filtrando && 'border-primary text-primary')}>
              <SlidersHorizontal /> Filtros{(fEt.size + fMem.size) > 0 ? ` (${fEt.size + fMem.size})` : ''}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
            {labelsDisponiveis.length > 0 && <DropdownMenuLabel>Etiquetas</DropdownMenuLabel>}
            {labelsDisponiveis.map((e, i) => {
              const k = (e.nome || '') + '|' + (e.cor || '');
              return (
                <DropdownMenuItem key={'e' + i} onSelect={(ev) => ev.preventDefault()} onClick={() => toggleSet(setFEt, k)}>
                  <span className={cn('mr-2 grid size-4 place-items-center rounded text-[9px]', fEt.has(k) ? 'bg-primary text-primary-foreground' : 'border border-border')}>{fEt.has(k) ? '✓' : ''}</span>
                  <span className={cn('mr-2 inline-block h-3 w-5 rounded', corEtiquetaSolida(e.cor).split(' ')[0])} />{e.nome || '(sem nome)'}
                </DropdownMenuItem>
              );
            })}
            {membrosDisponiveis.length > 0 && <><DropdownMenuSeparator /><DropdownMenuLabel>Membros</DropdownMenuLabel></>}
            {membrosDisponiveis.map((m, i) => (
              <DropdownMenuItem key={'m' + i} onSelect={(ev) => ev.preventDefault()} onClick={() => toggleSet(setFMem, m)}>
                <span className={cn('mr-2 grid size-4 place-items-center rounded text-[9px]', fMem.has(m) ? 'bg-primary text-primary-foreground' : 'border border-border')}>{fMem.has(m) ? '✓' : ''}</span>{m}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {filtrando && (
          <button onClick={() => { setBusca(''); setFEt(new Set()); setFMem(new Set()); }} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary">
            <X className="size-3.5" /> Limpar
          </button>
        )}
      </div>

      <div style={fundoBoardStyle(quadro)} className="flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto overflow-y-hidden rounded-xl border border-border/60 p-3">
        {listas.map((l) => {
          const cards = (porLista.get(l.id) ?? []).filter(passaFiltro);
          return (
            <div
              key={l.id}
              onDragOver={(e) => { if (dragCardId || dragListId) { e.preventDefault(); if (recebendo !== l.id) setRecebendo(l.id); } }}
              onDragLeave={() => setRecebendo((r) => (r === l.id ? null : r))}
              onDrop={(e) => { e.preventDefault(); if (dragListId) soltarLista(l.id); else soltarNoFim(l.id); }}
              className={cn('flex h-full min-h-0 w-72 shrink-0 flex-col gap-2 rounded-xl border bg-background/40 p-2', recebendo === l.id ? 'border-primary bg-primary/5' : 'border-border')}
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
                    <GripVertical className="size-3.5 text-muted-foreground/40" />
                    {l.tipo === 'mes' && <CalendarDays className="size-3.5 text-primary/70 shrink-0" />}
                    {l.nome}
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

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
                {cards.map((c) => (
                  <MiniCard key={c.id} c={c} onClick={() => setAbertoId(c.id)} onSoltarAntes={soltarAntes} expandidas={etExpand} onToggleEt={toggleEtExpand} usuariosMap={usuariosMap} ehPost={l.tipo === 'mes'} />
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

        {/* Adicionar lista / mês */}
        <div className="flex w-72 shrink-0 flex-col gap-2">
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
          <button
            onClick={() => setAddMesOpen(true)}
            className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-primary/40 px-3 py-2.5 text-sm text-primary/70 transition-colors hover:bg-primary/5 hover:text-primary"
          >
            <CalendarDays className="size-4" /> Adicionar mês
          </button>
        </div>

        {/* Dialog: adicionar mês */}
        <Dialog open={addMesOpen} onOpenChange={setAddMesOpen}>
          <DialogContent className="max-w-sm">
            <div className="flex flex-col gap-4 p-5">
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" /> Adicionar mês ao quadro
              </DialogTitle>

              {/* Mês / Ano */}
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Mês</label>
                  <select
                    value={mesSel}
                    onChange={(e) => setMesSel(Number(e.target.value))}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    {MESES_PT.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Ano</label>
                  <select
                    value={anoSel}
                    onChange={(e) => setAnoSel(Number(e.target.value))}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    <option value={anoAtual}>{anoAtual}</option>
                    <option value={anoAtual + 1}>{anoAtual + 1}</option>
                  </select>
                </div>
              </div>

              {/* Quantidade de posts */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-muted-foreground">Posts do mês</label>
                {([
                  { id: 'padrao8', label: '8 posts', desc: 'Terça e Quinta' },
                  { id: 'padrao12', label: '12 posts', desc: 'Seg, Qua e Sex' },
                  { id: 'personalizado', label: 'Personalizado', desc: 'Escolha os dias' },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTipoQtd(opt.id)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                      tipoQtd === opt.id ? 'border-primary bg-primary/5 text-foreground' : 'border-border hover:bg-secondary',
                    )}
                  >
                    <span className={cn('size-3.5 shrink-0 rounded-full border-2 transition-colors', tipoQtd === opt.id ? 'border-primary bg-primary' : 'border-muted-foreground')} />
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.desc}</span>
                  </button>
                ))}

                {/* Painel personalizado */}
                {tipoQtd === 'personalizado' && (
                  <div className="mt-1 flex flex-col gap-3 rounded-md border border-border bg-secondary/30 p-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Quantidade</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={qtdCustom}
                        onChange={(e) => setQtdCustom(Math.max(1, Number(e.target.value)))}
                        className="h-8 w-24 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-muted-foreground">Dias da semana</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DIAS_SEMANA_CURTO.map((dia, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setDiasCustom((prev) =>
                              prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort((a, b) => a - b),
                            )}
                            className={cn(
                              'rounded border px-2.5 py-1 text-xs font-medium transition-colors',
                              diasCustom.includes(idx) ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-secondary',
                            )}
                          >
                            {dia}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Button variant="outline" size="sm" onClick={() => setAddMesOpen(false)} disabled={criandoMes}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={adicionarMes} disabled={criandoMes || (tipoQtd === 'personalizado' && diasCustom.length === 0)}>
                  {criandoMes ? 'Criando…' : 'Confirmar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <CartaoSheet
        cartaoId={abertoId}
        aberto={abertoId !== null}
        labelsDisponiveis={labelsDisponiveis}
        clienteId={quadro.cliente}
        listaNome={listas.find((l) => l.id === cartoes.find((x) => x.id === abertoId)?.lista)?.nome}
        ehPost={listas.find((l) => l.id === cartoes.find((x) => x.id === abertoId)?.lista)?.tipo === 'mes'}
        onClose={() => setAbertoId(null)}
        onMudou={recarregar}
      />

      <Dialog open={verArq} onOpenChange={setVerArq}>
        <DialogContent className="max-w-md">
          <div className="flex max-h-[80vh] flex-col gap-3 overflow-y-auto p-5">
            <DialogTitle className="flex items-center gap-2"><Archive className="size-4" /> Cartões arquivados</DialogTitle>
            {arquivados.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum cartão arquivado.</p>
            ) : arquivados.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                <span className="min-w-0 flex-1 truncate text-sm">{a.nome}</span>
                <button onClick={() => restaurarCard(a.id)} className="shrink-0 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary">Restaurar</button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
