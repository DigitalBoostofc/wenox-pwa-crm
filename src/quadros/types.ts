import type { CSSProperties } from 'react';

/** Modelos do Kanban (réplica do Trello) — coleções quadros/listas/cartoes. */

export interface EtiquetaCartao { nome: string; cor: string }
export interface ItemChecklistCartao { texto: string; feito: boolean }
export interface ChecklistCartao { nome: string; itens: ItemChecklistCartao[] }
export interface AnexoCartao { nome?: string; url?: string; trello_url?: string; mime?: string; bytes?: number; data?: string }

/**
 * Papel funcional da etapa na esteira. Fonte de verdade pro render/status —
 * desacopla a lógica do `texto` (que vira numerado nos ciclos: "Revisão interna 2",
 * "Revisão Layout 3", etc.). Ver docs/esteira-revisao-layout-contract.md.
 */
export type Papel = 'copy' | 'layout' | 'revisao' | 'aprovacao_cliente' | 'agendamento' | 'revisao_layout';

/** Etapa da esteira de produção de um card-post. */
export interface EtapaCard {
  id: string;
  texto: string;
  tipo: 'interna' | 'aprovacao_cliente';
  papel?: Papel;
  responsavel?: string;
  feito: boolean;
  feito_por?: string;
  feito_em?: string;
  veredito?: 'aprovado' | 'reprovado';
  motivo?: string;
}

/**
 * Fallback POSICIONAL da esteira inicial (espelha o backend): índice → papel.
 * Só vale como ÚLTIMO recurso, quando não há `papel` salvo nem casamento por texto.
 */
export const POS_PAPEL: Record<number, Papel> = {
  0: 'copy',
  1: 'layout',
  2: 'revisao',
  3: 'aprovacao_cliente',
  4: 'agendamento',
};

/** Fallback legado: deriva o papel a partir do texto; `undefined` se desconhecido. */
function derivaPapelDoTexto(texto: string): Papel | undefined {
  const t = (texto ?? '').trim();
  if (t.startsWith('Revisão Layout')) return 'revisao_layout';
  if (t === 'Copy') return 'copy';
  if (t === 'Layout') return 'layout';
  if (t.startsWith('Revisão interna')) return 'revisao';
  if (t.startsWith('Aprovação do cliente')) return 'aprovacao_cliente';
  if (t === 'Confirmação de agendamento') return 'agendamento';
  return undefined; // desconhecido — o caller decide (POS_PAPEL[i] ou default 'revisao')
}

/**
 * Papel da etapa: usa `papel`; senão deriva do texto; senão (texto desconhecido e
 * índice `i` fornecido) cai no POSICIONAL `POS_PAPEL[i]`; por fim default 'revisao'.
 * `i` é opcional — sem ele mantém o comportamento legado (default 'revisao').
 */
export function papelDaEtapa(e: Pick<EtapaCard, 'papel' | 'texto'>, i?: number): Papel {
  return e.papel ?? derivaPapelDoTexto(e.texto) ?? (i !== undefined ? POS_PAPEL[i] : undefined) ?? 'revisao';
}

/** Esteira de produção padrão de Social Media (5 etapas). */
export const ESTEIRA_SOCIAL = [
  { texto: 'Copy',                         tipo: 'interna'           as const, papel: 'copy'              as const },
  { texto: 'Layout',                       tipo: 'interna'           as const, papel: 'layout'            as const },
  { texto: 'Revisão interna',              tipo: 'interna'           as const, papel: 'revisao'           as const },
  { texto: 'Aprovação do cliente',         tipo: 'aprovacao_cliente' as const, papel: 'aprovacao_cliente' as const },
  { texto: 'Confirmação de agendamento',   tipo: 'interna'           as const, papel: 'agendamento'       as const },
] as const;

