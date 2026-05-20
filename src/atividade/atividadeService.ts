import { pb } from '@/lib/pocketbase';

export type Entidade = 'cliente' | 'contato' | 'acesso' | 'documento' | 'projeto';

interface Base {
  id: string;
  entidade: Entidade;
  ref_id: string;
  autor?: string;
  autorNome: string;
  created: string;
  expand?: { autor?: { nome?: string; email?: string } };
}
export interface Comentario extends Base {
  tipo: 'comentario';
  texto: string;
}
export interface Historico extends Base {
  tipo: 'historico';
  acao: string;
}
export type ItemAtividade = Comentario | Historico;

function nomeAutor(rec: { expand?: { autor?: { nome?: string; email?: string } } }) {
  return rec.expand?.autor?.nome ?? rec.expand?.autor?.email ?? 'Sistema';
}

export async function listComentarios(
  entidade: Entidade,
  refId: string,
): Promise<Comentario[]> {
  const res = await pb.collection('comentarios').getFullList({
    filter: `entidade = "${entidade}" && ref_id = "${refId}"`,
    sort: '-created',
    expand: 'autor',
  });
  return res.map((r) => ({
    ...(r as unknown as Comentario),
    tipo: 'comentario',
    autorNome: nomeAutor(r),
  })) as Comentario[];
}

export async function addComentario(
  entidade: Entidade,
  refId: string,
  texto: string,
): Promise<void> {
  const t = texto.trim();
  if (!t) throw new Error('Escreva um comentário');
  await pb.collection('comentarios').create({
    entidade,
    ref_id: refId,
    texto: t,
    autor: pb.authStore?.record?.id,
  });
}

export async function listHistorico(
  entidade: Entidade,
  refId: string,
): Promise<Historico[]> {
  const res = await pb.collection('historico').getFullList({
    filter: `entidade = "${entidade}" && ref_id = "${refId}"`,
    sort: '-created',
    expand: 'autor',
  });
  return res.map((r) => ({
    ...(r as unknown as Historico),
    tipo: 'historico',
    autorNome: nomeAutor(r),
  })) as Historico[];
}

/** Grava uma entrada de histórico. Nunca lança (não pode quebrar o save). */
export async function registrarHistorico(
  entidade: Entidade,
  refId: string,
  acao: string,
): Promise<void> {
  try {
    await pb.collection('historico').create({
      entidade,
      ref_id: refId,
      acao,
      autor: pb.authStore?.record?.id,
    });
  } catch {
    /* histórico é best-effort; falha aqui não impede a operação principal */
  }
}

/** Lista unificada (comentários + histórico) ordenada por data desc. */
export async function listAtividade(
  entidade: Entidade,
  refId: string,
): Promise<ItemAtividade[]> {
  const [coments, hist] = await Promise.all([
    listComentarios(entidade, refId),
    listHistorico(entidade, refId),
  ]);
  return [...coments, ...hist].sort(
    (a, b) => +new Date(b.created) - +new Date(a.created),
  );
}

const ROTULOS: Record<string, string> = {
  nome_fantasia: 'nome fantasia',
  razao_social: 'razão social',
  cnpj: 'CPF/CNPJ',
  categoria: 'categoria',
  origem: 'origem',
  servicos: 'serviços',
  telefone: 'telefone',
  telefones: 'telefones',
  email: 'e-mail',
  emails: 'e-mails',
  site: 'website',
  endereco: 'endereço',
  status: 'status',
  data_inicio: 'início',
  data_encerramento: 'encerramento',
  url_dashboard: 'link Dashboard',
  url_drive: 'link Drive',
  url_trello: 'link Trello',
  observacoes: 'observação',
  nome: 'nome',
  cargo: 'cargo',
  ultimo_acesso: 'último acesso',
  plataforma: 'plataforma',
  url: 'URL',
  login: 'login',
  tem_2fa: '2FA',
  tipo: 'tipo',
  etapa: 'etapa',
  etiquetas: 'etiquetas',
  responsaveis: 'responsáveis',
  briefing: 'briefing',
  data_entrega: 'entrega',
};

/** Formata um array de {tipo,valor} como "Comercial: 85 9..., Financeiro: ...". */
function formatarContatos(v: unknown): string {
  if (!Array.isArray(v) || v.length === 0) return '—';
  return v
    .map((c) => {
      const obj = c as { tipo?: string; valor?: string };
      const t = (obj?.tipo ?? '').trim();
      const val = (obj?.valor ?? '').trim();
      if (!val) return '';
      return t ? `${t}: ${val}` : val;
    })
    .filter(Boolean)
    .join(', ');
}

function formatarValor(k: string, v: unknown): string {
  if (k === 'telefones' || k === 'emails') return formatarContatos(v);
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  return String(v ?? '—');
}

/** Diferenças legíveis entre dois estados de um registro. */
export function diffCampos(
  antes: Record<string, unknown> | undefined,
  depois: Record<string, unknown>,
): string[] {
  if (!antes) return [];
  const mudancas: string[] = [];
  for (const k of Object.keys(ROTULOS)) {
    const a = JSON.stringify(antes[k] ?? '');
    const d = JSON.stringify(depois[k] ?? '');
    if (k in depois && a !== d) {
      const rot = ROTULOS[k];
      mudancas.push(`${rot}: ${formatarValor(k, antes[k])} → ${formatarValor(k, depois[k])}`);
    }
  }
  return mudancas;
}
