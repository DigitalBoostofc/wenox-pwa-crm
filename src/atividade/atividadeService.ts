import { pb } from '@/lib/pocketbase';
import { notificar, idsGestao } from '@/notificacoes/notificacoesService';

export type Entidade =
  | 'cliente' | 'contato' | 'acesso' | 'documento' | 'projeto' | 'tarefa';

interface Base {
  id: string;
  entidade: Entidade;
  ref_id: string;
  autor?: string;
  autorNome: string;
  created: string;
  collectionId?: string;
  collectionName?: string;
  expand?: { autor?: { nome?: string; email?: string } };
}
export interface MencaoUsuario { id: string; nome: string }

export interface Comentario extends Base {
  tipo: 'comentario';
  texto: string;
  anexo?: string;
  /** id do comentário-pai quando este é uma resposta (estilo Instagram). */
  parent?: string;
  /** ids dos usuários marcados com @. */
  mencionados?: string[];
  /** {id, nome} dos marcados (para destacar no texto). */
  mencionadosNomes?: MencaoUsuario[];
}

/** URL pública do anexo (imagem) de um comentário ('' se não tiver). */
export function anexoUrl(
  c: Pick<Comentario, 'id' | 'collectionId' | 'collectionName' | 'anexo'>,
  thumb?: string,
): string {
  if (!c.anexo) return '';
  return pb.files.getURL(c as unknown as Record<string, unknown>, c.anexo, thumb ? { thumb } : undefined);
}
export interface Historico extends Base {
  tipo: 'historico';
  acao: string;
}
export type ItemAtividade = Comentario | Historico;

function nomeAutor(rec: { expand?: { autor?: { nome?: string; email?: string } } }) {
  return rec.expand?.autor?.nome ?? rec.expand?.autor?.email ?? 'Sistema';
}

/** Coleção PocketBase de cada entidade que tem campo `cliente`. */
const COLECAO_ENTIDADE: Partial<Record<Entidade, string>> = {
  projeto: 'projetos', tarefa: 'tarefas', documento: 'documentos',
  acesso: 'acessos', contato: 'contatos',
};

/** Resolve o cliente dono e os responsáveis da entidade — usado para
 *  escopar comentários/histórico e direcionar notificações. */
async function resolverEntidade(
  entidade: Entidade,
  refId: string,
): Promise<{ cliente: string; responsaveis: string[] }> {
  if (entidade === 'cliente') return { cliente: refId, responsaveis: [] };
  const col = COLECAO_ENTIDADE[entidade];
  if (!col) return { cliente: '', responsaveis: [] };
  try {
    const rec = await pb.collection(col).getOne(refId, {
      fields: 'cliente,responsaveis',
    });
    const r = rec as { cliente?: string; responsaveis?: string[] };
    return { cliente: r.cliente ?? '', responsaveis: r.responsaveis ?? [] };
  } catch {
    return { cliente: '', responsaveis: [] };
  }
}

export async function listComentarios(
  entidade: Entidade,
  refId: string,
): Promise<Comentario[]> {
  const res = await pb.collection('comentarios').getFullList({
    filter: `entidade = "${entidade}" && ref_id = "${refId}"`,
    sort: '-created',
    expand: 'autor,mencionados',
  });
  return res.map((r) => {
    const rec = r as unknown as Comentario & {
      expand?: { mencionados?: { id: string; nome?: string; email?: string }[] };
    };
    const mencionadosNomes = (rec.expand?.mencionados ?? []).map((m) => ({
      id: m.id, nome: m.nome ?? m.email ?? 'alguém',
    }));
    return {
      ...(rec as unknown as Comentario),
      tipo: 'comentario',
      autorNome: nomeAutor(r),
      mencionadosNomes,
    };
  }) as Comentario[];
}