/** Deriva status_post a partir das etapas_card de um card — POR PAPEL. */
export function statusDaEsteira(etapas_card?: EtapaCard[]): 'em_producao' | 'agendar' | 'agendado' | 'em_alteracao' {
  if (!etapas_card?.length) return 'em_producao';
  const idx = etapas_card.findIndex((e) => !e.feito);
  if (idx === -1) return 'agendado';
  const pendente = etapas_card[idx];
  const papel = papelDaEtapa(pendente);
  // Legado pré-cutover: card antigo cuja etapa pendente de revisão/aprovação já está
  // reprovada (estado antigo, antes do backfill injetar a revisao_layout). Sem isto
  // cairia em 'em_producao' (chip cinza errado) — força 'Em alteração' até o backfill.
  if ((papel === 'revisao' || papel === 'aprovacao_cliente') && pendente.veredito === 'reprovado') {
    return 'em_alteracao';
  }
  if (papel === 'revisao_layout') return 'em_alteracao';
  if (papel === 'agendamento') return 'agendar';
  return 'em_producao';
}

/* ── Indexação por-post da esteira (sessão de revisão) ─────────────────────────
 * Espelha o backend byte-a-byte. Usado pela RevisaoPostsPage p/ derivar, POR POST,
 * o índice acionável e o estado do post na sessão (cada post pode ter uma esteira
 * de tamanho diferente por causa dos ciclos "Revisão Layout").
 * Ver docs/esteira-revisao-layout-contract.md §9.
 * ───────────────────────────────────────────────────────────────────────────── */

/** Papéis que são "portões" de decisão na esteira (gates de revisão/aprovação/agendamento). */
export const GATES_PAPEL: readonly Papel[] = ['revisao', 'aprovacao_cliente', 'agendamento'];

/** Etapa mínima p/ indexar/classificar a esteira numa sessão de revisão. */
type EtapaEsteira = Pick<EtapaCard, 'papel' | 'texto' | 'feito' | 'veredito' | 'motivo'>;

/**
 * Índice ACIONÁVEL do post na sessão de papel `papelEtapa`: se a 1ª etapa não-feita
 * é o gate da sessão, é o `idx` a acionar; senão `-1` (não acionável).
 * NUNCA poste `idx === -1` (o backend não é rede de segurança e corromperia a esteira).
 */
export function sessionIndex(ec: EtapaEsteira[], papelEtapa: string): number {
  const i = ec.findIndex((e) => !e.feito);
  if (i === -1) return -1;
  return papelDaEtapa(ec[i], i) === papelEtapa ? i : -1;
}

export type EstadoPost =
  | 'CONCLUIDO'
  | 'PENDENTE'
  | 'ADIANTE'
  | 'REPROVADO'
  | 'RETRABALHO_OUTRO'
  | 'EM_PRODUCAO';

/** Classificação de um post dentro de uma sessão de revisão (papel `papelEtapa`). */
export interface ClassificacaoPost {
  state: EstadoPost;
  /** Para PENDENTE: idx a acionar. Para REPROVADO: idx do gate reprovado. */
  idx?: number;
  motivo?: string;
}

/**
 * Classifica o post na sessão de papel `papelEtapa`. Espelha o backend byte-a-byte.
 * - CONCLUIDO: nenhuma etapa pendente.
 * - PENDENTE: o gate da sessão é a 1ª não-feita (`idx` = onde decidir).
 * - ADIANTE: a 1ª não-feita é um gate de OUTRA sessão.
 * - REPROVADO: 1ª não-feita é `revisao_layout` logo após o gate DESTA sessão reprovado.
 * - RETRABALHO_OUTRO: `revisao_layout` de retrabalho de outra sessão.
 * - EM_PRODUCAO: ainda em etapa não-gate (copy/layout).
 */
export function classify(ec: EtapaEsteira[], papelEtapa: string): ClassificacaoPost {
  const i = ec.findIndex((e) => !e.feito);
  if (i === -1) return { state: 'CONCLUIDO' };
  const p0 = papelDaEtapa(ec[i], i);
  if (GATES_PAPEL.includes(p0)) {
    return p0 === papelEtapa ? { state: 'PENDENTE', idx: i } : { state: 'ADIANTE' };
  }
  if (p0 === 'revisao_layout') {
    const r = ec[i - 1];
    const pr = r ? papelDaEtapa(r, i - 1) : '';
    if (r && pr === papelEtapa && r.veredito === 'reprovado') {
      return { state: 'REPROVADO', idx: i - 1, motivo: r.motivo || '' };
    }
    return { state: 'RETRABALHO_OUTRO' };
  }
  return { state: 'EM_PRODUCAO' };
}

