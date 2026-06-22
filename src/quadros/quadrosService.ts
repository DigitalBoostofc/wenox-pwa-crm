import { pb } from '@/lib/pocketbase';
import type { Quadro, Lista, Cartao, ComentarioCartao, AnexoCartao, EtapaCard, RecorrenciaMes } from './types';
import type { Cliente } from '@/clientes/types';
import { logoUrl } from '@/clientes/clientesService';
import { ESTEIRA_SOCIAL, statusDaEsteira, ORIENTACOES_DESIGN_TEMPLATE } from './types';
import { carregarModeloRemoto } from './modeloPost';
import { criarTarefa, concluirEtapa, getTarefa } from '@/tarefas/tarefasService';
import { statusInicial, statusDoPapel } from '@/tarefas/status';
import type { EtapaTarefa } from '@/tarefas/types';

const qcol = () => pb.collection('quadros');
const lcol = () => pb.collection('listas');
const ccol = () => pb.collection('cartoes');
const rcol = () => pb.collection('recorrencias_mes');

/** Lista os quadros (com cliente expandido), ordenados por nome. */
export async function listQuadros(): Promise<Quadro[]> {
  const res = await qcol().getFullList({ sort: 'nome', expand: 'cliente' });
  return res as unknown as Quadro[];
}

export async function getQuadro(id: string): Promise<Quadro> {
  return (await qcol().getOne(id, { expand: 'cliente' })) as unknown as Quadro;
}

/** Nome do quadro modelo a ser clonado em todo cliente novo. */
const TEMPLATE_NOME = '@ TEMPLATE';

/** Nome da lista de templates dentro do quadro @ TEMPLATE usada para popular meses novos. */
const LISTA_TEMPLATES_NOME = '[TEMPLATES]';

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

/* -------------------- Social Media / Calendário de posts ------------------ */

export const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

export const DIAS_SEMANA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

let _smSeq = 0;
function smUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch { /* */ }
  return `sm_${Date.now().toString(36)}_${(_smSeq++).toString(36)}`;
}

