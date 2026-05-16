import { pb } from '@/lib/pocketbase';

export type Entidade = 'cliente' | 'contato' | 'acesso' | 'documento';

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
  email: 'e-mail',
  site: 'website',
  endereco: 'endereço',
  status: 'status',
  data_inicio: 'início',
  data_encerramento: 'encerramento',
  url_dashboard: 'link Dashboard',
  url_drive: 'link Drive',
  url_trello: 'link Trello',
  observacoes: 'observação',
};

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
      const av = String(antes[k] ?? '—');
      const dv = String(depois[k] ?? '—');
      mudancas.push(`${rot}: ${av} → ${dv}`);
    }
  }
  return mudancas;
}