export interface Quadro {
  id: string;
  trello_id?: string;
  cliente?: string;
  nome: string;
  descricao?: string;
  url?: string;
  fundo_img?: string;
  fundo_cor?: string;
  fechado?: boolean;
  ordem?: number;
  created?: string;
  updated?: string;
  expand?: {
    cliente?: { id: string; nome?: string; nome_fantasia?: string; logo?: string; collectionId?: string; collectionName?: string };
  };
}

export interface Lista {
  id: string;
  trello_id?: string;
  quadro: string;
  nome: string;
  ordem?: number;
  fechada?: boolean;
  tipo?: 'mes' | '';
  mes?: number;
  ano?: number;
  tarefa?: string;
  review_token?: string;
}

export interface Cartao {
  id: string;
  trello_id?: string;
  quadro: string;
  lista?: string;
  nome: string;
  descricao?: string;
  ordem?: number;
  prazo?: string;
  concluido?: boolean;
  etiquetas?: EtiquetaCartao[];
  checklists?: ChecklistCartao[];
  anexos?: AnexoCartao[];
  membros?: string[];
  membros_ids?: string[];
  arquivado?: boolean;
  capa?: string;
  uploads?: string[];
  data_post?: string;
  redes?: string[];
  formato?: 'feed' | 'story' | 'reels' | 'carrossel' | '';
  /** Tipos de post (multi). `formato` segue como o "principal" (= formatos[0]) p/ compat backend. */
  formatos?: string[];
  status_post?: 'em_producao' | 'agendar' | 'agendado' | 'postado' | 'em_alteracao' | '';
  agendado_em?: string;
  objetivo?: string;
  tema?: string;
  referencia?: string;
  legenda?: string;
  hashtags?: string;
  briefing?: Record<string, unknown>;
  etapas_card?: EtapaCard[];
  collectionId?: string;
  collectionName?: string;
  created?: string;
  updated?: string;
}

/**
 * true quando o cartão é um POST gerado pela esteira de produção (criado via
 * `gerarPostsMes`): tem `data_post` agendada OU `etapas_card` preenchidas.
 * Cartões adicionados manualmente — mesmo dentro de uma lista de mês — nascem
 * sem nenhum dos dois e devem abrir com o editor de cartão PADRÃO, não a esteira.
 * Cobre o caso de post gerado cuja `data_post` foi removida: continua post pelas
 * `etapas_card`.
 */
export function ehCartaoPost(c: Pick<Cartao, 'data_post' | 'etapas_card'>): boolean {
  return !!c.data_post || (c.etapas_card?.length ?? 0) > 0;
}

export interface ComentarioCartao {
  id: string;
  texto: string;
  autor?: string;
  created?: string;
  expand?: { autor?: { id: string; nome?: string; foto?: string; collectionId?: string; collectionName?: string } };
}

/** Capa do card: campo `capa` explícito, senão a 1ª imagem dos anexos. */
export function capaCartao(c: Pick<Cartao, 'anexos' | 'capa'>): string | null {
  if (c.capa) return c.capa;
  const a = (c.anexos ?? []).find((x) => (x.mime ?? '').startsWith('image') && x.url);
  return a?.url ?? null;
}

/**
 * Reescreve a URL de uma imagem para passar pelo imgproxy (img.wenox.com.br),
 * devolvendo uma versão WebP redimensionada (muito mais leve) para usar em
 * miniaturas/capas. Só processa fontes permitidas no imgproxy
 * (media/api.wenox.com.br); qualquer outra URL é devolvida intacta.
 */
