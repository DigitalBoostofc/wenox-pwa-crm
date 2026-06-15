import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/useAuth';
import { pb } from '@/lib/pocketbase';
import type { Lista, Cartao } from './types';
import { capaCartao, capaEhCor } from './types';
import { getListaPorToken, listCartoes, decidirRevisaoCard, getQuadro } from './quadrosService';
import { getCliente, logoUrl } from '@/clientes/clientesService';
import type { Cliente } from '@/clientes/types';

const IDX_REVISAO_INTERNA = 2;
const IDX_APROVACAO_CLIENTE = 3;

function PostVisual({ card, cliente }: { card: Cartao; cliente: Cliente | null }) {
  const [slide, setSlide] = useState(0);

  useEffect(() => setSlide(0), [card.id]);

  const capaUrl = capaCartao(card);
  const capaIsImg = capaUrl && !capaEhCor(capaUrl);
  const anexoImgs = (card.anexos ?? [])
    .filter((a) => (a.mime ?? '').startsWith('image') && a.url)
    .map((a) => a.url!);
  const artes = Array.from(new Set([...(capaIsImg ? [capaUrl] : []), ...anexoImgs]));
  const arteAtual = artes[slide] ?? null;

  const avatar = cliente ? logoUrl(cliente, '100x100') : '';
  const handle = cliente ? (cliente.nome_fantasia || cliente.nome || 'perfil') : 'perfil';
  const atHandle = handle.startsWith('@') ? handle : `@${handle}`;

  const legenda = card.legenda ?? '';
  const hashtags = card.hashtags ?? '';
  const legendaCompleta = (legenda + (hashtags ? '\n\n' + hashtags : '')).trim();

  const formato = card.formato || 'feed';
  const isVertical = formato === 'story' || formato === 'reels';
  const isCarrossel = formato === 'carrossel';

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-card">
      {/* Header IG */}
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
        <div className="size-9 overflow-hidden rounded-full border border-border bg-secondary shrink-0">
          {avatar
            ? <img src={avatar} alt={handle} className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm font-bold">{handle[0]?.toUpperCase() ?? '?'}</div>
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate">{atHandle}</p>
          {card.data_post && (
            <p className="text-[11px] text-muted-foreground">
              {new Date(card.data_post.replace(' ', 'T')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
          {formato}
        </span>
      </div>

      {/* Arte */}
      <div
        className="relative w-full bg-secondary"
        style={{ aspectRatio: isVertical ? '9/16' : '4/5', maxHeight: '55vh' }}
      >
        {arteAtual
          ? <img src={arteAtual} alt="arte" className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">sem arte</div>
        }

        {isCarrossel && artes.length > 1 && (
          <>
            {slide > 0 && (
              <button
                onClick={() => setSlide((s) => s - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 grid size-8 place-items-center rounded-full bg-black/50 text-white"
              >
                <ChevronLeft className="size-4" />
              </button>
            )}
            {slide < artes.length - 1 && (
              <button
                onClick={() => setSlide((s) => s + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 grid size-8 place-items-center rounded-full bg-black/50 text-white"
              >
                <ChevronRight className="size-4" />
              </button>
            )}
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
              {artes.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  className={cn('size-1.5 rounded-full transition-colors', i === slide ? 'bg-sky-400' : 'bg-white/50')}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Legenda */}
      {legendaCompleta && (
        <div className="px-3 pb-3 pt-2">
          <p className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-4">
            <span className="font-semibold">{atHandle} </span>
            {legendaCompleta}
          </p>
        </div>
      )}

      {/* Nome do post */}
      <div className="border-t border-border/50 px-3 pb-3 pt-2">
        <p className="text-xs font-medium text-muted-foreground">{card.nome}</p>
      </div>
    </div>
  );
}

function VerediBadge({ veredito, motivo }: { veredito: 'aprovado' | 'reprovado'; motivo?: string }) {
  if (veredito === 'aprovado') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-400">
        <span className="text-lg">✓</span>
        <span className="font-semibold">Aprovado</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400">
      <div className="flex items-center gap-2">
        <span className="text-lg">✗</span>
        <span className="font-semibold">Reprovado — voltou pro design</span>
      </div>
      {motivo && <p className="text-xs text-red-300/80 pl-7">{motivo}</p>}
    </div>
  );
}

export function RevisaoPostsPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const uid = (pb.authStore.record as { id?: string } | null)?.id ?? user?.id ?? '';

  const [lista, setLista] = useState<Lista | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [cards, setCards] = useState<Cartao[]>([]);
  const [idxEtapa, setIdxEtapa] = useState(IDX_REVISAO_INTERNA);
  const [posicao, setPosicao] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [reprovando, setReprovando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setErro(null);

    getListaPorToken(token)
      .then(async (l) => {
        setLista(l);
        const [q, todosCards] = await Promise.all([
          getQuadro(l.quadro),
          listCartoes(l.quadro),
        ]);
        const cardsDaLista = todosCards.filter(
          (c) => c.lista === l.id && (c.etapas_card?.length ?? 0) > 0,
        );
        setCards(cardsDaLista);

        // determina etapa de revisão: idx2 se algum card ainda não tem idx2 feito, senão idx3
        const algumIdx2Pendente = cardsDaLista.some((c) => !c.etapas_card?.[IDX_REVISAO_INTERNA]?.feito);
        setIdxEtapa(algumIdx2Pendente ? IDX_REVISAO_INTERNA : IDX_APROVACAO_CLIENTE);

        if (q.expand?.cliente?.id) {
          getCliente(q.expand.cliente.id).then(setCliente).catch(() => setCliente(null));
        } else if (q.cliente) {
          getCliente(q.cliente).then(setCliente).catch(() => setCliente(null));
        }
      })
      .catch(() => setErro('Link de revisão inválido ou expirado.'))
      .finally(() => setLoading(false));
  }, [token]);

  // recalcula etapa quando cards mudam
  useEffect(() => {
    if (!cards.length) return;
    const algumIdx2Pendente = cards.some((c) => !c.etapas_card?.[IDX_REVISAO_INTERNA]?.feito);
    setIdxEtapa(algumIdx2Pendente ? IDX_REVISAO_INTERNA : IDX_APROVACAO_CLIENTE);
  }, [cards]);

  const cardAtual = cards[posicao] ?? null;
  const etapaCardAtual = cardAtual?.etapas_card?.[idxEtapa];
  const jaDecidido = !!etapaCardAtual?.veredito;
  const decididos = cards.filter((c) => !!c.etapas_card?.[idxEtapa]?.veredito).length;
  const total = cards.length;
  const todosDecididos = total > 0 && decididos === total;
  const aprovados = cards.filter((c) => c.etapas_card?.[idxEtapa]?.veredito === 'aprovado').length;
  const reprovados = decididos - aprovados;

  const nomeEtapa = idxEtapa === IDX_REVISAO_INTERNA ? 'Revisão interna' : 'Aprovação do cliente';

  async function aprovar() {
    if (!cardAtual || salvando) return;
    setSalvando(true);
    try {
      const updated = await decidirRevisaoCard(cardAtual, idxEtapa, uid, 'aprovado');
      setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (posicao < cards.length - 1) setPosicao((p) => p + 1);
    } catch { /* */ }
    setSalvando(false);
  }

  async function reprovar() {
    if (!cardAtual || salvando || !motivo.trim()) return;
    setSalvando(true);
    try {
      const updated = await decidirRevisaoCard(cardAtual, idxEtapa, uid, 'reprovado', motivo.trim());
      setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setReprovando(false);
      setMotivo('');
      if (posicao < cards.length - 1) setPosicao((p) => p + 1);
    } catch { /* */ }
    setSalvando(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando revisão…</p>
      </div>
    );
  }

  if (erro || !lista || !cards.length) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-base font-semibold">{erro ?? 'Nenhum post encontrado para revisão.'}</p>
        <p className="text-sm text-muted-foreground">Verifique o link ou entre em contato com a agência.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 sticky top-0 z-10">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{lista.nome}</p>
        <h1 className="text-base font-semibold leading-tight">{nomeEtapa}</h1>

        {/* Barra de progresso */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 overflow-hidden rounded-full bg-secondary h-1.5">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: total > 0 ? `${(decididos / total) * 100}%` : '0%' }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
            {decididos}/{total} decididos
          </span>
        </div>
      </div>

      {todosDecididos ? (
        /* Estado final */
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          {reprovados === 0 ? (
            <>
              <span className="text-5xl">🎉</span>
              <h2 className="text-xl font-bold">Tudo aprovado!</h2>
              <p className="text-sm text-muted-foreground">Todos os {total} posts foram aprovados. A etapa foi concluída automaticamente.</p>
            </>
          ) : (
            <>
              <span className="text-4xl">↩</span>
              <h2 className="text-xl font-bold">{reprovados} {reprovados === 1 ? 'post voltou' : 'posts voltaram'} pro design</h2>
              <p className="text-sm text-muted-foreground">
                {aprovados > 0 && `${aprovados} ${aprovados === 1 ? 'aprovado' : 'aprovados'}, `}
                {reprovados} {reprovados === 1 ? 'reprovado' : 'reprovados'}.
                O design irá receber as alterações solicitadas.
              </p>
            </>
          )}

          {/* Resumo dos cards */}
          <div className="mt-4 w-full max-w-sm space-y-2">
            {cards.map((c, i) => {
              const v = c.etapas_card?.[idxEtapa]?.veredito;
              const m = c.etapas_card?.[idxEtapa]?.motivo;
              return (
                <button
                  key={c.id}
                  onClick={() => { setPosicao(i); }}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm hover:bg-secondary/40 transition-colors"
                >
                  <span className={cn(
                    'mt-0.5 shrink-0 text-base',
                    v === 'aprovado' ? 'text-emerald-500' : 'text-red-400',
                  )}>
                    {v === 'aprovado' ? '✓' : '✗'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.nome}</p>
                    {v === 'reprovado' && m && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          {/* Stepper de navegação */}
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-2">
            <button
              onClick={() => { setPosicao((p) => Math.max(0, p - 1)); setReprovando(false); setMotivo(''); }}
              disabled={posicao === 0}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground disabled:opacity-30 hover:bg-secondary/60 transition-colors"
            >
              <ChevronLeft className="size-4" /> Anterior
            </button>
            <span className="text-sm font-medium tabular-nums text-muted-foreground">
              Post {posicao + 1} de {total}
            </span>
            <button
              onClick={() => { setPosicao((p) => Math.min(total - 1, p + 1)); setReprovando(false); setMotivo(''); }}
              disabled={posicao === total - 1}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground disabled:opacity-30 hover:bg-secondary/60 transition-colors"
            >
              Próximo <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Conteúdo do post */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 max-w-lg mx-auto w-full">
            {cardAtual && (
              <>
                <PostVisual card={cardAtual} cliente={cliente} />

                {/* Veredito atual (se já decidido) */}
                {jaDecidido && etapaCardAtual && (
                  <VerediBadge
                    veredito={etapaCardAtual.veredito!}
                    motivo={etapaCardAtual.motivo}
                  />
                )}

                {/* Ações */}
                {reprovando ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium">O que alterar? <span className="text-destructive">*</span></label>
                      <textarea
                        autoFocus
                        rows={3}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Descreva o que precisa ser alterado…"
                        className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        className="flex-1 h-12 text-base font-semibold rounded-xl"
                        disabled={!motivo.trim() || salvando}
                        onClick={reprovar}
                      >
                        ✗ Confirmar reprovação
                      </Button>
                      <Button
                        variant="outline"
                        className="h-12 rounded-xl px-4"
                        onClick={() => { setReprovando(false); setMotivo(''); }}
                        disabled={salvando}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 h-14 text-base font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                      disabled={salvando}
                      onClick={aprovar}
                    >
                      ✓ Aprovado
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 h-14 text-base font-bold rounded-xl border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500"
                      disabled={salvando}
                      onClick={() => setReprovando(true)}
                    >
                      ✗ Reprovar
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Miniaturas de navegação rápida */}
          <div className="border-t border-border bg-card px-3 py-2 overflow-x-auto">
            <div className="flex gap-1.5 min-w-max">
              {cards.map((c, i) => {
                const v = c.etapas_card?.[idxEtapa]?.veredito;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setPosicao(i); setReprovando(false); setMotivo(''); }}
                    className={cn(
                      'relative size-10 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                      i === posicao ? 'border-primary scale-110' : 'border-border opacity-60 hover:opacity-100',
                    )}
                    title={c.nome}
                  >
                    {capaCartao(c) && !capaEhCor(capaCartao(c))
                      ? <img src={capaCartao(c)!} alt="" className="h-full w-full object-cover" />
                      : <div className="flex h-full w-full items-center justify-center bg-secondary text-[9px] font-bold text-muted-foreground">{i + 1}</div>
                    }
                    {v && (
                      <div className={cn(
                        'absolute bottom-0 right-0 grid size-4 place-items-center rounded-tl-md text-[9px] font-bold text-white',
                        v === 'aprovado' ? 'bg-emerald-500' : 'bg-red-500',
                      )}>
                        {v === 'aprovado' ? '✓' : '✗'}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
