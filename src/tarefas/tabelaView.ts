/**
 * Lógica pura da tabela de tarefas (Sprint 2 — estilo Notion):
 * filtros compostos, ordenação multinível, agrupamento e persistência de
 * "visões salvas". Sem React — só tipos, avaliadores e (de)serialização.
 * Importa apenas de ./types, ./status e ./format para evitar ciclo com o
 * componente TarefasTabela.
 */
import type { Tarefa } from './types';
import { resolverOpcao, opcoesEmOrdemDeColuna } from './status';
import { prazoLimite, tarefaConcluida } from './format';

/* ------------------------------- Prazo / prioridade ----------------------- */

export type CatPrazo = '' | 'vencida' | 'hoje' | 'amanha' | 'futuro';

export function catPrazoData(prazo?: string, feito?: boolean): CatPrazo {
  if (!prazo) return '';
  const lim = prazoLimite(prazo);
  if (!lim) return '';
  if (!feito && lim.getTime() < Date.now()) return 'vencida';
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const d = new Date(lim); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - hoje.getTime()) / 86400000);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanha';
  return 'futuro';
}
export function corPrazo(cat: CatPrazo): string {
  if (cat === 'vencida') return 'font-medium text-destructive';
  if (cat === 'hoje') return 'font-medium text-yellow-500';
  if (cat === 'amanha') return 'font-medium text-orange-500';
  return 'text-muted-foreground';
}
export function pesoPrioridade(p?: string) { return p === 'alta' ? 0 : p === 'baixa' ? 2 : 1; }
export function rotuloPrioridade(p?: string) { return p === 'alta' ? 'Alta' : p === 'baixa' ? 'Baixa' : 'Média'; }

export function nomeClienteDe(t: Tarefa) {
  return t.expand?.cliente?.nome_fantasia ?? t.expand?.cliente?.nome ?? '—';
}

/* --------------------------------- Agrupamento ---------------------------- */

export type GroupBy = 'none' | 'status' | 'cliente' | 'responsavel' | 'prioridade' | 'projeto';
export const GROUPS: { v: GroupBy; label: string }[] = [
  { v: 'none', label: 'Sem agrupar' },
  { v: 'status', label: 'Status' },
  { v: 'cliente', label: 'Cliente' },
  { v: 'responsavel', label: 'Responsável' },
  { v: 'prioridade', label: 'Prioridade' },
  { v: 'projeto', label: 'Projeto' },
];

/* --------------------------------- Filtros -------------------------------- */

export type FiltroCampo = 'status' | 'prioridade' | 'prazo' | 'cliente' | 'responsavel' | 'etiqueta' | 'nome';
export type FiltroOp = 'e' | 'nao' | 'inclui' | 'nao_inclui' | 'tem' | 'contem' | 'cat';

export interface FiltroRegra {
  id: string;
  campo: FiltroCampo;
  op: FiltroOp;
  valor: string;
}

/** Como cada campo se comporta: operadores válidos e tipo do valor. */
export const CAMPOS_FILTRO: Record<FiltroCampo, {
  label: string;
  ops: { v: FiltroOp; label: string }[];
  tipo: 'opcao' | 'prioridade' | 'cat-prazo' | 'cliente' | 'usuario' | 'texto';
}> = {
  status: { label: 'Status', tipo: 'opcao', ops: [{ v: 'e', label: 'é' }, { v: 'nao', label: 'não é' }] },
  prioridade: { label: 'Prioridade', tipo: 'prioridade', ops: [{ v: 'e', label: 'é' }, { v: 'nao', label: 'não é' }] },
  prazo: { label: 'Prazo', tipo: 'cat-prazo', ops: [{ v: 'cat', label: 'é' }] },
  cliente: { label: 'Cliente', tipo: 'cliente', ops: [{ v: 'e', label: 'é' }, { v: 'nao', label: 'não é' }] },
  responsavel: { label: 'Responsável', tipo: 'usuario', ops: [{ v: 'inclui', label: 'inclui' }, { v: 'nao_inclui', label: 'não inclui' }] },
  etiqueta: { label: 'Etiqueta', tipo: 'texto', ops: [{ v: 'tem', label: 'contém' }] },
  nome: { label: 'Nome', tipo: 'texto', ops: [{ v: 'contem', label: 'contém' }] },
};