export function thumbUrl(url?: string | null, largura = 600): string {
  if (!url) return url ?? '';
  if (!/^https?:\/\/(media|api)\.wenox\.com\.br\//.test(url)) return url;
  return `https://img.wenox.com.br/insecure/rs:fit:${largura}:0/q:72/plain/${url}@webp`;
}

/** Config de recorrência mensal por quadro (coleção recorrencias_mes). */
export interface RecorrenciaMes {
  id: string;
  quadro: string;
  ativa: boolean;
  padrao_posts?: string;   // 'padrao8' | 'padrao12' | 'personalizado'
  qtd_custom?: number;
  dias_custom?: number[];
  design_id?: string;
  social_id?: string;
  projeto_id?: string;
  ultimo_mes: number;
  ultimo_ano: number;
  created?: string;
  updated?: string;
}

/** Progresso agregado dos checklists do card. */
export function progressoChecklist(c: Pick<Cartao, 'checklists'>): { feitos: number; total: number } {
  let feitos = 0, total = 0;
  for (const ch of c.checklists ?? []) {
    for (const i of ch.itens ?? []) { total++; if (i.feito) feitos++; }
  }
  return { feitos, total };
}

/** Estilo CSS de fundo do tile do quadro (imagem de capa ou gradiente das cores). */
export function fundoStyle(q: Pick<Quadro, 'fundo_img' | 'fundo_cor'>): CSSProperties {
  if (q.fundo_img) {
    return { backgroundImage: `url(${q.fundo_img})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  const cores = (q.fundo_cor ?? '').split(',').map((c) => c.trim()).filter(Boolean);
  if (cores.length >= 2) return { backgroundImage: `linear-gradient(135deg, ${cores[0]}, ${cores[1]})` };
  if (cores.length === 1) return { background: cores[0] };
  return { background: 'hsl(var(--secondary))' };
}

/** Paleta de cores de etiqueta (nomes estilo Trello). */
export const CORES_ETIQUETA = ['green', 'yellow', 'orange', 'red', 'purple', 'blue', 'sky', 'lime', 'pink', 'black'] as const;

/** Paleta de cores de capa (hex, estilo Trello). */
export const CORES_CAPA = ['#4bce97', '#f5cd47', '#fea362', '#f87168', '#9f8fef', '#579dff', '#6cc3e0', '#94c748', '#e774bb', '#8590a2'] as const;

/** true se a capa é uma cor sólida (hex) em vez de imagem. */
export function capaEhCor(capa?: string | null): boolean {
  return !!capa && capa.startsWith('#');
}

/**
 * Para capa de COR sólida: decide se o texto por cima deve ser escuro
 * (cor clara) ou claro (cor escura), pela luminância — igual ao Trello.
 */
export function capaCorClara(capa?: string | null): boolean {
  if (!capa || !capa.startsWith('#')) return false;
  let h = capa.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6;
}

/** Fundo do BOARD (atrás das colunas) — imagem/gradiente escurecido p/ legibilidade. */
export function fundoBoardStyle(q: Pick<Quadro, 'fundo_img' | 'fundo_cor'>): CSSProperties {
  const scrim = 'linear-gradient(rgba(9,9,13,0.86), rgba(9,9,13,0.92))';
  if (q.fundo_img) {
    return { backgroundImage: `${scrim}, url(${q.fundo_img})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  const cores = (q.fundo_cor ?? '').split(',').map((c) => c.trim()).filter(Boolean);
  if (cores.length >= 2) return { backgroundImage: `${scrim}, linear-gradient(135deg, ${cores[0]}, ${cores[1]})` };
  if (cores.length === 1) return { backgroundImage: `${scrim}, linear-gradient(${cores[0]}, ${cores[0]})` };
  return {};
}

/** Trello color name → classes de cor SÓLIDA (etiqueta estilo Trello). */
export function corEtiquetaSolida(cor?: string): string {
  const c = (cor ?? '').toLowerCase();
  if (c.includes('green')) return 'bg-emerald-500 text-white';
  if (c.includes('lime')) return 'bg-lime-400 text-black';
  if (c.includes('yellow')) return 'bg-yellow-400 text-black';
  if (c.includes('orange')) return 'bg-orange-400 text-black';
  if (c.includes('red')) return 'bg-red-500 text-white';
  if (c.includes('purple') || c.includes('violet')) return 'bg-violet-500 text-white';
  if (c.includes('sky')) return 'bg-sky-400 text-black';
  if (c.includes('blue')) return 'bg-blue-500 text-white';
  if (c.includes('pink')) return 'bg-pink-400 text-white';
  if (c.includes('black')) return 'bg-zinc-500 text-white';
  return 'bg-slate-500 text-white';
}

/** Status do prazo do card (cor do badge, estilo Trello). */
export function corPrazoCard(prazo?: string, concluido?: boolean): string {
  if (!prazo) return '';
  if (concluido) return 'bg-emerald-600 text-white';
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const d = new Date(prazo.replace(' ', 'T').slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return 'bg-secondary text-muted-foreground';
  const diff = Math.round((d.getTime() - hoje.getTime()) / 86400000);
  if (diff < 0) return 'bg-red-600 text-white';        // vencido
  if (diff <= 2) return 'bg-yellow-500 text-black';    // hoje/em breve
  return 'bg-secondary text-muted-foreground';
}

/** Status possíveis de um card-post (lista-mês), em ordem de fluxo. */
export const STATUS_POST = [
  { id: 'em_producao', label: 'Em produção' },
  { id: 'agendar',     label: 'Agendar' },
  { id: 'agendado',    label: 'Agendado' },
  { id: 'postado',     label: 'Postado' },
  { id: 'em_alteracao', label: 'Em alteração' },
] as const;

/** Cor sólida do chip de status do post (estilo corEtiquetaSolida). */
export function corStatusPost(status?: string): string {
  switch (status) {
    case 'em_producao':  return 'bg-slate-500 text-white';
    case 'agendar':      return 'bg-amber-500 text-black';
    case 'agendado':     return 'bg-emerald-500 text-white';
    case 'postado':      return 'bg-emerald-700 text-white';
    case 'em_alteracao': return 'bg-red-500 text-white';
    default:             return 'bg-secondary text-muted-foreground';
  }
}

/** Formatos de post disponíveis. */
export const FORMATOS_POST = ['feed', 'story', 'reels', 'carrossel'] as const;

/** Template pré-preenchido das Orientações para o design (campo da etapa Copy). */
export const ORIENTACOES_DESIGN_TEMPLATE = '**HEADLINE=**\n\n**SUB=**\n\n**APOIO=**\n\n**CTA=**';

/** Rótulos legíveis para cada formato de post. */
export const TIPO_POST_LABEL: Record<string, string> = {
  feed: 'Feed único',
  carrossel: 'Carrossel',
  story: 'Stories',
  reels: 'Reels',
};

/** Objetivos de post disponíveis. */
export const OBJETIVO_POST = [
  { id: 'reconhecimento',     label: 'Reconhecimento' },
  { id: 'engajamento',        label: 'Engajamento' },
  { id: 'educar',             label: 'Educar/Valor' },
  { id: 'venda',              label: 'Venda' },
  { id: 'prova_social',       label: 'Prova social' },
  { id: 'data_comemorativa',  label: 'Data comemorativa' },
] as const;

/** Redes sociais suportadas. */
export const REDES_POST = [
  'instagram', 'facebook', 'tiktok', 'linkedin',
  'youtube', 'twitter', 'pinterest', 'google',
] as const;

/** true quando o card está em 'agendar' com data_post a ≤24h de distância
 *  (inclui passado — post vencido sem agendar). Wall-clock, ignora Z. */
export function alertaAgendar(c: Pick<Cartao, 'status_post' | 'data_post'>): boolean {
  if (c.status_post !== 'agendar' || !c.data_post) return false;
  const limpo = c.data_post.replace('T', ' ').replace('Z', '').trim();
  const [dataPart, horaPart] = limpo.split(/\s+/);
  const partes = (dataPart ?? '').split('-').map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return false;
  const [ano, mes, dia] = partes;
  let h = 0, mi = 0;
  if (horaPart) { const hp = horaPart.split(':').map(Number); h = hp[0] ?? 0; mi = hp[1] ?? 0; }
  const dataPost = new Date(ano, mes - 1, dia, h, mi, 0);
  return dataPost.getTime() - Date.now() <= 24 * 60 * 60 * 1000;
}

/** Trello color name → classes Tailwind (pill translúcida — usada onde cabe). */
export function corEtiquetaClass(cor?: string): string {
  const c = (cor ?? '').toLowerCase();
  if (c.includes('green') || c.includes('lime')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  if (c.includes('yellow')) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  if (c.includes('orange')) return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
  if (c.includes('red')) return 'bg-red-500/20 text-red-300 border-red-500/40';
  if (c.includes('purple') || c.includes('violet')) return 'bg-violet-500/20 text-violet-300 border-violet-500/40';
  if (c.includes('blue') || c.includes('sky')) return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  if (c.includes('pink')) return 'bg-pink-500/20 text-pink-300 border-pink-500/40';
  if (c.includes('black')) return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40';
  return 'bg-secondary text-muted-foreground border-border';
}
