import { pb } from '@/lib/pocketbase';
import type { Quadro, Lista, Cartao, ComentarioCartao, AnexoCartao } from './types';
import { carregarModeloRemoto } from './modeloPost';
import { criarTarefa } from '@/tarefas/tarefasService';
import { statusInicial } from '@/tarefas/status';
import type { EtapaTarefa } from '@/tarefas/types';

const qcol = () => pb.collection('quadros');
const lcol = () => pb.collection('listas');
const ccol = () => pb.collection('cartoes');

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

/** Cria um quadro novo (opcionalmente com extras como fundo). */
export async function criarQuadro(cliente: string, nome: string, extras?: Partial<Quadro>): Promise<Quadro> {
  return (await qcol().create({ cliente, nome, ...(extras ?? {}) })) as unknown as Quadro;
}

/**
 * Clona o quadro modelo "@ TEMPLATE" para um novo quadro do cliente — só as listas
 * ATIVAS (fechada≠true) e seus cards, copiando o CONTEÚDO e resetando o ESTADO.
 * Best-effort: se o template não existir, retorna null sem lançar.
 */
export async function clonarQuadroTemplate(clienteId: string, nomeQuadro: string): Promise<Quadro | null> {
  let tpl: Quadro;
  try {
    tpl = (await qcol().getFirstListItem(`nome="${TEMPLATE_NOME}"`)) as unknown as Quadro;
  } catch { return null; }

  const novo = await criarQuadro(clienteId, nomeQuadro, { fundo_cor: tpl.fundo_cor, fundo_img: tpl.fundo_img });

  // listas ativas do template → cria no quadro novo, mapeando id antigo → novo
  const listas = (await lcol().getFullList({
    filter: `quadro="${tpl.id}" && fechada != true`, sort: 'ordem',
  })) as unknown as Lista[];
  const mapaLista = new Map<string, string>();
  for (const l of listas) {
    const nl = (await lcol().create({
      quadro: novo.id, nome: l.nome, ordem: l.ordem ?? 0, fechada: false,
      ...(l.tipo ? { tipo: l.tipo, mes: l.mes, ano: l.ano } : {}),
    })) as unknown as Lista;
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
    await ccol().create({
      quadro: novo.id, lista: novaLista,
      nome: c.nome, descricao: c.descricao ?? '', ordem: c.ordem ?? 0,
      etiquetas: c.etiquetas ?? [], checklists: c.checklists ?? [], anexos: c.anexos ?? [],
      capa: c.capa ?? '', formato: c.formato ?? '', redes: c.redes ?? [],
      concluido: false, membros: [], membros_ids: [],
    });
  }
  return novo;
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

/** Arquiva a lista (some do quadro; dados preservados). */
export async function arquivarLista(id: string): Promise<Lista> {
  return (await lcol().update(id, { fechada: true })) as unknown as Lista;
}

export async function removerLista(id: string): Promise<void> {
  await lcol().delete(id);
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

/* -------------------- Social Media / Calendário de posts ------------------ */

export const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

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
  return (await lcol().create({
    quadro: quadroId,
    nome: `${MESES_PT[mes - 1]}/${ano}`,
    tipo: 'mes',
    mes,
    ano,
    ordem,
    fechada: false,
  })) as unknown as Lista;
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

/** Vincula uma tarefa à lista (campo relation). */
export async function vincularTarefaLista(listaId: string, tarefaId: string): Promise<Lista> {
  return (await lcol().update(listaId, { tarefa: tarefaId })) as unknown as Lista;
}

/** Cria a tarefa "Social Media" para o mês/ano com as 6 etapas padrão. */
export async function criarTarefaSocialMedia(
  clienteId: string,
  mes: number,
  ano: number,
): Promise<import('@/tarefas/types').Tarefa> {
  const etapas: EtapaTarefa[] = [
    { id: smUuid(), texto: 'Briefing', tipo: 'interna', feito: false },
    { id: smUuid(), texto: 'Copy', tipo: 'interna', feito: false },
    { id: smUuid(), texto: 'Layout', tipo: 'interna', feito: false },
    { id: smUuid(), texto: 'Aprovação do cliente', tipo: 'aprovacao_cliente', feito: false },
    { id: smUuid(), texto: 'Agendamento', tipo: 'interna', feito: false },
    { id: smUuid(), texto: 'Publicação', tipo: 'interna', feito: false },
  ];
  return criarTarefa({
    nome: `Social Media — ${MESES_PT[mes - 1]}/${ano}`,
    cliente: clienteId,
    lado: 'wenox',
    status: statusInicial(),
    etapas,
    projeto: '',
    responsaveis: [],
    contato: '',
    etiquetas: [],
    ordem: 0,
    checklist: [],
    aprovacao: '',
  });
}