export const CATS_PRAZO: { v: CatPrazo; label: string }[] = [
  { v: 'vencida', label: 'Vencida' },
  { v: 'hoje', label: 'Hoje' },
  { v: 'amanha', label: 'Amanhã' },
  { v: 'futuro', label: 'Futuro' },
  { v: '', label: 'Sem prazo' },
];

/** Avalia uma única regra contra a tarefa (já mesclada com overrides). */
function passaRegra(t: Tarefa, r: FiltroRegra): boolean {
  switch (r.campo) {
    case 'status': {
      const id = resolverOpcao(t.status_opcao, t.status)?.id ?? '';
      return r.op === 'nao' ? id !== r.valor : id === r.valor;
    }
    case 'prioridade': {
      const p = t.prioridade ?? 'media';
      return r.op === 'nao' ? p !== r.valor : p === r.valor;
    }
    case 'prazo': {
      const cat = catPrazoData(t.prazo, tarefaConcluida(t.status));
      return cat === (r.valor as CatPrazo);
    }
    case 'cliente':
      return r.op === 'nao' ? (t.cliente ?? '') !== r.valor : (t.cliente ?? '') === r.valor;
    case 'responsavel': {
      const tem = (t.responsaveis ?? []).includes(r.valor);
      return r.op === 'nao_inclui' ? !tem : tem;
    }
    case 'etiqueta': {
      const v = r.valor.toLowerCase();
      return (t.etiquetas ?? []).some((e) => e.toLowerCase().includes(v));
    }
    case 'nome':
      return (t.nome ?? '').toLowerCase().includes(r.valor.toLowerCase());
    default:
      return true;
  }
}

/** Aplica todas as regras em AND. Regras sem valor (recém-criadas) são ignoradas. */
export function aplicarFiltros(tarefas: Tarefa[], filtros: FiltroRegra[], mesclar: (t: Tarefa) => Tarefa): Tarefa[] {
  const ativos = filtros.filter((r) => r.campo === 'prazo' ? r.valor !== undefined : r.valor !== '');
  if (!ativos.length) return tarefas;
  return tarefas.filter((t) => { const te = mesclar(t); return ativos.every((r) => passaRegra(te, r)); });
}

/* ------------------------------- Ordenação -------------------------------- */

export type OrdemCampo = 'prazo' | 'prioridade' | 'nome' | 'status' | 'cliente' | 'criado';
export type Dir = 'asc' | 'desc';
export interface OrdemRegra { campo: OrdemCampo; dir: Dir }

export const ORDEM_CAMPOS: { v: OrdemCampo; label: string }[] = [
  { v: 'prazo', label: 'Prazo' },
  { v: 'prioridade', label: 'Prioridade' },
  { v: 'nome', label: 'Nome' },
  { v: 'status', label: 'Status' },
  { v: 'cliente', label: 'Cliente' },
  { v: 'criado', label: 'Criação' },
];

function comparar(a: Tarefa, b: Tarefa, campo: OrdemCampo): number {
  switch (campo) {
    case 'nome': return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' });
    case 'prioridade': return pesoPrioridade(a.prioridade) - pesoPrioridade(b.prioridade);
    case 'cliente': return nomeClienteDe(a).localeCompare(nomeClienteDe(b), 'pt-BR', { sensitivity: 'base' });
    case 'criado': return (a.created ?? '').localeCompare(b.created ?? '');
    case 'status': {
      const ord = opcoesEmOrdemDeColuna();
      const ia = ord.findIndex((o) => o.id === resolverOpcao(a.status_opcao, a.status)?.id);
      const ib = ord.findIndex((o) => o.id === resolverOpcao(b.status_opcao, b.status)?.id);
      return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib);
    }
    case 'prazo':
    default: {
      const pa = prazoLimite(a.prazo)?.getTime() ?? Infinity;
      const pb = prazoLimite(b.prazo)?.getTime() ?? Infinity;
      return pa - pb;
    }
  }
}

