import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Cartao } from './types';
import { capaCartao, capaEhCor, TIPO_POST_LABEL } from './types';
import { getCliente, logoUrl } from '@/clientes/clientesService';
import type { Cliente } from '@/clientes/types';

interface PreviewPostProps {
  aberto: boolean;
  onClose: () => void;
  cartao: Cartao;
  clienteId?: string;
}

function AvatarCliente({ avatar, handle }: { avatar: string; handle: string }) {
  if (avatar) return <img src={avatar} alt={handle} className="h-full w-full object-cover" />;
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold">
      {handle[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

export function PreviewPost({ aberto, onClose, cartao, clienteId }: PreviewPostProps) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [slide, setSlide] = useState(0);
  const [expandida, setExpandida] = useState(false);

  useEffect(() => {
    setSlide(0);
    setExpandida(false);
    if (!aberto || !clienteId) { setCliente(null); return; }
    getCliente(clienteId).then(setCliente).catch(() => setCliente(null));
  }, [aberto, clienteId]);

  const capaUrl = capaCartao(cartao);
  const capaIsImg = capaUrl && !capaEhCor(capaUrl);
  const anexoImgs = (cartao.anexos ?? [])
    .filter((a) => (a.mime ?? '').startsWith('image') && a.url)
    .map((a) => a.url!);
  const artes = Array.from(new Set([...(capaIsImg ? [capaUrl] : []), ...anexoImgs]));

  const avatar = cliente ? logoUrl(cliente, '100x100') : '';
  const handle = cliente ? (cliente.nome_fantasia || cliente.nome || 'perfil') : 'perfil';
  const atHandle = handle.startsWith('@') ? handle : `@${handle}`;

  const legenda = cartao.legenda ?? '';
  const hashtags = cartao.hashtags ?? '';
  const legendaCompleta = legenda + (hashtags ? '\n\n' + hashtags : '');

  const formato = cartao.formato || 'feed';
  const isVertical = formato === 'story' || formato === 'reels';
  const isCarrossel = formato === 'carrossel';

  const arteAtual = artes[slide] ?? null;

  const LIMITE_CAPTION = 160;
  const precisaTruncar = legendaCompleta.length > LIMITE_CAPTION;
  const legendaExibida = precisaTruncar && !expandida
    ? legendaCompleta.slice(0, LIMITE_CAPTION)
    : legendaCompleta;

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[384px] overflow-y-auto p-0">
        <DialogTitle className="sr-only">
          Pré-visualização — {TIPO_POST_LABEL[formato] ?? formato}
        </DialogTitle>

        {/* IG header: avatar + handle + more */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="size-8 overflow-hidden rounded-full border border-border">
              <AvatarCliente avatar={avatar} handle={handle} />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold">{atHandle}</span>
              {cartao.data_post && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(cartao.data_post.replace(' ', 'T')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
              )}
            </div>
          </div>
          <MoreHorizontal className="size-4 text-muted-foreground" />
        </div>

        {isVertical ? (
          /* Story / Reels — 9:16 */
          <div className="relative bg-black" style={{ aspectRatio: '9/16' }}>
            {arteAtual
              ? <img src={arteAtual} alt="arte" className="h-full w-full object-cover" />
              : (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/40">
                  sem arte
                </div>
              )
            }

            {/* overlay topo: avatar + handle */}
            <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-3 py-3">
              <div className="size-8 overflow-hidden rounded-full border-2 border-white/70">
                <AvatarCliente avatar={avatar} handle={handle} />
              </div>
              <span className="text-xs font-semibold text-white drop-shadow">{atHandle}</span>
              {formato === 'reels' && (
                <button className="ml-auto rounded border border-white/80 px-2 py-0.5 text-[10px] text-white">Seguir</button>
              )}
            </div>

            {/* reels: ícones laterais */}
            {formato === 'reels' && (
              <div className="absolute bottom-20 right-3 flex flex-col items-center gap-5">
                <div className="flex flex-col items-center gap-0.5">
                  <Heart className="size-6 text-white drop-shadow" />
                  <span className="text-[10px] text-white">123</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <MessageCircle className="size-6 text-white drop-shadow" />
                  <span className="text-[10px] text-white">45</span>
                </div>
                <Send className="size-6 text-white drop-shadow" />
                <MoreHorizontal className="size-6 text-white drop-shadow" />
              </div>
            )}

            {/* legenda overlay inferior */}
            {legenda && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-4">
                <p className="line-clamp-3 text-xs text-white">{legenda}</p>
              </div>
            )}
          </div>
        ) : (
          /* Feed / Carrossel — 4:5 */
          <div className="relative bg-secondary" style={{ aspectRatio: '4/5' }}>
            {arteAtual
              ? <img src={arteAtual} alt="arte" className="h-full w-full object-cover" />
              : (
                <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                  sem arte
                </div>
              )
            }

            {isCarrossel && artes.length > 1 && (
              <>
                {slide > 0 && (
                  <button
                    onClick={() => setSlide((s) => s - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 grid size-7 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                )}
                {slide < artes.length - 1 && (
                  <button
                    onClick={() => setSlide((s) => s + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid size-7 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
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
                <div className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
                  {slide + 1}/{artes.length}
                </div>
              </>
            )}
          </div>
        )}

        {/* Barra de ações + caption (feed / carrossel) */}
        {!isVertical && (
          <div className="flex flex-col gap-2 px-3 pb-4 pt-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <Heart className="size-[22px] text-foreground/80" />
                <MessageCircle className="size-[22px] text-foreground/80" />
                <Send className="size-[22px] text-foreground/80" />
              </div>
              <Bookmark className="size-[22px] text-foreground/80" />
            </div>
            <p className="text-xs font-semibold">123 curtidas</p>
            {legendaCompleta.trim() && (
              <p className="text-xs leading-relaxed">
                <span className="font-semibold">{atHandle} </span>
                <span className="whitespace-pre-wrap">{legendaExibida}</span>
                {precisaTruncar && !expandida && (
                  <button
                    onClick={() => setExpandida(true)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    ... mais
                  </button>
                )}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
