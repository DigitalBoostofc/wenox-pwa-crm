import { pb } from '@/lib/pocketbase';
import type { Quadro, Lista, Cartao, ComentarioCartao, AnexoCartao, EtapaCard } from './types';
import type { Cliente } from '@/clientes/types';
import { logoUrl } from '@/clientes/clientesService';
import { statusDaEsteira, ORDEM_PAPEL, ordemPendenteCard } from './types';
import { concluirEtapa, getTarefa } from '@/tarefas/tarefasService';
import { notificar } from '@/notificacoes/notificacoesService';
import { opcaoIdDoStatusPost } from '@/tarefas/status';

const qcol = () => pb.collection('quadros');
const lcol = () => pb.collection('listas');
const ccol = () => pb.collection('cartoes');

/** Lista os quadros (com cliente expandido), ordenados por nome. */
export async function listQuadros(): Promise<Quadro[]> {
  const res = await qcol().getFullList({ sort: 'nome', expand: 'cliente' });
  return res as unknown as Quadro[];
}

/**
 * Ids dos quadros acessíveis a um usuário restrito (Membro/Visualizador):
 * quadros de clientes onde ele é responsável de um PROJETO, OU quadros que têm
 * alguma LISTA cuja TAREFA tem ele como responsável. Recebe `quadros` p/ evitar
 * refetch. Owner/Admin/Gestor não passam por aqui (veem tudo).
 */
export async function quadrosAcessiveisIds(uid: string, quadros: Quadro[]): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!uid) return ids;
  // Clientes onde o usuário é responsável de algum projeto.
  const projetos = (await pb.collection('projetos').getFullList({
    filter: `responsaveis ~ "${uid}"`, fields: 'cliente', batch: 500,
  })) as unknown as { cliente?: string }[];
  const clientes = new Set(projetos.map((p) => p.cliente).filter(Boolean) as string[]);
  // Quadros que têm lista com tarefa onde o usuário é responsável.
  const tarefas = (await pb.collection('tarefas').getFullList({
    filter: `responsaveis ~ "${uid}"`, fields: 'id', batch: 500,
  })) as unknown as { id: string }[];
  const quadrosViaTarefa = new Set<string>();
  if (tarefas.length) {
    const filtro = tarefas.map((t) => `tarefa="${t.id}"`).join(' || ');
    const listas = (await lcol().getFullList({ filter: filtro, fields: 'quadro', batch: 1000 })) as unknown as { quadro?: string }[];
    for (const l of listas) if (l.quadro) quadrosViaTarefa.add(l.quadro);
  }
  for (const q of quadros) {
    if (quadrosViaTarefa.has(q.id) || (q.cliente && clientes.has(q.cliente))) ids.add(q.id);
  }
  return ids;
}

export async function getQuadro(id: string): Promise<Quadro> {
  return (await qcol().getOne(id, { expand: 'cliente' })) as unknown as Quadro;
}

/** Nome do quadro modelo a ser clonado em todo cliente novo. */
const TEMPLATE_NOME = '@ TEMPLATE';

/** Cria um quadro novo (opcionalmente com extras como fundo). */
export async function criarQuadro(cliente: string, nome: string, extras?: Partial<Quadro>): Promise<Quadro> {
  return (await qcol().create({ cliente, nome, ...(extras ?? {}) })) as unknown as Quadro;
}

/**
 * Clona o quadro modelo "@ TEMPLATE" para um novo quadro do cliente — só as listas
 * ATIVAS (fechada≠true) e seus cards, copiando o CONTEÚDO e resetando o ESTADO.
 * Lança Error se o template não existir. Auto-limpante: se um create de lista/cartão
 * falhar no meio, deleta o quadro recém-criado e todos os itens já criados antes de relançar.
 */
