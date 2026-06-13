import { useSyncExternalStore } from 'react';
import type { TipoEtapa } from './types';

/* -------------------------------------------------------------------------- */
/*  Modelos de etapas por tipo de tarefa (configuráveis)                       */
/*  Guardados na coleção `configuracoes` (chave="etapas_tarefa_tipo"),         */
/*  legível por todos e gravável por gestores. Cache local p/ render imediato. */
/* -------------------------------------------------------------------------- */

/** Uma etapa-modelo: pré-preenche texto + tipo + responsável ao inserir. */
export interface PresetEtapa {
  id: string;
  texto: string;
  tipo: TipoEtapa;
  responsavel?: string; // id do usuário (ignorado em aprovacao_cliente)
}

/** Mapa: nome do tipo de tarefa (tipo_projeto) → lista de etapas-modelo. */
export type PresetsPorTipo = Record<string, PresetEtapa[]>;

let _seq = 0;
export function novoPresetId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch { /* */ }
  return `pe_${Date.now().toString(36)}_${(_seq++).toString(36)}`;
}

function normalizarPreset(x: Partial<PresetEtapa>): PresetEtapa {
  const tipo: TipoEtapa = x.tipo === 'aprovacao_cliente' ? 'aprovacao_cliente' : 'interna';
  return {
    id: x.id || novoPresetId(),
    texto: String(x.texto ?? '').trim(),
    tipo,
    responsavel: tipo === 'interna' ? (x.responsavel || undefined) : undefined,
  };
}
function normalizarMapa(m: unknown): PresetsPorTipo {
  const out: PresetsPorTipo = {};
  if (m && typeof m === 'object') {
    for (const [tipo, lista] of Object.entries(m as Record<string, unknown>)) {
      if (Array.isArray(lista)) out[tipo] = lista.map((p) => normalizarPreset(p as Partial<PresetEtapa>));
    }
  }
  return out;
}

/* ----------------------------- cache + store ----------------------------- */

const KEY = 'wenox-etapas-preset-v1';

function lerCache(): PresetsPorTipo {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return normalizarMapa(JSON.parse(s));
  } catch { /* */ }
  return {};
}

let _mapa: PresetsPorTipo = lerCache();
const listeners = new Set<() => void>();

function setMapa(m: PresetsPorTipo): void {
  _mapa = normalizarMapa(m);
  try { localStorage.setItem(KEY, JSON.stringify(_mapa)); } catch { /* */ }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function snapshot(): PresetsPorTipo { return _mapa; }

export function getPresets(): PresetsPorTipo { return _mapa; }
export function presetsDoTipo(tipo?: string): PresetEtapa[] {
  if (!tipo) return [];
  return _mapa[tipo] ?? [];
}

export function usePresetsEtapa(): PresetsPorTipo {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/* --------------------------- persistência (PB) --------------------------- */

const CHAVE = 'etapas_tarefa_tipo';
interface RegistroConfig { id: string; valor?: PresetsPorTipo }

export async function carregarPresetsRemoto(): Promise<PresetsPorTipo> {
  const { pb } = await import('@/lib/pocketbase');
  try {
    const rec = (await pb
      .collection('configuracoes')
      .getFirstListItem(`chave="${CHAVE}"`)) as unknown as RegistroConfig;
    if (rec?.valor && typeof rec.valor === 'object') {
      setMapa(rec.valor);
    }
  } catch { /* sem registro / offline → mantém cache */ }
  return _mapa;
}

export async function salvarPresetsRemoto(m: PresetsPorTipo): Promise<void> {
  const { pb } = await import('@/lib/pocketbase');
  setMapa(m); // cache + notify imediato
  const col = pb.collection('configuracoes');
  const existente = (await col
    .getFirstListItem(`chave="${CHAVE}"`)
    .catch(() => null)) as unknown as RegistroConfig | null;
  if (existente) await col.update(existente.id, { valor: _mapa });
  else await col.create({ chave: CHAVE, valor: _mapa });
}