export async function addComentario(
  entidade: Entidade,
  refId: string,
  texto: string,
  comNotificacao = true,
  anexo?: File | null,
  opts?: { mencionados?: string[]; parent?: string },
): Promise<void> {
  const t = texto.trim();
  if (!t && !anexo) throw new Error('Escreva um comentário');
  const mencionados = [...new Set(opts?.mencionados ?? [])].filter(Boolean);
  const parent = opts?.parent ?? '';
  const { cliente, responsaveis } = await resolverEntidade(entidade, refId);
  const dados: Record<string, unknown> = {
    entidade,
    ref_id: refId,
    texto: t,
    autor: pb.authStore?.record?.id,
    cliente,
    parent,
    mencionados,
  };
  if (anexo) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(dados)) {
      if (Array.isArray(v)) v.forEach((x) => fd.append(k, String(x)));
      else fd.append(k, v == null ? '' : String(v));
    }
    fd.append('anexo', anexo);
    await pb.collection('comentarios').create(fd);
  } else {
    await pb.collection('comentarios').create(dados);
  }
  if (!comNotificacao) return;

  const link = entidade === 'tarefa' ? `/tarefas/${refId}`
    : entidade === 'projeto' ? `/projetos/${refId}`
    : entidade === 'cliente' ? `/clientes/${refId}`
    : cliente ? `/clientes/${cliente}` : undefined;
  const trecho = t.length > 120 ? `${t.slice(0, 120)}…` : t;

  // 1) Notifica os marcados com @ (prioridade — sempre, mesmo sem ser responsável).
  if (mencionados.length) {
    try {
      await notificar(mencionados, {
        tipo: 'mencao',
        titulo: 'Você foi mencionado num comentário',
        mensagem: trecho,
        link,
      });
    } catch { /* best-effort */ }
  }

  // 2) Se é resposta, avisa o autor do comentário-pai.
  if (parent) {
    try {
      const pai = await pb.collection('comentarios').getOne(parent, { fields: 'autor' });
      const autorPai = (pai as { autor?: string }).autor;
      if (autorPai) {
        await notificar([autorPai], {
          tipo: 'comentario',
          titulo: 'Responderam seu comentário',
          mensagem: trecho,
          link,
        });
      }
    } catch { /* best-effort */ }
  }

  // 3) Notificação geral do comentário (responsáveis/gestão), exceto quem já foi avisado pela menção.
  try {
    const base = entidade === 'tarefa' || entidade === 'projeto'
      ? responsaveis
      : await idsGestao();
    const alvos = base.filter((id) => !mencionados.includes(id));
    if (alvos.length) {
      await notificar(alvos, {
        tipo: 'comentario',
        titulo: 'Novo comentário',
        mensagem: trecho,
        link,
      });
    }
  } catch { /* notificação é best-effort */ }
}

/** Candidatos para marcação @: colaboradores internos + logins do cliente do item. */
export async function candidatosMencao(
  entidade: Entidade,
  refId: string,
): Promise<{ colaboradores: MencaoUsuario[]; clientes: MencaoUsuario[] }> {
  const { cliente } = await resolverEntidade(entidade, refId);
  try {
    const internos = await pb.collection('usuarios').getFullList({
      filter: 'role != "Cliente" && status = "Ativo"',
      fields: 'id,nome,email',
      sort: 'nome',
    });
    const colaboradores = internos.map((u) => ({
      id: u.id, nome: (u as { nome?: string; email?: string }).nome || (u as { email?: string }).email || '—',
    }));
    let clientes: MencaoUsuario[] = [];
    if (cliente) {
      const logins = await pb.collection('usuarios').getFullList({
        filter: `role = "Cliente" && cliente = "${cliente}"`,
        fields: 'id,nome,email',
        sort: 'nome',
      });
      clientes = logins.map((u) => ({
        id: u.id, nome: (u as { nome?: string; email?: string }).nome || (u as { email?: string }).email || 'Cliente',
      }));
    }
    return { colaboradores, clientes };
  } catch {
    return { colaboradores: [], clientes: [] };
  }
}

/** Exclui um comentário (e suas respostas, via cascadeDelete do campo parent).
 *  A deleteRule do PB garante: autor do comentário ou Owner/Admin. */
export async function removerComentario(id: string): Promise<void> {
  await pb.collection('comentarios').delete(id);
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
      cliente: (await resolverEntidade(entidade, refId)).cliente,
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
  descricao: 'descrição',
  projeto: 'projeto',
  lado: 'lado responsável',
  contato: 'contato',
  prazo: 'prazo',
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