/** Cria uma lista especial do tipo "mês" no quadro. */
export async function criarListaMes(
  quadroId: string,
  mes: number,
  ano: number,
  ordem: number,
): Promise<Lista> {
  let review_token: string;
  try {
    review_token = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `rt${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  } catch {
    review_token = `rt${Date.now().toString(36)}`;
  }
  return (await lcol().create({
    quadro: quadroId,
    nome: `${MESES_PT[mes - 1]}/${ano}`,
    tipo: 'mes',
    mes,
    ano,
    ordem,
    fechada: false,
    review_token,
  })) as unknown as Lista;
}

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

/**
 * Registra a decisão (aprovado/reprovado) de um card na etapa idx da esteira.
 * - aprovado: marca feito=true, status via statusDaEsteira, faz gating na tarefa.
 * - reprovado: feito=false, veredito='reprovado', reabre o Layout (idx 1), status='em_alteracao'.
 */
export async function decidirRevisaoCard(
  card: Cartao,
  idx: number,
  uid: string,
  veredito: 'aprovado' | 'reprovado',
  motivo?: string,
): Promise<Cartao> {
  if (veredito === 'aprovado') {
    const etapas = (card.etapas_card ?? []).map((e, i) =>
      i !== idx ? e : {
        ...e,
        feito: true,
        feito_por: uid,
        feito_em: wallclock(),
        veredito: 'aprovado' as const,
      } as EtapaCard,
    );
    const status_post = statusDaEsteira(etapas);
    const updated = await atualizarCartao(card.id, { etapas_card: etapas, status_post });

    try {
      const todos = (await listCartoes(card.quadro)).filter(
        (c) => c.lista === card.lista && (c.etapas_card?.length ?? 0) > 0,
      );
      const todosFeitos = todos.length > 0 && todos.every((c) => {
        const eCard = c.id === card.id ? etapas : (c.etapas_card ?? []);
        return eCard[idx]?.feito === true;
      });
      if (todosFeitos) {
        const lista = (await lcol().getOne(card.lista!)) as unknown as Lista;
        if (lista.tarefa) {
          const tarefa = await getTarefa(lista.tarefa);
          const etapaTarefa = tarefa.etapas?.[idx];
          if (etapaTarefa && !etapaTarefa.feito) {
            await concluirEtapa(tarefa, etapaTarefa.id);
          }
        }
      }
    } catch { /* gating best-effort */ }

    return updated;
  } else {
    // reprovado: mantém feito=false na etapa atual, reabre o Layout (idx 1)
    const etapas = (card.etapas_card ?? []).map((e, i) => {
      if (i === idx) return { ...e, feito: false, veredito: 'reprovado' as const, motivo: motivo ?? '' } as EtapaCard;
      if (i === 1) return { ...e, feito: false, veredito: undefined, motivo: undefined } as EtapaCard;
      return e;
    });
    return await atualizarCartao(card.id, { etapas_card: etapas, status_post: 'em_alteracao' });
  }
}

/** Popula a lista-mês com 1 card por item do modelo global de post. */
export async function seedTemplateMes(quadroId: string, listaId: string): Promise<void> {
  const modelo = await carregarModeloRemoto();
  const cards = modelo.cards;
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    await ccol().create({
      quadro: quadroId,
      lista: listaId,
      nome: card.nome,
      descricao: card.descricao ?? '',
      formato: card.formato ?? '',
      redes: card.redes ?? [],
      status_post: 'em_producao',
      ordem: i + 1,
      concluido: false,
      etiquetas: [],
      checklists: [],
      anexos: [],
      membros: [],
    });
  }
}

/**
 * Retorna os cards da lista [TEMPLATES] mais completa e válida do quadro.
 * Válida = contém um card cujo nome inclui 'CALEND'. Entre as válidas, escolhe a com mais cards.
 * Fallback: se o quadro não tiver nenhuma [TEMPLATES] válida, usa a do quadro global @ TEMPLATE.
 * Best-effort: retorna [] em erro sem lançar.
 */
export async function getCardsTemplateMes(quadroId: string): Promise<Cartao[]> {
  async function globalFallback(): Promise<Cartao[]> {
    const tpl = (await qcol().getFirstListItem(
      pb.filter('nome = {:tpl}', { tpl: TEMPLATE_NOME }),
    )) as unknown as Quadro;
    const listaGlobal = (await lcol().getFirstListItem(
      pb.filter('quadro = {:qid} && nome = {:lst} && fechada != true', { qid: tpl.id, lst: LISTA_TEMPLATES_NOME }),
    )) as unknown as Lista;
    return (await ccol().getFullList({
      filter: pb.filter('lista = {:lid} && arquivado != true', { lid: listaGlobal.id }),
      sort: 'ordem',
      batch: 1000,
    })) as unknown as Cartao[];
  }

  try {
    // 1. Busca TODAS as listas [TEMPLATES] do quadro (pode ser 0, 1 ou várias)
    const listas = (await lcol().getFullList({
      filter: pb.filter('quadro = {:qid} && nome = {:tpl} && fechada != true', { qid: quadroId, tpl: LISTA_TEMPLATES_NOME }),
    })) as unknown as Lista[];

    // 2. Para cada lista, busca seus cards não-arquivados ordenados por ordem
    const candidatas: { cards: Cartao[] }[] = [];
    for (const lista of listas) {
      try {
        const cards = (await ccol().getFullList({
          filter: pb.filter('lista = {:lid} && arquivado != true', { lid: lista.id }),
          sort: 'ordem',
          batch: 1000,
        })) as unknown as Cartao[];
        candidatas.push({ cards });
      } catch (err) {
        console.warn('[getCardsTemplateMes] erro ao buscar cards da lista:', lista.id, err);
      }
    }

    // 3. Filtra listas válidas (têm CALENDÁRIO), escolhe a mais completa
    const validas = candidatas.filter(({ cards }) =>
      cards.some((c) => c.nome.toUpperCase().includes('CALEND')),
    );
    if (validas.length > 0) {
      validas.sort((a, b) => b.cards.length - a.cards.length);
      return validas[0].cards;
    }

    // 4. Nenhuma válida no quadro → fallback global
    console.warn('[getCardsTemplateMes] nenhuma [TEMPLATES] válida no quadro, usando global');
    try {
      return await globalFallback();
    } catch (err) {
      console.warn('[getCardsTemplateMes] fallback global falhou:', err);
      return [];
    }
  } catch (err) {
    console.warn('[getCardsTemplateMes] erro ao buscar listas [TEMPLATES]:', err);
    try {
      return await globalFallback();
    } catch {
      return [];
    }
  }
}

/**
 * Clona um único card de template para (quadroId, listaId) com a ordem dada.
 * Copia conteúdo (nome, descricao, checklists, etiquetas, capa, anexos), reseta estado.
 * Não inclui etapas_card — apenas posts têm esteira.
 * Best-effort: retorna null em erro sem lançar.
 */
export async function clonarCardTemplate(
  quadroId: string,
  listaId: string,
  template: Cartao,
  ordem: number,
): Promise<Cartao | null> {
  try {
    return (await ccol().create({
      quadro: quadroId,
      lista: listaId,
      nome: template.nome,
      descricao: template.descricao ?? '',
      checklists: template.checklists ?? [],
      etiquetas: template.etiquetas ?? [],
      capa: template.capa ?? '',
      anexos: template.anexos ?? [],
      ordem,
      concluido: false,
      membros: [],
      membros_ids: [],
    })) as unknown as Cartao;
  } catch (err) {
    console.error('[clonarCardTemplate] falha ao clonar card:', template.nome, err);
    return null;
  }
}

/**
 * Retorna o id do responsável pela etapa com base no texto da etapa e nos ids fornecidos.
 * Layout → Design; Copy/Revisão interna/Confirmação de agendamento → Social Media.
 * Aprovação do cliente (tipo aprovacao_cliente) não recebe responsável interno — retorna undefined.
 */
export function responsavelEtapa(
  texto: string,
  ids: { designId?: string; socialId?: string },
): string | undefined {
  const t = texto.trim().toLowerCase();
  if (t === 'layout') return ids.designId;
  if (t === 'copy' || t === 'revisão interna' || t === 'confirmação de agendamento') return ids.socialId;
  return undefined;
}

/**
 * Gera cards de post para a lista-mês, um por data cujo dia da semana está em diasSemana,
 * limitando ao total de `quantidade`. Retorna a quantidade efetivamente criada.
 */
export async function gerarPostsMes(
  quadroId: string,
  listaId: string,
  mes: number,
  ano: number,
  diasSemana: number[],
  quantidade: number,
  ordemInicial = 1,
  responsaveis?: { designId?: string; socialId?: string },
): Promise<number> {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const datas: Date[] = [];
  for (let d = 1; d <= ultimoDia; d++) {
    const dt = new Date(ano, mes - 1, d);
    if (diasSemana.includes(dt.getDay())) datas.push(dt);
  }
  const selecionadas = datas.slice(0, quantidade);
  for (let i = 0; i < selecionadas.length; i++) {
    const dt = selecionadas[i];
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    await ccol().create({
      quadro: quadroId,
      lista: listaId,
      nome: `${dd} ${DIAS_SEMANA_CURTO[dt.getDay()]}: `,
      data_post: `${ano}-${mm}-${dd} 12:00:00`,
      status_post: 'em_producao',
      etapas_card: ESTEIRA_SOCIAL.map((e) => {
        const resp = responsavelEtapa(e.texto, responsaveis ?? {});
        return {
          id: smUuid(),
          texto: e.texto,
          tipo: e.tipo,
          feito: false,
          ...(resp ? { responsavel: resp } : {}),
        };
      }),
      ordem: ordemInicial + i,
      descricao: ORIENTACOES_DESIGN_TEMPLATE,
      concluido: false,
      etiquetas: [],
      checklists: [],
      anexos: [],
      membros: [],
    });
  }
  return selecionadas.length;
}

/** Vincula uma tarefa à lista (campo relation). */
export async function vincularTarefaLista(listaId: string, tarefaId: string): Promise<Lista> {
  return (await lcol().update(listaId, { tarefa: tarefaId })) as unknown as Lista;
}

/** Cria a tarefa "Social Media" para o mês/ano com a ESTEIRA_SOCIAL (5 etapas).
 *  Responsável da tarefa = somente Social (Design só aparece nas etapas dos posts).
 *  Nome: "MÊS - CLIENTE - SOCIAL MEDIA" quando nomeCliente fornecido. */
export async function criarTarefaSocialMedia(
  clienteId: string,
  mes: number,
  ano: number,
  responsaveis?: { designId?: string; socialId?: string },
  nomeCliente?: string,
  projetoId?: string,
): Promise<import('@/tarefas/types').Tarefa> {
  const etapas: EtapaTarefa[] = ESTEIRA_SOCIAL.map((e) => {
    const resp = responsavelEtapa(e.texto, responsaveis ?? {});
    return {
      id: smUuid(),
      texto: e.texto,
      tipo: e.tipo,
      feito: false,
      ...(resp ? { responsavel: resp } : {}),
    };
  });
  // Social primeiro, Design em seguida — Set evita duplicata se forem o mesmo usuário.
  // Design consta aqui pra que EtapasStepper resolva o nome do responsável da etapa Layout via expand.
  const responsaveisIds = [...new Set([responsaveis?.socialId, responsaveis?.designId].filter(Boolean))] as string[];
  const nomeTarefa = nomeCliente?.trim()
    ? `${MESES_PT[mes - 1].toUpperCase()} - ${nomeCliente.trim().toUpperCase()} - SOCIAL MEDIA`
    : `Social Media — ${MESES_PT[mes - 1]}/${ano}`;

  const mesAnterior = mes === 1 ? 12 : mes - 1;
  const anoAnterior = mes === 1 ? ano - 1 : ano;
  const ultimoDiaAnt = new Date(anoAnterior, mesAnterior, 0).getDate();
  const diaPrazo = Math.min(30, ultimoDiaAnt);
  const prazoMes = `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(diaPrazo).padStart(2, '0')}`;

  const tarefa = await criarTarefa({
    nome: nomeTarefa,
    tipo: 'Social Media',
    cliente: clienteId,
    lado: 'wenox',
    status: statusInicial(),
    etapas,
    projeto: projetoId ?? '',
    responsaveis: responsaveisIds,
    contato: '',
    etiquetas: [],
    ordem: 0,
    checklist: [],
    aprovacao: '',
    prazo: prazoMes,
  });

  // criarTarefa deriva status por etapas (todas zeradas → "Não iniciado").
  // Forçamos "Em andamento" diretamente no PB, sem ruído no histórico.
  try {
    await pb.collection('tarefas').update(tarefa.id, {
      status: statusDoPapel('em_andamento') ?? 'Em andamento',
    });
  } catch (err) {
    console.warn('[criarTarefaSocialMedia] falha ao forçar status Em andamento:', err);
  }

  return tarefa;
}

/* ------------------- Recorrência mensal por quadro -------------------- */

/** Retorna a config de recorrência do quadro, ou null se não houver. */
export async function getRecorrenciaMes(quadroId: string): Promise<RecorrenciaMes | null> {
  try {
    return (await rcol().getFirstListItem(
      pb.filter('quadro = {:q}', { q: quadroId }),
    )) as unknown as RecorrenciaMes;
  } catch (err) {
    if ((err as { status?: number })?.status === 404) return null;
    console.error('[getRecorrenciaMes] erro inesperado:', err);
    throw err;
  }
}

/** UPSERT da config de recorrência; seta ativa=true e grava ultimo_mes/ultimo_ano. */
export async function salvarRecorrenciaMes(
  cfg: Omit<RecorrenciaMes, 'id' | 'created' | 'updated'>,
): Promise<RecorrenciaMes> {
  const existente = await getRecorrenciaMes(cfg.quadro);
  const payload = { ...cfg, ativa: true };
  if (existente) {
    return (await rcol().update(existente.id, payload)) as unknown as RecorrenciaMes;
  }
  return (await rcol().create(payload)) as unknown as RecorrenciaMes;
}

/** Desativa a recorrência do quadro (preserva a config para reativação futura). */
export async function desativarRecorrenciaMes(quadroId: string): Promise<void> {
  const existente = await getRecorrenciaMes(quadroId);
  if (!existente) return;
  await rcol().update(existente.id, { ativa: false });
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
  return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '');
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
  const updated = await atualizarCartao(card.id, { etapas_card: etapas, status_post });

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
    }
  } catch { /* gating best-effort */ }

  return updated;
}
