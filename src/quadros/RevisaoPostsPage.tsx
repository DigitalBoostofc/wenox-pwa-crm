import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { pb } from '@/lib/pocketbase';
import { useAuth } from '@/auth/useAuth';
import { papelDaEtapa, sessionIndex, classify, POS_PAPEL, type Papel } from './types';

const REVIEW_BASE = 'https://media.wenox.com.br/_up/review';

interface ApiCliente {
  id: string;
  handle: string;
  logo: string;
}

interface ApiEtapa {
  texto: string;
  tipo: string;
  papel?: Papel;
  feito: boolean;
  veredito?: 'aprovado' | 'reprovado';
  motivo?: string;
}

interface ApiPost {
  id: string;
  nome: string;
  formato: string;
  data_post: string;
  legenda: string;
  hashtags: string;
  artes: string[];
  etapas_card: ApiEtapa[];
}

interface ApiReviewData {
  lista: { nome: string };
  idxEtapa: number;
  /** Papel da etapa em revisão (loop dinâmico). Ausente em respostas antigas. */
  papelEtapa?: string;
  /** Texto da etapa em revisão (já numerado nos ciclos). Ausente em respostas antigas. */
  textoEtapa?: string;
  cliente: ApiCliente | null;
  posts: ApiPost[];
}