export async function clonarQuadroTemplate(clienteId: string, nomeQuadro: string): Promise<Quadro> {
  let tpl: Quadro;
  try {
    tpl = (await qcol().getFirstListItem(`nome="${TEMPLATE_NOME}"`)) as unknown as Quadro;
  } catch {
    throw new Error(`quadro modelo '${TEMPLATE_NOME}' não encontrado`);
  }

  // Herda o logo do cliente como imagem de fundo (fundo_img) do quadro novo.
  // Quadros antigos (Trello) já têm fundo_img preenchido; novos ficavam sem.
  let fundoImg = tpl.fundo_img;
  try {
    const cli = await pb.collection('clientes').getOne(clienteId, {
      fields: 'id,collectionId,collectionName,logo',
    });
    const logo = cli.logo;
    if (typeof logo === 'string' && logo !== '') {
      const url = logoUrl(cli as unknown as Pick<Cliente, 'id' | 'logo'>);
      if (url) fundoImg = url;
    }
  } catch { /* sem logo ou cliente não encontrado — usa fundo do template */ }

  const novo = await criarQuadro(clienteId, nomeQuadro, { fundo_cor: tpl.fundo_cor, fundo_img: fundoImg });

  const listasIds: string[] = [];
  const cartoesIds: string[] = [];

  async function limpar(): Promise<void> {
    for (const id of cartoesIds) { try { await ccol().delete(id); } catch { /* */ } }
    for (const id of listasIds) { try { await lcol().delete(id); } catch { /* */ } }
    try { await qcol().delete(novo.id); } catch { /* */ }
  }

  try {
    // listas ativas do template → cria no quadro novo, mapeando id antigo → novo
    const listas = (await lcol().getFullList({
      filter: `quadro="${tpl.id}" && fechada != true`, sort: 'ordem', batch: 1000,
    })) as unknown as Lista[];
    const mapaLista = new Map<string, string>();
    for (const l of listas) {
      const nl = (await lcol().create({
        quadro: novo.id, nome: l.nome, ordem: l.ordem ?? 0, fechada: false,
        ...(l.tipo ? { tipo: l.tipo, mes: l.mes, ano: l.ano } : {}),
      })) as unknown as Lista;
      listasIds.push(nl.id);
      mapaLista.set(l.id, nl.id);
    }
    if (mapaLista.size === 0) return novo;

    // cards das listas clonadas (ignora cards de listas arquivadas via mapa)
    const cards = (await ccol().getFullList({
      filter: `quadro="${tpl.id}" && arquivado != true`, sort: 'ordem', batch: 1000,
    })) as unknown as Cartao[];
    for (const c of cards) {
      const novaLista = c.lista ? mapaLista.get(c.lista) : undefined;
      if (!novaLista) continue;
      const nc = (await ccol().create({
        quadro: novo.id, lista: novaLista,
        nome: c.nome, descricao: c.descricao ?? '', ordem: c.ordem ?? 0,
        etiquetas: c.etiquetas ?? [], checklists: c.checklists ?? [], anexos: c.anexos ?? [],
        capa: c.capa ?? '', formato: c.formato ?? '', redes: c.redes ?? [],
        concluido: false, membros: [], membros_ids: [],
      })) as unknown as Cartao;
      cartoesIds.push(nc.id);
    }
    return novo;
  } catch (err) {
    await limpar();
    throw err;
  }
}

/** Listas (colunas) de um quadro, na ordem do Trello. */
export async function listListas(quadroId: string): Promise<Lista[]> {
  const res = await lcol().getFullList({
    filter: `quadro = "${quadroId}" && fechada = false`,
    sort: 'ordem',
  });
  return res as unknown as Lista[];
}

/** Cartões ATIVOS de um quadro (não arquivados). */
export async function listCartoes(quadroId: string): Promise<Cartao[]> {
  const res = await ccol().getFullList({
    filter: `quadro = "${quadroId}" && arquivado != true`,
    sort: 'ordem',
    batch: 1000,
  });
  return res as unknown as Cartao[];
}

/** Cartões arquivados de um quadro. */
export async function listCartoesArquivados(quadroId: string): Promise<Cartao[]> {
  const res = await ccol().getFullList({
    filter: `quadro = "${quadroId}" && arquivado = true`,
    sort: '-updated', batch: 1000,
  });
  return res as unknown as Cartao[];
}

/** Arquiva/desarquiva um cartão. */
export async function arquivarCartao(id: string, arquivado: boolean): Promise<Cartao> {
  return (await ccol().update(id, { arquivado })) as unknown as Cartao;
}

export async function getCartao(id: string): Promise<Cartao> {
  return (await ccol().getOne(id)) as unknown as Cartao;
}

/** Move/atualiza posição de um cartão (drag entre colunas). */
export async function moverCartao(id: string, listaId: string, ordem: number): Promise<Cartao> {
  return (await ccol().update(id, { lista: listaId, ordem })) as unknown as Cartao;
}

export async function atualizarCartao(id: string, dados: Partial<Cartao>): Promise<Cartao> {
  return (await ccol().update(id, dados)) as unknown as Cartao;
}

