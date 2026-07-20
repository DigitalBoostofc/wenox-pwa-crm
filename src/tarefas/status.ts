import { useSyncExternalStore } from 'react';

/* -------------------------------------------------------------------------- */
/*  Status GLOBAL — modelo "Notion": GRUPOS (nível 1) + OPÇÕES (nível 2).      */
/*  Conjunto único compartilhado por tarefas E posts. Definido manualmente.    */
/*  Guardado na coleção `configuracoes` (chave="status_global"), legível por    */
/*  todos e gravável por gestores. Cache local p/ render imediato.             */
/*                                                                              */
/*  F1 (aditivo): este módulo expõe o núcleo novo (grupos+opções) e mantém     */
/*  SHIMS legados (useStatuses/corStatusClass/statusInicial/statusConcluido/    */
/*  statusDoPapel) sobre as opções, para os ~25 consumidores seguirem          */
/*  funcionando até F2–F4 migrarem. Ver docs/status-global-contract.md.        */
/* -------------------------------------------------------------------------- */

export type CorStatus = 'cinza' | 'azul' | 'ambar' | 'vermelho' | 'verde' | 'roxo';

export interface StatusGrupo {
  id: string;
  nome: string;
  cor: CorStatus;
  ordem: number;
}

export interface StatusOpcao {
  id: string;
  grupo: string; // StatusGrupo.id
  nome: string;
  cor: CorStatus;
  ordem: number;
}

export interface StatusGlobalConfig {
  versao: number;
  grupos: StatusGrupo[];
  opcoes: StatusOpcao[];
}

/** Classes Tailwind de cada cor (pill/coluna). */
export const CORES_STATUS: Record<CorStatus, string> = {
  cinza:    'border-border bg-secondary text-muted-foreground',
  azul:     'border-primary/50 bg-primary/15 text-primary',
  ambar:    'border-amber-500/50 bg-amber-500/15 text-amber-400',
  vermelho: 'border-destructive/50 bg-destructive/15 text-destructive',
  verde:    'border-emerald-500/50 bg-emerald-500/15 text-emerald-400',
  roxo:     'border-violet-500/50 bg-violet-500/15 text-violet-400',
};

export const ROTULO_COR: Record<CorStatus, string> = {
  cinza: 'Cinza', azul: 'Azul', ambar: 'Âmbar',
  vermelho: 'Vermelho', verde: 'Verde', roxo: 'Roxo',
};

/* ---------------------- seed: ids estáveis (well-known) -------------------- */
/* Os shims legados resolvem por estes ids; o backfill (§5 do contrato) os fixa. */

export const SEED_GRUPO = {
  aFazer:    'g_a_fazer',
  andamento: 'g_andamento',
  concluido: 'g_concluido',
} as const;

export const SEED_OPCAO = {
  naoIniciado: 'op_nao_iniciado',
  emProducao:  'op_em_producao',
  emAndamento: 'op_em_andamento',
  aguardando:  'op_aguardando',
  emAlteracao: 'op_em_alteracao',
  agendar:     'op_agendar',
  concluido:   'op_concluido',
  agendado:    'op_agendado',
  postado:     'op_postado',
} as const;

/** Configuração de fábrica (v1) — também é o fallback offline.
 *  Mapeia DEFAULT_STATUS (tarefas) + STATUS_POST (posts) em 3 grupos. */