function PostVisual({ post, cliente }: { post: ApiPost; cliente: ApiCliente | null }) {
  const [slide, setSlide] = useState(0);

  useEffect(() => setSlide(0), [post.id]);

  const artes = post.artes ?? [];
  const arteAtual = artes[slide] ?? null;

  const handle = cliente?.handle || 'perfil';
  const atHandle = handle.startsWith('@') ? handle : `@${handle}`;
  const logo = cliente?.logo || '';

  const legenda = post.legenda ?? '';
  const hashtags = post.hashtags ?? '';
  const legendaCompleta = (legenda + (hashtags ? '\n\n' + hashtags : '')).trim();

  const formato = post.formato || 'feed';
  const isVertical = formato === 'story' || formato === 'reels';
  const isCarrossel = formato === 'carrossel';

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-card">
      {/* Header IG */}
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
        <div className="size-9 overflow-hidden rounded-full border border-border bg-secondary shrink-0">
          {logo
            ? <img src={logo} alt={handle} className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 text-white text-sm font-bold">{handle[0]?.toUpperCase() ?? '?'}</div>
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate">{atHandle}</p>
          {post.data_post && (
            <p className="text-[11px] text-muted-foreground">
              {new Date(post.data_post.replace(' ', 'T')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
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
        <p className="text-xs font-medium text-muted-foreground">{post.nome}</p>
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

function AgendadoBadge({ dataPost }: { dataPost?: string }) {
  const dataFormatada = dataPost
    ? new Date(dataPost.replace(' ', 'T')).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';
  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-400">
      <span className="text-lg">✓</span>
      <div>
        <p className="font-semibold">Agendado</p>
        {dataFormatada && <p className="text-xs text-emerald-300/80">{dataFormatada}</p>}
      </div>
    </div>
  );
}

function parseDateParts(dataPost: string): { data: string; hora: string } {
  const [d = '', t = ''] = dataPost.split(' ');
  return { data: d, hora: t.substring(0, 5) || '12:00' };
}

/**
 * Índice do gate desta sessão p/ EXIBIÇÃO (inclui o já-decidido nesta sessão).
 * - PENDENTE → o próprio gate acionável (sessionIndex).
 * - decidido nesta sessão (aprovado/reprovado otimista, ou reprovado estrutural com
 *   `revisao_layout` à frente) → a etapa do papel da sessão imediatamente antes da
 *   1ª não-feita (ou a última, se tudo concluído).
 * Senão -1 (post não tem gate desta sessão: em produção / retrabalho de outra sessão).
 */
function gateSessaoIdx(ec: ApiEtapa[], papelSessao: string): number {
  const pend = sessionIndex(ec, papelSessao);
  if (pend !== -1) return pend;
  const fni = ec.findIndex((e) => !e.feito);
  const cand = fni === -1 ? ec.length - 1 : fni - 1;
  if (cand >= 0 && papelDaEtapa(ec[cand], cand) === papelSessao) return cand;
  return -1;
}

type IconePost = 'pendente' | 'reprovado' | 'ok';

/** Ícone do post na sessão (miniaturas + lista-resumo), derivado por `classify`. */
function iconePost(p: ApiPost, papelSessao: string): IconePost {
  const ec = p.etapas_card ?? [];
  const c = classify(ec, papelSessao);
  if (c.state === 'PENDENTE') return 'pendente';
  if (c.state === 'REPROVADO') return 'reprovado';
  // Reprovado otimista: gate desta sessão já decidido reprovado, antes do refetch
  // que insere a `revisao_layout` (quando classify passaria a devolver REPROVADO).
  const ig = gateSessaoIdx(ec, papelSessao);
  if (ig >= 0 && ec[ig].veredito === 'reprovado') return 'reprovado';
  return 'ok';
}

export function RevisaoPostsPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();

  const [listaNome, setListaNome] = useState('');
  const [idxEtapa, setIdxEtapa] = useState(2);
  const [papelEtapa, setPapelEtapa] = useState('');
  const [textoEtapa, setTextoEtapa] = useState('');
  const [cliente, setCliente] = useState<ApiCliente | null>(null);
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [posicao, setPosicao] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [reprovando, setReprovando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Estado para etapa de agendamento (idx 4)
  const [agendData, setAgendData] = useState('');
  const [agendHora, setAgendHora] = useState('12:00');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setErro(null);

    fetch(`${REVIEW_BASE}?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('not_found');
        return res.json() as Promise<ApiReviewData>;
      })
      .then((data) => {
        setListaNome(data.lista.nome);
        setIdxEtapa(data.idxEtapa);
        setPapelEtapa(data.papelEtapa ?? '');
        setTextoEtapa(data.textoEtapa ?? '');
        setCliente(data.cliente);
        setPosts(data.posts);
        // Sessão = papel do GET; fallback p/ o POSICIONAL do idxEtapa em respostas antigas
        // (idx 2/3/4 → revisao/aprovacao_cliente/agendamento), preservando o legado.
        const papelSessaoLocal = (data.papelEtapa ?? '') || POS_PAPEL[data.idxEtapa] || '';
        const isAgend = papelSessaoLocal === 'agendamento';
        // Posição inicial: 1º post PENDENTE nesta sessão (fallback 0).
        const pend = data.posts.findIndex(
          (p) => classify(p.etapas_card ?? [], papelSessaoLocal).state === 'PENDENTE',
        );
        const pos = pend >= 0 ? pend : 0;
        setPosicao(pos);
        if (isAgend && data.posts[pos]) {
          const parts = parseDateParts(data.posts[pos].data_post ?? '');
          setAgendData(parts.data);
          setAgendHora(parts.hora);
        }
      })
      .catch(() => setErro('Link de revisão inválido ou expirado.'))
      .finally(() => setLoading(false));
  }, [token]);

  // Sincroniza campos de agendamento ao navegar entre posts
  const postAtual = posts[posicao] ?? null;
  // Sessão = papel do GET; fallback p/ o POSICIONAL do idxEtapa (compat respostas antigas).
  // `idxEtapa` global é só representativo (título/exibição) — NÃO indexa outros posts.
  const papelSessao = papelEtapa || POS_PAPEL[idxEtapa] || '';
  const isAgendamento = papelSessao === 'agendamento';
  useEffect(() => {
    if (isAgendamento && postAtual) {
      const parts = parseDateParts(postAtual.data_post ?? '');
      setAgendData(parts.data);
      setAgendHora(parts.hora);
    }
  }, [posicao, isAgendamento, postAtual?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derivação POR POST (esteiras divergem de tamanho por causa dos ciclos).
  const ecAtual = postAtual?.etapas_card ?? [];
  const idxSessaoAtual = sessionIndex(ecAtual, papelSessao);   // idx acionável (-1 = não postar)
  const acionavel = idxSessaoAtual !== -1;                      // === classify().state === 'PENDENTE'
  const idxGateAtual = gateSessaoIdx(ecAtual, papelSessao);     // gate p/ exibição (inclui já-decidido)
  const etapaGate = idxGateAtual >= 0 ? ecAtual[idxGateAtual] : undefined;
  const vereditoGate = etapaGate?.veredito;
  // Tem badge a mostrar (já decidido nesta sessão): agendamento→feito; revisão→veredito.
  const decididoComBadge = !!etapaGate && (isAgendamento ? !!etapaGate.feito : !!vereditoGate);
  // Não acionável e sem decisão visível → post em retrabalho / aguardando design.
  const emRetrabalho = !acionavel && !decididoComBadge;

  const total = posts.length;
  const decididos = posts.filter(
    (p) => classify(p.etapas_card ?? [], papelSessao).state !== 'PENDENTE',
  ).length;
  const todosDecididos =
    total > 0 && !posts.some((p) => classify(p.etapas_card ?? [], papelSessao).state === 'PENDENTE');
  const reprovados = posts.filter((p) => iconePost(p, papelSessao) === 'reprovado').length;
  const aprovados = decididos - reprovados;

  // Nome vem do backend (textoEtapa, já numerado nos ciclos); fallback p/ idx legado.
  const nomeEtapa =
    textoEtapa
    || (idxEtapa === 2 ? 'Revisão interna'
      : idxEtapa === 3 ? 'Aprovação do cliente'
      : 'Confirmação de agendamento');

  function atualizarPostLocal(postId: string, veredito: 'aprovado' | 'reprovado', motivoTexto?: string) {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const idx = sessionIndex(p.etapas_card ?? [], papelSessao);
        if (idx === -1) return p; // defensivo: não acionável
        return {
          ...p,
          // Aprovado e reprovado marcam feito=true (sai de PENDENTE). As novas etapas
          // do ciclo de reprovação são inseridas pelo backend; só refletem no refetch.
          etapas_card: p.etapas_card.map((e, i) =>
            i === idx ? { ...e, feito: true, veredito, motivo: motivoTexto } : e,
          ),
        };
      }),
    );
  }

  function atualizarPostAgendado(postId: string, dataPostAgendada: string) {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const idx = sessionIndex(p.etapas_card ?? [], papelSessao);
        if (idx === -1) return p;
        return {
          ...p,
          data_post: dataPostAgendada,
          etapas_card: p.etapas_card.map((e, i) => (i === idx ? { ...e, feito: true } : e)),
        };
      }),
    );
  }

  const ator = pb.authStore.record?.id ?? '';

  async function enviarDecisao(
    post: ApiPost,
    veredito: 'aprovado' | 'reprovado',
    motivoTexto?: string,
  ) {
    // idx POR POST (sessão), nunca o idxEtapa global. -1 nunca é postado.
    const idx = sessionIndex(post.etapas_card ?? [], papelSessao);
    if (idx === -1) throw new Error('nao_acionavel');
    const res = await fetch(`${REVIEW_BASE}/decisao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, cardId: post.id, idx, veredito, motivo: motivoTexto, ator }),
    });
    if (!res.ok) throw new Error('decisao_falhou');
  }

  async function enviarAgendamento(post: ApiPost, dataPostStr: string) {
    const idx = sessionIndex(post.etapas_card ?? [], papelSessao);
    if (idx === -1) throw new Error('nao_acionavel');
    const res = await fetch(`${REVIEW_BASE}/decisao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, cardId: post.id, idx, veredito: 'agendar', ator, data_post: dataPostStr }),
    });
    if (!res.ok) throw new Error('decisao_falhou');
  }

  async function aprovar() {
    if (!postAtual || salvando || !acionavel) return;
    setSalvando(true);
    try {
      await enviarDecisao(postAtual, 'aprovado');
      atualizarPostLocal(postAtual.id, 'aprovado');
      if (posicao < posts.length - 1) setPosicao((p) => p + 1);
    } catch { /* */ }
    setSalvando(false);
  }

  async function reprovar() {
    if (!postAtual || salvando || !motivo.trim() || !acionavel) return;
    setSalvando(true);
    try {
      await enviarDecisao(postAtual, 'reprovado', motivo.trim());
      atualizarPostLocal(postAtual.id, 'reprovado', motivo.trim());
      setReprovando(false);
      setMotivo('');
      if (posicao < posts.length - 1) setPosicao((p) => p + 1);
    } catch { /* */ }
    setSalvando(false);
  }

  async function agendar() {
    if (!postAtual || salvando || !agendData || !acionavel) return;
    const dataPostStr = `${agendData} ${agendHora}:00`;
    setSalvando(true);
    try {
      await enviarAgendamento(postAtual, dataPostStr);
      atualizarPostAgendado(postAtual.id, dataPostStr);
      if (posicao < posts.length - 1) setPosicao((p) => p + 1);
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

  if (erro) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-base font-semibold">Link inválido</p>
        <p className="text-sm text-muted-foreground">Verifique o link ou entre em contato com a agência.</p>
      </div>
    );
  }

  // Acesso restrito: usuário Cliente só vê revisão do seu cliente
  if (user?.role === 'Cliente' && cliente?.id && user.cliente !== cliente.id) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-base font-semibold">Sem acesso a esta revisão.</p>
        <p className="text-sm text-muted-foreground">Este link pertence a outro cliente.</p>
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-base font-semibold">Nenhum post encontrado para revisão.</p>
        <p className="text-sm text-muted-foreground">Verifique o link ou entre em contato com a agência.</p>
      </div>
    );
  }

  const labelDecididos = isAgendamento ? 'agendados' : 'decididos';

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 sticky top-0 z-10">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{listaNome}</p>
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
            {decididos}/{total} {labelDecididos}
          </span>
        </div>
      </div>

      {todosDecididos ? (
        /* Estado final */
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
          {isAgendamento ? (
            <>
              <span className="text-5xl">📅</span>
              <h2 className="text-xl font-bold">Tudo agendado!</h2>
              <p className="text-sm text-muted-foreground">Todos os {total} posts foram confirmados para agendamento.</p>
            </>
          ) : reprovados === 0 ? (
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

          {/* Resumo dos posts */}
          <div className="mt-4 w-full max-w-sm space-y-2">
            {posts.map((p, i) => {
              const ic = iconePost(p, papelSessao);
              const ig = gateSessaoIdx(p.etapas_card ?? [], papelSessao);
              const gate = ig >= 0 ? (p.etapas_card ?? [])[ig] : undefined;
              return (
                <button
                  key={p.id}
                  onClick={() => { setPosicao(i); }}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm hover:bg-secondary/40 transition-colors"
                >
                  <span className={cn(
                    'mt-0.5 shrink-0 text-base',
                    ic === 'pendente' ? 'text-muted-foreground'
                      : ic === 'reprovado' ? 'text-red-400'
                      : 'text-emerald-500',
                  )}>
                    {ic === 'pendente' ? '○' : ic === 'reprovado' ? '✗' : '✓'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.nome}</p>
                    {!isAgendamento && ic === 'reprovado' && gate?.motivo && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{gate.motivo}</p>
                    )}
                    {isAgendamento && ic === 'ok' && p.data_post && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(p.data_post.replace(' ', 'T')).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
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
            {postAtual && (
              <>
                <PostVisual post={postAtual} cliente={cliente} />

                {/* Veredito atual (revisão/aprovação) — por gate da sessão deste post */}
                {!isAgendamento && decididoComBadge && vereditoGate && (
                  <VerediBadge
                    veredito={vereditoGate}
                    motivo={etapaGate?.motivo}
                  />
                )}

                {/* Agendado */}
                {isAgendamento && decididoComBadge && (
                  <AgendadoBadge dataPost={postAtual.data_post} />
                )}

                {/* Não acionável e sem decisão: post em retrabalho / aguardando design */}
                {emRetrabalho && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-400">
                    <span className="text-lg">↩</span>
                    <span className="text-sm font-medium">
                      {isAgendamento
                        ? 'Aguardando as etapas anteriores deste post.'
                        : 'Em retrabalho — aguardando o design. Nada a decidir nesta etapa.'}
                    </span>
                  </div>
                )}

                {/* Ações — revisão/aprovação (só quando acionável nesta sessão) */}
                {!isAgendamento && acionavel && (
                  reprovando ? (
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
                  )
                )}

                {/* Ações — agendamento (só quando acionável nesta sessão) */}
                {isAgendamento && acionavel && (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <div className="flex flex-col gap-1.5 flex-1">
                        <label className="text-sm font-medium">Data</label>
                        <input
                          type="date"
                          value={agendData}
                          onChange={(e) => setAgendData(e.target.value)}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 w-28">
                        <label className="text-sm font-medium">Hora</label>
                        <input
                          type="time"
                          value={agendHora}
                          onChange={(e) => setAgendHora(e.target.value)}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        />
                      </div>
                    </div>
                    <Button
                      className="h-14 text-base font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                      disabled={salvando || !agendData}
                      onClick={agendar}
                    >
                      ✓ Agendar
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Miniaturas de navegação rápida */}
          <div className="border-t border-border bg-card px-3 py-2 overflow-x-auto">
            <div className="flex gap-1.5 min-w-max">
              {posts.map((p, i) => {
                const ic = iconePost(p, papelSessao);
                const thumb = p.artes?.[0] ?? null;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setPosicao(i); setReprovando(false); setMotivo(''); }}
                    className={cn(
                      'relative size-10 shrink-0 overflow-hidden rounded-lg border-2 transition-all',
                      i === posicao ? 'border-primary scale-110' : 'border-border opacity-60 hover:opacity-100',
                    )}
                    title={p.nome}
                  >
                    {thumb
                      ? <img src={thumb} alt="" className="h-full w-full object-cover" />
                      : <div className="flex h-full w-full items-center justify-center bg-secondary text-[9px] font-bold text-muted-foreground">{i + 1}</div>
                    }
                    {ic !== 'pendente' && (
                      <div className={cn(
                        'absolute bottom-0 right-0 grid size-4 place-items-center rounded-tl-md text-[9px] font-bold text-white',
                        ic === 'reprovado' ? 'bg-red-500' : 'bg-emerald-500',
                      )}>
                        {ic === 'reprovado' ? '✗' : '✓'}
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