export async function criarCartao(quadroId: string, listaId: string, nome: string, ordem: number): Promise<Cartao> {
  return (await ccol().create({
    quadro: quadroId, lista: listaId, nome: nome.trim(), ordem,
    descricao: '', concluido: false, etiquetas: [], checklists: [], anexos: [], membros: [],
  })) as unknown as Cartao;
}

export async function removerCartao(id: string): Promise<void> {
  await ccol().delete(id);
}

export async function criarLista(quadroId: string, nome: string, ordem: number): Promise<Lista> {
  return (await lcol().create({ quadro: quadroId, nome: nome.trim(), ordem, fechada: false })) as unknown as Lista;
}

export async function atualizarLista(id: string, dados: Partial<Lista>): Promise<Lista> {
  return (await lcol().update(id, dados)) as unknown as Lista;
}

/** Arquiva a lista (some do quadro; dados preservados). Propaga arquivamento à tarefa vinculada (best-effort). */
export async function arquivarLista(id: string): Promise<Lista> {
  const lista = (await lcol().getOne(id)) as unknown as Lista;
  const result = (await lcol().update(id, { fechada: true })) as unknown as Lista;
  if (lista.tarefa) {
    try { await pb.collection('tarefas').update(lista.tarefa, { arquivada: true }); } catch { /* best-effort */ }
  }
  return result;
}

/** Listas arquivadas de um quadro. */
export async function listListasArquivadas(quadroId: string): Promise<Lista[]> {
  const res = await lcol().getFullList({
    filter: pb.filter('quadro = {:qid} && fechada = true', { qid: quadroId }),
    sort: 'ordem',
  });
  return res as unknown as Lista[];
}

/** Restaura uma lista arquivada (torna visível no quadro novamente). Propaga restauração à tarefa vinculada (best-effort). */
export async function restaurarLista(id: string): Promise<Lista> {
  const lista = (await lcol().getOne(id)) as unknown as Lista;
  const result = (await lcol().update(id, { fechada: false })) as unknown as Lista;
  if (lista.tarefa) {
    try { await pb.collection('tarefas').update(lista.tarefa, { arquivada: false }); } catch { /* best-effort */ }
  }
  return result;
}

export async function removerLista(id: string): Promise<void> {
  await lcol().delete(id);
}

/** Deleta permanentemente uma lista e todos os cartões contidos nela (evita órfãos). Deleta também a tarefa vinculada (best-effort). */
export async function deletarListaComCards(id: string): Promise<void> {
  const lista = (await lcol().getOne(id)) as unknown as Lista;
  const cards = await ccol().getFullList({ filter: pb.filter('lista = {:lid}', { lid: id }), batch: 1000 });
  let falhas = 0;
  for (const c of cards) {
    try { await ccol().delete(c.id); } catch { falhas++; }
  }
  if (falhas > 0) throw new Error(`Não foi possível deletar ${falhas} cartão(ões) da lista; lista preservada.`);
  await lcol().delete(id);
  if (lista.tarefa) {
    try { await pb.collection('tarefas').delete(lista.tarefa); } catch { /* best-effort: 404 ok */ }
  }
}

/* ----------------------------- Anexos / capa ----------------------------- */

/** URL pública de um arquivo enviado (campo file `uploads`). */
export function urlUpload(card: Cartao, filename: string): string {
  return pb.files.getURL(card as unknown as Record<string, unknown>, filename);
}

/** Sobe arquivos novos pro card (append no campo `uploads` do PocketBase). Legado. */
export async function subirAnexos(card: Cartao, files: File[]): Promise<Cartao> {
  const fd = new FormData();
  for (const f of files) fd.append('uploads+', f); // '+' = adiciona sem remover os existentes
  return (await ccol().update(card.id, fd)) as unknown as Cartao;
}

/** Endpoint do servidor de mídia (grava no disco grande, mesmas pastas dos anexos do Trello). */
const MEDIA_UPLOAD_URL = 'https://media.wenox.com.br/_up';

/**
 * Sobe arquivos pro servidor de mídia (media.wenox.com.br) e registra cada um
 * no campo `anexos` (json) do card. Mantém o disco do PocketBase enxuto.
 */
export async function subirAnexosMedia(card: Cartao, files: File[], clienteId?: string): Promise<Cartao> {
  const novos: AnexoCartao[] = [];
  for (const f of files) {
    const res = await fetch(MEDIA_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: pb.authStore.token,
        'Content-Type': f.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(f.name),
        'X-Cliente': clienteId || card.quadro || 'geral',
        'X-Card': card.id,
      },
      body: f,
    });
    if (!res.ok) throw new Error(`Falha no upload (${res.status})`);
    const j = await res.json();
    novos.push({ nome: j.nome, url: j.url, mime: j.mime, bytes: j.bytes, data: j.data });
  }
  const anexos = [...(card.anexos ?? []), ...novos];
  return (await ccol().update(card.id, { anexos })) as unknown as Cartao;
}