export const DEFAULT_STATUS_GLOBAL: StatusGlobalConfig = {
  versao: 1,
  grupos: [
    { id: SEED_GRUPO.aFazer,    nome: 'A fazer',      cor: 'cinza', ordem: 0 },
    { id: SEED_GRUPO.andamento, nome: 'Em andamento', cor: 'azul',  ordem: 1 },
    { id: SEED_GRUPO.concluido, nome: 'Concluído',    cor: 'verde', ordem: 2 },
  ],
  opcoes: [
    { id: SEED_OPCAO.naoIniciado, grupo: SEED_GRUPO.aFazer,    nome: 'Não iniciado',         cor: 'cinza',    ordem: 0 },
    { id: SEED_OPCAO.emProducao,  grupo: SEED_GRUPO.aFazer,    nome: 'Em produção',          cor: 'cinza',    ordem: 1 },
    { id: SEED_OPCAO.emAndamento, grupo: SEED_GRUPO.andamento, nome: 'Em andamento',         cor: 'azul',     ordem: 0 },
    { id: SEED_OPCAO.aguardando,  grupo: SEED_GRUPO.andamento, nome: 'Aguardando aprovação', cor: 'ambar',    ordem: 1 },
    { id: SEED_OPCAO.emAlteracao, grupo: SEED_GRUPO.andamento, nome: 'Em alteração',         cor: 'vermelho', ordem: 2 },
    { id: SEED_OPCAO.agendar,     grupo: SEED_GRUPO.andamento, nome: 'Agendar',              cor: 'azul',     ordem: 3 },
    { id: SEED_OPCAO.concluido,   grupo: SEED_GRUPO.concluido, nome: 'Concluído',            cor: 'verde',    ordem: 0 },
    { id: SEED_OPCAO.agendado,    grupo: SEED_GRUPO.concluido, nome: 'Agendado',             cor: 'verde',    ordem: 1 },
    { id: SEED_OPCAO.postado,     grupo: SEED_GRUPO.concluido, nome: 'Postado',              cor: 'verde',    ordem: 2 },
  ],
};

/* ----------------------------- id helper --------------------------------- */

let _seq = 0;
export function novoStatusId(prefixo = 'st'): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch { /* */ }
  return `${prefixo}_${Date.now().toString(36)}_${(_seq++).toString(36)}`;
}

/* ----------------------------- normalização ------------------------------ */

function corValida(c: unknown): CorStatus {
  return (typeof c === 'string' && c in CORES_STATUS ? c : 'cinza') as CorStatus;
}

function normalizarGrupo(x: Partial<StatusGrupo>, i: number): StatusGrupo {
  return {
    id: x.id || novoStatusId('g'),
    nome: String(x.nome ?? '').trim() || 'Grupo',
    cor: corValida(x.cor),
    ordem: Number.isFinite(x.ordem) ? Number(x.ordem) : i,
  };
}

function normalizarOpcao(x: Partial<StatusOpcao>, i: number, grupoFallback: string): StatusOpcao {
  return {
    id: x.id || novoStatusId('op'),
    grupo: x.grupo || grupoFallback,
    nome: String(x.nome ?? '').trim() || 'Status',
    cor: corValida(x.cor),
    ordem: Number.isFinite(x.ordem) ? Number(x.ordem) : i,
  };
}

function normalizar(cfg: Partial<StatusGlobalConfig> | null | undefined): StatusGlobalConfig {
  const grupos = Array.isArray(cfg?.grupos) && cfg!.grupos.length
    ? cfg!.grupos.map(normalizarGrupo)
    : DEFAULT_STATUS_GLOBAL.grupos.map((g) => ({ ...g }));
  const fallback = grupos[0]?.id ?? SEED_GRUPO.aFazer;
  const idsGrupo = new Set(grupos.map((g) => g.id));
  const opcoes = (Array.isArray(cfg?.opcoes) && cfg!.opcoes.length
    ? cfg!.opcoes.map((o, i) => normalizarOpcao(o, i, fallback))
    : DEFAULT_STATUS_GLOBAL.opcoes.map((o) => ({ ...o })))
    // opção órfã (grupo removido) cai no 1º grupo
    .map((o) => (idsGrupo.has(o.grupo) ? o : { ...o, grupo: fallback }));
  return {
    versao: Number.isFinite(cfg?.versao) ? Number(cfg!.versao) : DEFAULT_STATUS_GLOBAL.versao,
    grupos,
    opcoes,
  };
}

/* ----------------------------- cache + store ----------------------------- */

const KEY = 'wenox-status-global-v1';

function lerCache(): StatusGlobalConfig {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return normalizar(JSON.parse(s));
  } catch { /* */ }
  return normalizar(null);
}

let _cfg: StatusGlobalConfig = lerCache();
const listeners = new Set<() => void>();

function setConfig(cfg: Partial<StatusGlobalConfig>): void {
  _cfg = normalizar(cfg);
  try { localStorage.setItem(KEY, JSON.stringify(_cfg)); } catch { /* */ }
  listeners.forEach((l) => l());
}

