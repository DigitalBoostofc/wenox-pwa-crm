import { useSyncExternalStore } from 'react';

/* -------------------------------------------------------------------------- */
/*  Status de tarefas — agora CONFIGURÁVEIS (Configurações › Status)           */
/*  Guardados na coleção `configuracoes` (chave="status_tarefa"), legível por  */
/*  todos os usuários e gravável por gestores. Cache local p/ render imediato. */
/* -------------------------------------------------------------------------- */

/** Papel automático que o motor de etapas usa pra derivar o status.
 *  '' = status manual (sem automação). Cada papel deve ficar em 1 status só. */
export type PapelStatus =
  | '' | 'inicial' | 'em_andamento' | 'aguardando_aprovacao' | 'em_alteracao' | 'concluido';

export type CorStatus = 'cinza' | 'azul' | 'ambar' | 'vermelho' | 'verde' | 'roxo';

export interface StatusDef {
  id: string;
  nome: string;
  papel: PapelStatus;
  cor: CorStatus;
}

export const PAPEIS_STATUS: PapelStatus[] = [
  '', 'inicial', 'em_andamento', 'aguardando_aprovacao', 'em_alteracao', 'concluido',
];

export const ROTULO_PAPEL: Record<PapelStatus, string> = {
  '': 'Manual (sem automação)',
  inicial: 'Inicial — ao criar a tarefa',
  em_andamento: 'Em andamento — 1ª etapa concluída',
  aguardando_aprovacao: 'Aguardando aprovação do cliente',
  em_alteracao: 'Em alteração — cliente pediu revisão',
  concluido: 'Concluído — todas as etapas feitas',
};

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

/** Configuração de fábrica — também é o fallback offline. */
export const DEFAULT_STATUS: StatusDef[] = [
  { id: 'inicial',   nome: 'Não iniciado',         papel: 'inicial',              cor: 'cinza'    },
  { id: 'andamento', nome: 'Em andamento',         papel: 'em_andamento',         cor: 'azul'     },
  { id: 'aprovacao', nome: 'Aguardando aprovação', papel: 'aguardando_aprovacao', cor: 'ambar'    },
  { id: 'alteracao', nome: 'Em alteração',         papel: 'em_alteracao',         cor: 'vermelho' },
  { id: 'concluido', nome: 'Concluído',            papel: 'concluido',            cor: 'verde'    },
];

/* ----------------------------- id helper --------------------------------- */

let _seq = 0;
export function novoStatusId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch { /* */ }
  return `st_${Date.now().toString(36)}_${(_seq++).toString(36)}`;
}

function normalizar(x: Partial<StatusDef>): StatusDef {
  const cor = (x.cor && x.cor in CORES_STATUS ? x.cor : 'cinza') as CorStatus;
  const papel = (PAPEIS_STATUS.includes(x.papel as PapelStatus) ? x.papel : '') as PapelStatus;
  return {
    id: x.id || novoStatusId(),
    nome: String(x.nome ?? '').trim() || 'Status',
    papel,
    cor,
  };
}

/* ----------------------------- cache + store ----------------------------- */

const KEY = 'wenox-status-tarefa-v1';

function lerCache(): StatusDef[] {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length) return arr.map(normalizar);
    }
  } catch { /* */ }
  return DEFAULT_STATUS.map((s) => ({ ...s }));
}

let _statuses: StatusDef[] = lerCache();
const listeners = new Set<() => void>();

function setStatuses(list: StatusDef[]): void {
  _statuses = list.map(normalizar);
  try { localStorage.setItem(KEY, JSON.stringify(_statuses)); } catch { /* */ }
  listeners.forEach((l) => l());
}

export function subscribeStatus(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
export function getStatusesSnapshot(): StatusDef[] {
  return _statuses;
}

/* ----------------------------- acessores --------------------------------- */

export function getStatuses(): StatusDef[] {
  return _statuses;
}
export function statusNomes(): string[] {
  return _statuses.map((s) => s.nome);
}
export function statusDoPapel(papel: PapelStatus): string | undefined {
  if (!papel) return undefined;
  return _statuses.find((s) => s.papel === papel)?.nome;
}
/** Nome do status inicial (papel "inicial", senão o 1º da lista). */
export function statusInicial(): string {
  return statusDoPapel('inicial') ?? _statuses[0]?.nome ?? 'Não iniciado';
}
/** Nome do status de conclusão (papel "concluido"). */
export function statusConcluido(): string {
  return statusDoPapel('concluido') ?? 'Concluído';
}
/** Classes de cor do status pelo nome ('' se desconhecido — caller faz fallback). */
export function corStatusClass(nome?: string): string {
  const def = _statuses.find((s) => s.nome === nome);
  return def ? (CORES_STATUS[def.cor] ?? CORES_STATUS.cinza) : '';
}

/* --------------------------- React hook ---------------------------------- */

export function useStatuses(): StatusDef[] {
  return useSyncExternalStore(subscribeStatus, getStatusesSnapshot, getStatusesSnapshot);
}

/* --------------------------- persistência (PB) --------------------------- */

const CHAVE = 'status_tarefa';
interface RegistroConfig { id: string; valor?: Partial<StatusDef>[] }

/** Lê a config do servidor; atualiza o cache. Cai no cache/padrão se falhar. */
export async function carregarStatusRemoto(): Promise<StatusDef[]> {
  const { pb } = await import('@/lib/pocketbase');
  try {
    const rec = (await pb
      .collection('configuracoes')
      .getFirstListItem(`chave="${CHAVE}"`)) as unknown as RegistroConfig;
    if (rec?.valor && Array.isArray(rec.valor) && rec.valor.length) {
      setStatuses(rec.valor.map(normalizar));
    }
  } catch { /* sem registro / offline → mantém cache */ }
  return _statuses;
}

/** Grava a config no servidor (cria o registro se não existir) + atualiza cache. */
export async function salvarStatusRemoto(list: StatusDef[]): Promise<void> {
  const { pb } = await import('@/lib/pocketbase');
  setStatuses(list); // cache + notify imediato
  const col = pb.collection('configuracoes');
  const existente = (await col
    .getFirstListItem(`chave="${CHAVE}"`)
    .catch(() => null)) as unknown as RegistroConfig | null;
  if (existente) await col.update(existente.id, { valor: _statuses });
  else await col.create({ chave: CHAVE, valor: _statuses });
}

function escapar(v: string): string {
  return v.replace(/"/g, '\\"');
}

/** Quantas tarefas ainda usam este status (bloqueia remoção em uso). */
export async function contarTarefasComStatus(nome: string): Promise<number> {
  const { pb } = await import('@/lib/pocketbase');
  const res = await pb
    .collection('tarefas')
    .getList(1, 1, { filter: `status="${escapar(nome)}"`, fields: 'id' });
  return res.totalItems;
}

/** Migra tarefas de um nome de status p/ outro (usado ao renomear). */
export async function migrarStatusTarefas(de: string, para: string): Promise<number> {
  if (de === para) return 0;
  const { pb } = await import('@/lib/pocketbase');
  const itens = (await pb
    .collection('tarefas')
    .getFullList({ filter: `status="${escapar(de)}"`, fields: 'id' })) as unknown as { id: string }[];
  for (const it of itens) await pb.collection('tarefas').update(it.id, { status: para });
  return itens.length;
}