export async function definirCapa(id: string, url: string): Promise<Cartao> {
  return (await ccol().update(id, { capa: url })) as unknown as Cartao;
}

/* ------------------------------- Comentários ----------------------------- */

export async function listComentariosCartao(cardId: string): Promise<ComentarioCartao[]> {
  const res = await pb.collection('comentarios').getFullList({
    filter: `entidade = "cartao" && ref_id = "${cardId}"`,
    sort: '-created', expand: 'autor',
  });
  return res as unknown as ComentarioCartao[];
}

export async function addComentarioCartao(cardId: string, texto: string, clienteId?: string): Promise<void> {
  const t = texto.trim();
  if (!t) return;
  await pb.collection('comentarios').create({
    entidade: 'cartao', ref_id: cardId, texto: t,
    autor: pb.authStore?.record?.id, cliente: clienteId || '',
  });
}

export async function removerComentarioCartao(id: string): Promise<void> {
  await pb.collection('comentarios').delete(id);
}

/* -------------------------- Histórico de atividades ----------------------- */
/* Atividades são armazenadas como comentários (mesma coleção/ref_id) com um
   caractere invisível como marcador no início do texto, para aparecerem junto
   na área de comentários sem exigir mudança de schema no servidor. */

export const ATIV_MARK = '⁣'; // INVISIBLE SEPARATOR (U+2063)
export function ehAtividade(texto?: string): boolean {
  return !!texto && texto.startsWith(ATIV_MARK);
}
export function textoAtividade(texto: string): string {
  return texto.startsWith(ATIV_MARK) ? texto.slice(ATIV_MARK.length) : texto;
}
export async function registrarAtividadeCartao(cardId: string, texto: string, clienteId?: string): Promise<ComentarioCartao> {
  const rec = await pb.collection('comentarios').create({
    entidade: 'cartao', ref_id: cardId, texto: ATIV_MARK + texto,
    autor: pb.authStore?.record?.id, cliente: clienteId || '',
  });
  return rec as unknown as ComentarioCartao;
}

/* -------------------- Review token de lista -------------------- */