/** Sem critérios de ordenação = modo MANUAL: respeita o campo `ordem` (arrasto),
 *  com prazo como desempate. Retrocompatível: itens nunca arrastados têm ordem 0
 *  e caem direto no prazo, igual ao comportamento anterior. */
export function modoManual(ordens: OrdemRegra[]): boolean {
  return ordens.length === 0;
}

/** Ordena por vários critérios em cascata; `mesclar` aplica overrides locais. */
export function aplicarOrdens(tarefas: Tarefa[], ordens: OrdemRegra[], mesclar: (t: Tarefa) => Tarefa): Tarefa[] {
  if (modoManual(ordens)) {
    return [...tarefas].sort((a, b) => {
      const ma = mesclar(a); const mb = mesclar(b);
      const oa = ma.ordem ?? 0; const ob = mb.ordem ?? 0;
      if (oa !== ob) return oa - ob;
      return comparar(ma, mb, 'prazo');
    });
  }
  return [...tarefas].sort((a, b) => {
    const ma = mesclar(a); const mb = mesclar(b);
    for (const r of ordens) {
      const d = comparar(ma, mb, r.campo);
      if (d !== 0) return r.dir === 'desc' ? -d : d;
    }
    return 0;
  });
}

/* --------------------------------- Visões --------------------------------- */

export interface ViewState {
  filtros: FiltroRegra[];
  ordens: OrdemRegra[];
  groupBy: GroupBy;
}
export interface ViewSalva { id: string; nome: string; estado: ViewState }

export function novoId(prefixo = 'v'): string {
  return `${prefixo}${Math.floor(performance.now() * 1000).toString(36)}${Math.floor(performance.now() % 1000).toString(36)}`;
}

const ESTADO_VAZIO: ViewState = { filtros: [], ordens: [], groupBy: 'none' };

/** Carrega o estado de visão ativo, migrando chaves antigas (ordem/group). */
export function carregarViewState(prefix: string): ViewState {
  try {
    const s = localStorage.getItem(`${prefix}-viewstate-v1`);
    if (s) {
      const v = JSON.parse(s) as ViewState;
      return { filtros: v.filtros ?? [], ordens: v.ordens ?? [], groupBy: v.groupBy ?? 'none' };
    }
  } catch { /* */ }
  // Migração das chaves da Sprint 1.
  const estado: ViewState = { ...ESTADO_VAZIO };
  try {
    const o = localStorage.getItem(`${prefix}-ordem-v1`);
    if (o === 'prazo' || o === 'prioridade' || o === 'nome') estado.ordens = [{ campo: o, dir: o === 'prioridade' ? 'asc' : 'asc' }];
    const g = localStorage.getItem(`${prefix}-group-v1`);
    if (GROUPS.some((x) => x.v === g)) estado.groupBy = g as GroupBy;
  } catch { /* */ }
  return estado;
}
export function salvarViewState(prefix: string, v: ViewState) {
  try { localStorage.setItem(`${prefix}-viewstate-v1`, JSON.stringify(v)); } catch { /* */ }
}

export function carregarViews(prefix: string): ViewSalva[] {
  try { const s = localStorage.getItem(`${prefix}-views-v1`); return s ? JSON.parse(s) as ViewSalva[] : []; } catch { return []; }
}
export function salvarViews(prefix: string, views: ViewSalva[]) {
  try { localStorage.setItem(`${prefix}-views-v1`, JSON.stringify(views)); } catch { /* */ }
}
export function carregarViewAtiva(prefix: string): string {
  try { return localStorage.getItem(`${prefix}-viewativa-v1`) ?? ''; } catch { return ''; }
}
export function salvarViewAtiva(prefix: string, id: string) {
  try { localStorage.setItem(`${prefix}-viewativa-v1`, id); } catch { /* */ }
}

/** Igualdade rasa de estado (pra detectar "visão modificada"). */
export function mesmoEstado(a: ViewState, b: ViewState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
