import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckSquare, Paperclip, AlignLeft } from 'lucide-react';
import { getQuadro, listListas, listCartoes, moverCartao } from './quadrosService';
import type { Quadro, Lista, Cartao } from './types';
import { capaCartao, progressoChecklist, corEtiquetaClass } from './types';
import { CartaoSheet } from './CartaoSheet';
import { prazoBR } from '@/tarefas/format';
import { logoUrl } from '@/clientes/clientesService';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// id do card sendo arrastado (módulo-local; o dataTransfer não é lido no dragOver).
let dragId: string | null = null;

function MiniCard({ c, onClick, onDragStart }: {
  c: Cartao; onClick: () => void; onDragStart: (e: React.DragEvent) => void;
}) {
  const capa = capaCartao(c);
  const { feitos, total } = progressoChecklist(c);
  const nAnexos = (c.anexos ?? []).length;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="cursor-pointer overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40"
    >
      {capa && (
        <img src={capa} alt="" loading="lazy" className="h-28 w-full object-cover" />
      )}
      <div className="flex flex-col gap-1.5 p-2.5">
        {(c.etiquetas?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {c.etiquetas!.filter((e) => e.nome || e.cor).slice(0, 6).map((e, i) => (
              <span key={i} className={cn('rounded border px-1.5 py-0.5 text-[9px] font-medium', corEtiquetaClass(e.cor))}>
                {e.nome || ' '}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm leading-snug">{c.nome}</p>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          {c.prazo && <span className={cn('rounded px-1', c.concluido ? 'text-emerald-400' : '')}>📅 {prazoBR(c.prazo)}</span>}
          {total > 0 && <span className="inline-flex items-center gap-0.5"><CheckSquare className="size-3" />{feitos}/{total}</span>}
          {nAnexos > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip className="size-3" />{nAnexos}</span>}
          {(c.descricao ?? '').trim() && <AlignLeft className="size-3" />}
          {(c.membros?.length ?? 0) > 0 && (
            <span className="ml-auto inline-flex -space-x-1">
              {c.membros!.slice(0, 3).map((m, i) => (
                <span key={i} title={m} className="grid size-4 place-items-center rounded-full bg-secondary text-[8px] font-bold text-foreground ring-1 ring-card">
                  {(m || '?').trim().charAt(0).toUpperCase()}
                </span>
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
    for (const c of cartoes) {
      if (c.lista && m.has(c.lista)) m.get(c.lista)!.push(c);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    return m;
  }, [listas, cartoes]);

  async function soltarNaLista(listaId: string) {
    setRecebendo(null);
    const cardId = dragId;
    if (!cardId) return;
    const c = cartoes.find((x) => x.id === cardId);
    if (!c || c.lista === listaId) return;
    const alvo = porLista.get(listaId) ?? [];
    const novaOrdem = (alvo.length ? Math.max(...alvo.map((x) => x.ordem ?? 0)) : 0) + 1;
    setCartoes((lst) => lst.map((x) => (x.id === cardId ? { ...x, lista: listaId, ordem: novaOrdem } : x)));
    try { await moverCartao(cardId, listaId, novaOrdem); }
    catch { setErro('Não foi possível mover o card.'); }
  }

  if (carregando) return <Skeleton className="h-[70vh] w-full rounded-xl" />;
  if (erro || !quadro) return <p className="text-sm text-destructive">{erro || 'Quadro não encontrado.'}</p>;

  const cli = quadro.expand?.cliente;
  const logo = cli?.logo ? logoUrl(cli as never, '100x100') : '';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link to="/quadros" className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><ArrowLeft className="size-5" /></Link>
        {logo && <img src={logo} alt="" className="size-7 rounded-md object-cover" />}
        <h2 className="text-lg font-semibold">{quadro.nome}</h2>
        <Badge variant="muted" className="text-[10px]">{cartoes.length} cards</Badge>
      </div>

      <div className="flex flex-1 gap-3 overflow-x-auto pb-3">
        {listas.map((l) => {
          const cards = porLista.get(l.id) ?? [];
          return (
            <div
              key={l.id}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (recebendo !== l.id) setRecebendo(l.id); }}
              onDragLeave={() => setRecebendo((r) => (r === l.id ? null : r))}
              onDrop={(e) => { e.preventDefault(); soltarNaLista(l.id); }}
              className={cn(
                'flex w-72 shrink-0 flex-col gap-2 rounded-xl border bg-background/40 p-2',
                recebendo === l.id ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              <div className="flex items-center justify-between px-1.5 py-1">
                <span className="text-sm font-semibold">{l.nome}</span>
                <Badge variant="muted" className="text-[10px]">{cards.length}</Badge>
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto pr-0.5">
                {cards.map((c) => (
                  <MiniCard
                    key={c.id}
                    c={c}
                    onClick={() => setAbertoId(c.id)}
                    onDragStart={(e) => { dragId = c.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/card-id', c.id); }}
                  />
                ))}
                {cards.length === 0 && (
                  <p className="rounded-md border border-dashed border-border/60 px-2 py-3 text-center text-[11px] text-muted-foreground">vazio</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CartaoSheet
        cartaoId={abertoId}
        aberto={abertoId !== null}
        onClose={() => setAbertoId(null)}
      />
    </div>
  );
}