/** Retorna o review_token da lista; se vazio, gera, grava e retorna. */
export async function getOuCriarReviewToken(listaId: string): Promise<string> {
  const lista = (await lcol().getOne(listaId)) as unknown as Lista;
  if (lista.review_token) return lista.review_token;
  let token: string;
  try {
    token = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `rt${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  } catch {
    token = `rt${Date.now().toString(36)}`;
  }
  await lcol().update(listaId, { review_token: token });
  return token;
}

/** Busca uma lista pelo review_token. */
export async function getListaPorToken(token: string): Promise<Lista> {
  return (await lcol().getFirstListItem(`review_token="${token}"`)) as unknown as Lista;
}

/* ------------------- Saúde dos vínculos (R1.B) -------------------- */

/** Quadros sem cliente vinculado, excluindo o template. */
export async function listQuadrosSemCliente(): Promise<Quadro[]> {
  const res = await qcol().getFullList({
    filter: `cliente = "" && nome != "${TEMPLATE_NOME}"`,
    sort: 'nome',
  });
  return res as unknown as Quadro[];
}

/** Retorna o primeiro quadro vinculado ao cliente, ou null se não houver (404). */
export async function getQuadroDoCliente(clienteId: string): Promise<Quadro | null> {
  try {
    return (await qcol().getFirstListItem(
      pb.filter('cliente = {:cid} && nome != {:tpl}', { cid: clienteId, tpl: TEMPLATE_NOME }),
    )) as unknown as Quadro;
  } catch (err) {
    if ((err as { status?: number })?.status === 404) return null;
    console.error('[getQuadroDoCliente] erro inesperado:', err);
    throw err;
  }
}

/** Clientes sem nenhum quadro vinculado. */
export async function listClientesSemQuadro(): Promise<Cliente[]> {
  const [todos, quadros] = await Promise.all([
    pb.collection('clientes').getFullList({ sort: 'nome_fantasia,nome', fields: 'id,nome,nome_fantasia' }),
    qcol().getFullList({ filter: `nome != "${TEMPLATE_NOME}"`, fields: 'id,cliente' }),
  ]);
  const comQuadro = new Set<string>(
    (quadros as unknown as Array<{ cliente?: string }>).map((q) => q.cliente ?? '').filter(Boolean),
  );
  return (todos as unknown as Cliente[]).filter((c) => !comQuadro.has(c.id));
}

function _normalizarNome(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export interface SugestaoVinculo { quadro: Quadro; cliente: Cliente }
export interface AmbiguidadeVinculo { quadro: Quadro; candidatos: Cliente[] }
export interface ResultadoSugestoes {
  sugestoes: SugestaoVinculo[];
  ambiguidades: AmbiguidadeVinculo[];
  quadrosSemCliente: Quadro[];
  clientesSemQuadro: Cliente[];
  todosClientes: Cliente[];
}

/**
 * Casa quadros sem cliente com clientes sem quadro por nome normalizado
 * (trim + lowercase + sem acento). Retorna matches únicos + ambiguidades.
 */
export async function sugerirVinculos(): Promise<ResultadoSugestoes> {
  const [quadrosSemCliente, todosC, todosQ] = await Promise.all([
    listQuadrosSemCliente(),
    pb.collection('clientes').getFullList({ sort: 'nome_fantasia,nome', fields: 'id,nome,nome_fantasia' }),
    qcol().getFullList({ filter: `nome != "${TEMPLATE_NOME}"`, fields: 'id,cliente' }),
  ]);
  const comQuadro = new Set<string>(
    (todosQ as unknown as Array<{ cliente?: string }>).map((q) => q.cliente ?? '').filter(Boolean),
  );
  const todosClientes = todosC as unknown as Cliente[];
  const clientesSemQuadro = todosClientes.filter((c) => !comQuadro.has(c.id));

  const sugestoes: SugestaoVinculo[] = [];
  const ambiguidades: AmbiguidadeVinculo[] = [];
  for (const q of quadrosSemCliente) {
    const nomeQ = _normalizarNome(q.nome);
    const matches = clientesSemQuadro.filter(
      (c) => _normalizarNome(c.nome_fantasia || c.nome || '') === nomeQ,
    );
    if (matches.length === 1) sugestoes.push({ quadro: q, cliente: matches[0] });
    else if (matches.length > 1) ambiguidades.push({ quadro: q, candidatos: matches });
  }
  return { sugestoes, ambiguidades, quadrosSemCliente, clientesSemQuadro, todosClientes };
}

/** Vincula um quadro a um cliente. */
export async function vincularQuadro(quadroId: string, clienteId: string): Promise<Quadro> {
  return (await qcol().update(quadroId, { cliente: clienteId })) as unknown as Quadro;
}

/* ------------------------------------------------------------------- */

function wallclock(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
    + ' ' + [String(d.getHours()).padStart(2, '0'), String(d.getMinutes()).padStart(2, '0'), String(d.getSeconds()).padStart(2, '0')].join(':');
}

/**
 * Confirma a etapa idx de um card-post.
 * Atualiza etapas_card + status_post; depois faz gating: se todos os cards
 * da lista já têm a etapa idx feita, conclui a etapa de mesmo índice na tarefa.
 */
export async function confirmarEtapaCard(
  card: Cartao,
  idx: number,
  uid: string,
  opts?: { veredito?: 'aprovado' | 'reprovado'; motivo?: string },
): Promise<Cartao> {
  const etapas = (card.etapas_card ?? []).map((e, i) => {
    if (i < idx) return e;
    if (i === idx) return {
      ...e,
      feito: true,
      feito_por: uid,
      feito_em: wallclock(),
      ...(opts?.veredito ? { veredito: opts.veredito } : {}),
      ...(opts?.motivo ? { motivo: opts.motivo } : {}),
    } as EtapaCard;
    // etapas POSTERIORES são resetadas: refazer/confirmar uma etapa invalida
    // decisões seguintes (ex.: refez o Layout → some o veredito da revisão).
    const { veredito: _v, motivo: _m, feito_por: _p, feito_em: _t, ...resto } = e;
    return { ...resto, feito: false } as EtapaCard;
  });
  const status_post = statusDaEsteira(etapas);
  // F3: mantém o espelho status_opcao em sincronia com a derivação da esteira, p/ o
  // chip (que lê status_opcao) refletir o avanço. A derivação some no F4 (cutover).
  const status_opcao = opcaoIdDoStatusPost(status_post) ?? '';
  const updated = await atualizarCartao(card.id, { etapas_card: etapas, status_post, status_opcao });

  // Gating: verifica se todos os cards da lista completaram esta etapa
  try {
    const todos = (await listCartoes(card.quadro)).filter(
      (c) => c.lista === card.lista && (c.etapas_card?.length ?? 0) > 0,
    );
    const todosFeitos = todos.length > 0 && todos.every((c) => {
      const eCard = c.id === card.id ? etapas : (c.etapas_card ?? []);
      return eCard[idx]?.feito === true;
    });
    if (todosFeitos) {
      const lista = (await pb.collection('listas').getOne(card.lista!)) as unknown as Lista;
      if (lista.tarefa) {
        const tarefa = await getTarefa(lista.tarefa);
        const etapaTarefa = tarefa.etapas?.[idx];
        if (etapaTarefa && !etapaTarefa.feito) {
          await concluirEtapa(tarefa, etapaTarefa.id);
        }
      }
      // Handoff em lote: a etapa anterior fechou em todos os cards → libera a próxima
      // e notifica o responsável dela (porteira aberta). Pula aprovação do cliente.
      const proxima = etapas[idx + 1];
      if (proxima && proxima.responsavel && proxima.tipo !== 'aprovacao_cliente') {
        try {
          await notificar([proxima.responsavel], {
            tipo: 'atribuicao',
            titulo: `Lote liberado: ${proxima.texto}`,
            mensagem: `Todos os posts concluíram "${etapas[idx]?.texto ?? 'a etapa anterior'}". ${proxima.texto} está liberado para você.`,
            link: `/quadros/${card.quadro}?lista=${card.lista}`,
          });
        } catch { /* notificação best-effort */ }
      }
    }
  } catch { /* gating best-effort */ }

  return updated;
}

/** Progresso dos cards por etapa, agregado por tarefa do mês. */
export interface ProgressoCardsTarefa {
  /** total de cards-post da lista vinculada à tarefa */
  total: number;
  /** por papel: quantos cards já CONCLUÍRAM aquele papel (passaram dele) */
  porPapel: Record<string, number>;
  /** quadro e lista vinculados (p/ navegar do "etapas pendentes" pro board) */
  quadro?: string;
  lista?: string;
  /** algum card em retrabalho (reprovado na revisão interna) → "Em alteração interna" */
  emAlteracaoInterna?: boolean;
}

/**
 * Para cada tarefa em `tarefaIds`, calcula o progresso dos cards-post da sua lista
 * vinculada (lista.tarefa = tarefaId). Só retorna entradas das tarefas que têm
 * lista com cards de esteira. Usa 2 queries (listas + cards) com filtro batched.
 */
export async function progressoCardsDasTarefas(
  tarefaIds: string[],
): Promise<Record<string, ProgressoCardsTarefa>> {
  const ids = [...new Set(tarefaIds.filter(Boolean))];
  if (!ids.length) return {};
  const filtroListas = ids.map((id) => `tarefa="${id}"`).join(' || ');
  const listas = (await lcol().getFullList({ filter: filtroListas, batch: 1000 })) as unknown as Lista[];
  if (!listas.length) return {};
  const listaToTarefa = new Map<string, string>();
  const res: Record<string, ProgressoCardsTarefa> = {};
  for (const l of listas) {
    if (!l.tarefa) continue;
    listaToTarefa.set(l.id, l.tarefa);
    // pré-popula (mesmo sem cards) p/ garantir quadro/lista da navegação
    if (!res[l.tarefa]) res[l.tarefa] = { total: 0, porPapel: {}, quadro: l.quadro, lista: l.id };
  }
  const filtroCards = listas.map((l) => `lista="${l.id}"`).join(' || ');
  const cards = (await ccol().getFullList({
    filter: `(${filtroCards}) && arquivado!=true`, batch: 2000,
  })) as unknown as Cartao[];
  for (const c of cards) {
    if ((c.etapas_card?.length ?? 0) === 0) continue;
    const tid = listaToTarefa.get(c.lista ?? '');
    if (!tid || !res[tid]) continue;
    const r = res[tid];
    r.total++;
    const ord = ordemPendenteCard(c.etapas_card);
    for (const [papel, nivel] of Object.entries(ORDEM_PAPEL)) {
      if (ord > nivel) r.porPapel[papel] = (r.porPapel[papel] ?? 0) + 1;
    }
    if (statusDaEsteira(c.etapas_card) === 'em_alteracao') r.emAlteracaoInterna = true;
  }
  return res;
}