export function subscribeStatus(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
export function getStatusGlobalSnapshot(): StatusGlobalConfig {
  return _cfg;
}

/* ----------------------- acessores (núcleo novo) ------------------------- */

export function getStatusGlobal(): StatusGlobalConfig {
  return _cfg;
}
export function getGrupos(): StatusGrupo[] {
  return [..._cfg.grupos].sort((a, b) => a.ordem - b.ordem);
}
export function getOpcoes(): StatusOpcao[] {
  return [..._cfg.opcoes].sort((a, b) => a.ordem - b.ordem);
}
/** Opções de um grupo, ordenadas. */
export function opcoesDoGrupo(grupoId: string): StatusOpcao[] {
  return _cfg.opcoes.filter((o) => o.grupo === grupoId).sort((a, b) => a.ordem - b.ordem);
}
export function opcaoPorId(id?: string): StatusOpcao | undefined {
  return id ? _cfg.opcoes.find((o) => o.id === id) : undefined;
}
export function grupoPorId(id?: string): StatusGrupo | undefined {
  return id ? _cfg.grupos.find((g) => g.id === id) : undefined;
}
/** Grupo dono de uma opção. */
export function grupoDaOpcao(opcaoId?: string): StatusGrupo | undefined {
  const op = opcaoPorId(opcaoId);
  return op ? grupoPorId(op.grupo) : undefined;
}
/** Classes de cor da opção (cai no grupo, depois cinza). */
export function corOpcaoClass(opcaoId?: string): string {
  const op = opcaoPorId(opcaoId);
  if (op) return CORES_STATUS[op.cor] ?? CORES_STATUS.cinza;
  const g = grupoDaOpcao(opcaoId);
  return g ? (CORES_STATUS[g.cor] ?? CORES_STATUS.cinza) : '';
}
/** Opções em ordem de kanban: por grupo (ordem) e dentro do grupo (ordem). */
export function opcoesEmOrdemDeColuna(): StatusOpcao[] {
  return getGrupos().flatMap((g) => opcoesDoGrupo(g.id));
}

/** Opção "inicial" (manual): primeira opção na ordem de coluna. */
export function opcaoInicial(): StatusOpcao | undefined {
  return opcoesEmOrdemDeColuna()[0];
}
/** Opção "de conclusão" (manual): 1ª opção do ÚLTIMO grupo (categoria "feito"). */
export function opcaoConcluido(): StatusOpcao | undefined {
  const grupos = getGrupos();
  const ultimo = grupos[grupos.length - 1];
  return ultimo ? opcoesDoGrupo(ultimo.id)[0] : undefined;
}
/** Uma opção é "conclusiva" quando pertence ao último grupo (categoria "feito"). */
export function opcaoEhConclusiva(opcaoId?: string): boolean {
  const op = opcaoPorId(opcaoId);
  if (!op) return false;
  const grupos = getGrupos();
  return grupos.length > 0 && op.grupo === grupos[grupos.length - 1].id;
}
/** Acha o id de opção pelo NOME (case-insensitive) — usado no fallback pré-backfill. */
export function opcaoIdPorNome(nome?: string): string | undefined {
  if (!nome) return undefined;
  const alvo = nome.trim().toLowerCase();
  return _cfg.opcoes.find((o) => o.nome.trim().toLowerCase() === alvo)?.id;
}
/** Resolve a opção de uma TAREFA para exibição.
 *  Janela de transição (até o cutover): o n8n (aprovação do cliente por WhatsApp)
 *  escreve só `status` (nome, legado), que é o sinal mais fresco quando toca a
 *  tarefa. Por isso o nome conhecido tem precedência sobre um `status_opcao`
 *  possivelmente defasado; sem nome resolvível, usa `status_opcao`.
 *  (O drag do kanban grava os dois campos em sincronia — ver TarefasListPage.) */
export function resolverOpcao(opcaoId?: string, nomeLegado?: string): StatusOpcao | undefined {
  return opcaoPorId(opcaoIdPorNome(nomeLegado)) ?? opcaoPorId(opcaoId);
}
/** Campos a gravar ao escolher uma opção: o id + o espelho legado `status` (nome). */
export function espelhoStatus(opcaoId: string): { status_opcao: string; status: string } {
  return { status_opcao: opcaoId, status: opcaoPorId(opcaoId)?.nome ?? '' };
}

/**
 * Tarefa "minha": o usuário está nos responsáveis da tarefa.
 * Por padrão ignora arquivadas.
 */
export function tarefaEhDoUsuario(
  t: { responsaveis?: string[]; arquivada?: boolean },
  userId?: string,
  opts?: { incluirArquivadas?: boolean },
): boolean {
  if (!userId) return false;
  if (!opts?.incluirArquivadas && t.arquivada) return false;
  return (t.responsaveis ?? []).includes(userId);
}

/* ---------------------- espelho de POSTS (status_post) -------------------- */
/* Mapa entre as opções de post do seed e o valor legado `status_post` lido
 * pelo backend Python. Usa ids estáveis do seed (não muda em rename). F3/F4. */

const OPCAO_PARA_STATUS_POST: Record<string, string> = {
  [SEED_OPCAO.emProducao]:  'em_producao',
  [SEED_OPCAO.agendar]:     'agendar',
  [SEED_OPCAO.agendado]:    'agendado',
  [SEED_OPCAO.postado]:     'postado',
  [SEED_OPCAO.emAlteracao]: 'em_alteracao',
};
const STATUS_POST_PARA_OPCAO: Record<string, string> = {
  em_producao:  SEED_OPCAO.emProducao,
  agendar:      SEED_OPCAO.agendar,
  agendado:     SEED_OPCAO.agendado,
  postado:      SEED_OPCAO.postado,
  em_alteracao: SEED_OPCAO.emAlteracao,
};

/** Valor legado `status_post` equivalente a uma opção ('' se não for opção de post). */
export function statusPostDaOpcao(opcaoId?: string): string {
  return (opcaoId && OPCAO_PARA_STATUS_POST[opcaoId]) || '';
}
/** Id de opção equivalente a um `status_post` legado (fallback pré-F3). */
export function opcaoIdDoStatusPost(statusPost?: string): string | undefined {
  return statusPost ? STATUS_POST_PARA_OPCAO[statusPost] : undefined;
}
/** Resolve a opção de um CARD para EXIBIÇÃO.
 *  Janela de transição (F3→cutover): o n8n/esteira escrevem só `status_post`
 *  (legado), que é o sinal mais fresco para o card que eles tocam. Por isso,
 *  quando `status_post` é um valor de post conhecido, ele tem precedência sobre
 *  um `status_opcao` possivelmente defasado. Sem legado conhecido (vazio ou
 *  opção customizada sem espelho), usa `status_opcao` (escolha manual). */
export function resolverOpcaoCard(opcaoId?: string, statusPost?: string): StatusOpcao | undefined {
  return opcaoPorId(opcaoIdDoStatusPost(statusPost)) ?? opcaoPorId(opcaoId);
}
/** Campos a gravar num CARD ao escolher uma opção: id + espelho `status_post`. */
export function espelhoStatusCard(opcaoId: string): { status_opcao: string; status_post: string } {
  return { status_opcao: opcaoId, status_post: statusPostDaOpcao(opcaoId) };
}

/* --------------------------- React hooks (novo) -------------------------- */

export function useStatusGlobal(): StatusGlobalConfig {
  return useSyncExternalStore(subscribeStatus, getStatusGlobalSnapshot, getStatusGlobalSnapshot);
}

/* ========================================================================== */
/*  SHIMS LEGADOS — mapeiam o modelo antigo (lista plana de StatusDef +       */
/*  papéis) sobre as opções. Removidos em F4 quando todos migrarem.           */
/* ========================================================================== */

/** @deprecated Papel automático do motor de etapas — sai em F4. */
export type PapelStatus =
  | '' | 'inicial' | 'em_andamento' | 'aguardando_aprovacao' | 'em_alteracao' | 'concluido';

/** @deprecated Modelo plano antigo. `useStatuses()` devolve opções nesta forma. */
export interface StatusDef {
  id: string;
  nome: string;
  papel: PapelStatus;
  cor: CorStatus;
}

/** Papel legado → id de opção do seed (para os shims). */
const PAPEL_OPCAO_ID: Record<Exclude<PapelStatus, ''>, string> = {
  inicial:              SEED_OPCAO.naoIniciado,
  em_andamento:         SEED_OPCAO.emAndamento,
  aguardando_aprovacao: SEED_OPCAO.aguardando,
  em_alteracao:         SEED_OPCAO.emAlteracao,
  concluido:            SEED_OPCAO.concluido,
};
/** Nome legado de fallback (caso o seed tenha sido editado/removido). */
const PAPEL_NOME_FALLBACK: Record<Exclude<PapelStatus, ''>, string> = {
  inicial:              'Não iniciado',
  em_andamento:         'Em andamento',
  aguardando_aprovacao: 'Aguardando aprovação',
  em_alteracao:         'Em alteração',
  concluido:            'Concluído',
};

/** @deprecated Lista plana das opções (forma StatusDef). */
export function getStatuses(): StatusDef[] {
  return opcoesEmOrdemDeColuna().map((o) => ({
    id: o.id, nome: o.nome, papel: '' as PapelStatus, cor: o.cor,
  }));
}
/** @deprecated */
export function statusNomes(): string[] {
  return opcoesEmOrdemDeColuna().map((o) => o.nome);
}
/** @deprecated Nome do status de um papel legado. */
export function statusDoPapel(papel: PapelStatus): string | undefined {
  if (!papel) return undefined;
  return opcaoPorId(PAPEL_OPCAO_ID[papel])?.nome ?? PAPEL_NOME_FALLBACK[papel];
}
/** @deprecated Nome do status inicial. */
export function statusInicial(): string {
  return opcaoPorId(SEED_OPCAO.naoIniciado)?.nome ?? opcoesEmOrdemDeColuna()[0]?.nome ?? 'Não iniciado';
}
/** @deprecated Nome do status de conclusão. */
export function statusConcluido(): string {
  return opcaoPorId(SEED_OPCAO.concluido)?.nome ?? 'Concluído';
}
/** @deprecated Classes de cor pelo NOME do status ('' se desconhecido). */
export function corStatusClass(nome?: string): string {
  const op = _cfg.opcoes.find((o) => o.nome === nome);
  if (!op) return '';
  return CORES_STATUS[op.cor] ?? CORES_STATUS.cinza;
}
/** @deprecated Hook que devolve as opções na forma StatusDef. */
export function useStatuses(): StatusDef[] {
  useStatusGlobal();
  return getStatuses();
}

/* --------------------------- persistência (PB) --------------------------- */

const CHAVE = 'status_global';
interface RegistroConfig { id: string; valor?: Partial<StatusGlobalConfig> }

/** Lê a config do servidor; atualiza o cache. Cai no cache/padrão se falhar. */
export async function carregarStatusRemoto(): Promise<StatusGlobalConfig> {
  const { pb } = await import('@/lib/pocketbase');
  try {
    const rec = (await pb
      .collection('configuracoes')
      .getFirstListItem(`chave="${CHAVE}"`)) as unknown as RegistroConfig;
    if (rec?.valor && typeof rec.valor === 'object') {
      setConfig(rec.valor);
    }
  } catch { /* sem registro / offline → mantém cache */ }
  return _cfg;
}

/** Grava a config no servidor (cria o registro se não existir) + atualiza cache. */
export async function salvarStatusRemoto(cfg: StatusGlobalConfig): Promise<void> {
  const { pb } = await import('@/lib/pocketbase');
  setConfig(cfg); // cache + notify imediato
  const col = pb.collection('configuracoes');
  const existente = (await col
    .getFirstListItem(`chave="${CHAVE}"`)
    .catch(() => null)) as unknown as RegistroConfig | null;
  if (existente) await col.update(existente.id, { valor: _cfg });
  else await col.create({ chave: CHAVE, valor: _cfg });
}

function escapar(v: string): string {
  return v.replace(/"/g, '\\"');
}

/** Quantas tarefas ainda usam esta opção (bloqueia remoção em uso).
 *  Opera por `status_opcao` (id), a fonte de verdade do modelo novo. */
export async function contarTarefasComOpcao(opcaoId: string): Promise<number> {
  const { pb } = await import('@/lib/pocketbase');
  const res = await pb
    .collection('tarefas')
    .getList(1, 1, { filter: `status_opcao="${escapar(opcaoId)}"`, fields: 'id' });
  return res.totalItems;
}

/** Quantos cards ainda usam esta opção (bloqueia remoção em uso). */
export async function contarCardsComOpcao(opcaoId: string): Promise<number> {
  const { pb } = await import('@/lib/pocketbase');
  const res = await pb
    .collection('cartoes')
    .getList(1, 1, { filter: `status_opcao="${escapar(opcaoId)}"`, fields: 'id' });
  return res.totalItems;
}
