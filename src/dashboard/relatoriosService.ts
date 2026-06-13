import { pb } from '@/lib/pocketbase';
import { tarefaConcluida, prazoVencido } from '@/tarefas/format';
import type { Tarefa } from '@/tarefas/types';
import type { Usuario } from '@/usuarios/types';

/* ── Tipos ────────────────────────────────────────────────────────────────── */

export interface MesRef { ano: number; mes: number }

export interface DesempenhoMembro {
  id: string; nome: string;
  concluidas: number; noPrazo: number; atrasadas: number; semPrazo: number;
  abertasAgora: number; atrasadasAgora: number;
  taxaNoPrazo: number;
}

export interface PontoMensal {
  ano: number; mes: number; rotulo: string;
  concluidas: number; noPrazo: number; atrasadas: number;
}

export interface DesempenhoAgencia {
  totalConcluidas: number; totalNoPrazo: number; totalAtrasadas: number; totalSemPrazo: number;
  taxaNoPrazo: number; abertasAgora: number; atrasadasAgora: number;
  porMes: PontoMensal[];
  membros: DesempenhoMembro[];
}

export interface ConclusaoEvento { refId: string; autor?: string; data: string }

/* ── Helpers ──────────────────────────────────────────────────────────────── */

// Parsing date-only por partes, sem desvio de fuso (mesmo padrão de parsePrazo)
function parseData(iso?: string): Date | null {
  if (!iso) return null;
  const partes = iso.slice(0, 10).split('-').map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return null;
  return new Date(partes[0], partes[1] - 1, partes[2]);
}

function mesKey(m: MesRef): string { return `${m.ano}-${m.mes}`; }

const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function rotuloMes(m: MesRef): string {
  return `${MESES_PT[m.mes - 1]}/${String(m.ano).slice(-2)}`;
}

export function mesesRecentes(qtd: number): MesRef[] {
  const hoje = new Date();
  const resultado: MesRef[] = [];
  for (let i = qtd - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    resultado.push({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  return resultado;
}

/* ── Busca de conclusões ──────────────────────────────────────────────────── */

export async function listConclusoesTarefas(desdeISO: string): Promise<ConclusaoEvento[]> {
  try {
    const res = await pb.collection('historico').getFullList({
      filter: `entidade = "tarefa" && created >= "${desdeISO}" && (acao ~ "Concluiu" || acao ~ "Concluído")`,
      fields: 'ref_id,autor,created',
      sort: '-created',
    });
    return res.map((r) => ({
      refId: (r as unknown as { ref_id: string }).ref_id,
      autor: (r as unknown as { autor?: string }).autor,
      data: r.created,
    }));
  } catch {
    return [];
  }
}

/* ── Cálculo puro ─────────────────────────────────────────────────────────── */

export function calcularDesempenho(p: {
  meses: MesRef[];
  tarefas: Tarefa[];
  usuarios: Usuario[];
  conclusoes: ConclusaoEvento[];
}): DesempenhoAgencia {
  const { meses, tarefas, usuarios, conclusoes } = p;
  const mesesSet = new Set(meses.map(mesKey));

  // Mapa de tarefas por id
  const tarefaMap = new Map(tarefas.map((t) => [t.id, t]));

  // Para cada refId, evento mais recente (array já vem -created)
  const conclusaoPorRef = new Map<string, ConclusaoEvento>();
  for (const ev of conclusoes) {
    if (!conclusaoPorRef.has(ev.refId)) conclusaoPorRef.set(ev.refId, ev);
  }

  // Classificação por tarefa concluída
  type Classif = 'noPrazo' | 'atrasada' | 'semPrazo';
  interface TarefaConc { tarefa: Tarefa; classif: Classif; mesKey: string }
  const concluidasArr: TarefaConc[] = [];

  for (const [refId, ev] of conclusaoPorRef) {
    const dataConcl = parseData(ev.data);
    if (!dataConcl) continue;
    const mk = mesKey({ ano: dataConcl.getFullYear(), mes: dataConcl.getMonth() + 1 });
    if (!mesesSet.has(mk)) continue;
    const tarefa = tarefaMap.get(refId);
    if (!tarefa) continue;

    let classif: Classif;
    const prazoDt = parseData(tarefa.prazo);
    if (!prazoDt) {
      classif = 'semPrazo';
    } else if (dataConcl.getTime() <= prazoDt.getTime()) {
      classif = 'noPrazo';
    } else {
      classif = 'atrasada';
    }
    concluidasArr.push({ tarefa, classif, mesKey: mk });
  }

  // Totais agência (cada tarefa UMA vez)
  let totalConcluidas = 0, totalNoPrazo = 0, totalAtrasadas = 0, totalSemPrazo = 0;
  for (const c of concluidasArr) {
    totalConcluidas++;
    if (c.classif === 'noPrazo') totalNoPrazo++;
    else if (c.classif === 'atrasada') totalAtrasadas++;
    else totalSemPrazo++;
  }

  // porMes
  const mesMap = new Map<string, PontoMensal>();
  for (const m of meses) {
    mesMap.set(mesKey(m), { ano: m.ano, mes: m.mes, rotulo: rotuloMes(m), concluidas: 0, noPrazo: 0, atrasadas: 0 });
  }
  for (const c of concluidasArr) {
    const pm = mesMap.get(c.mesKey)!;
    pm.concluidas++;
    if (c.classif === 'noPrazo') pm.noPrazo++;
    else if (c.classif === 'atrasada') pm.atrasadas++;
  }
  const porMes = meses.map((m) => mesMap.get(mesKey(m))!);

  // Membros ativos não-Cliente
  const membrosAtivos = usuarios.filter((u) => u.role !== 'Cliente' && u.status === 'Ativo');
  const userMap = new Map(membrosAtivos.map((u) => [u.id, u]));

  // Contagem por membro (das concluídas)
  interface MembroAcc { concluidas: number; noPrazo: number; atrasadas: number; semPrazo: number; abertasAgora: number; atrasadasAgora: number }
  const membroAcc = new Map<string, MembroAcc>();
  const initAcc = (): MembroAcc => ({ concluidas: 0, noPrazo: 0, atrasadas: 0, semPrazo: 0, abertasAgora: 0, atrasadasAgora: 0 });

  for (const c of concluidasArr) {
    if (c.tarefa.lado === 'cliente') continue;
    const resps = c.tarefa.responsaveis ?? [];
    if (!resps.length) continue;
    for (const uid of resps) {
      if (!userMap.has(uid)) continue;
      const acc = membroAcc.get(uid) ?? initAcc();
      acc.concluidas++;
      if (c.classif === 'noPrazo') acc.noPrazo++;
      else if (c.classif === 'atrasada') acc.atrasadas++;
      else acc.semPrazo++;
      membroAcc.set(uid, acc);
    }
  }

  // abertasAgora / atrasadasAgora (tarefas NÃO concluídas)
  let agAbertasAgora = 0, agAtrasadasAgora = 0;
  for (const t of tarefas) {
    if (tarefaConcluida(t.status)) continue;
    agAbertasAgora++;
    const vencida = prazoVencido(t.prazo, t.status);
    if (vencida) agAtrasadasAgora++;

    if (t.lado === 'cliente') continue;
    const resps = t.responsaveis ?? [];
    for (const uid of resps) {
      if (!userMap.has(uid)) continue;
      const acc = membroAcc.get(uid) ?? initAcc();
      acc.abertasAgora++;
      if (vencida) acc.atrasadasAgora++;
      membroAcc.set(uid, acc);
    }
  }

  const taxaNoPrazoAg = (totalNoPrazo + totalAtrasadas) > 0
    ? Math.round(totalNoPrazo / (totalNoPrazo + totalAtrasadas) * 100)
    : 0;

  const membros: DesempenhoMembro[] = [];
  for (const u of membrosAtivos) {
    const acc = membroAcc.get(u.id);
    if (!acc) continue;
    const taxaNoPrazo = (acc.noPrazo + acc.atrasadas) > 0
      ? Math.round(acc.noPrazo / (acc.noPrazo + acc.atrasadas) * 100)
      : 0;
    membros.push({
      id: u.id,
      nome: u.nome || u.email || u.id,
      concluidas: acc.concluidas,
      noPrazo: acc.noPrazo,
      atrasadas: acc.atrasadas,
      semPrazo: acc.semPrazo,
      abertasAgora: acc.abertasAgora,
      atrasadasAgora: acc.atrasadasAgora,
      taxaNoPrazo,
    });
  }

  membros.sort((a, b) => b.concluidas - a.concluidas || b.taxaNoPrazo - a.taxaNoPrazo);

  return {
    totalConcluidas, totalNoPrazo, totalAtrasadas, totalSemPrazo,
    taxaNoPrazo: taxaNoPrazoAg,
    abertasAgora: agAbertasAgora, atrasadasAgora: agAtrasadasAgora,
    porMes, membros,
  };
}

/* ── Loader de conveniência ───────────────────────────────────────────────── */

export async function carregarDesempenho(
  meses: MesRef[],
  tarefas: Tarefa[],
  usuarios: Usuario[],
): Promise<DesempenhoAgencia> {
  if (meses.length === 0) {
    return calcularDesempenho({ meses, tarefas, usuarios, conclusoes: [] });
  }
  const maisAntigo = [...meses].sort((a, b) => a.ano - b.ano || a.mes - b.mes)[0];
  const desdeISO = `${maisAntigo.ano}-${String(maisAntigo.mes).padStart(2, '0')}-01 00:00:00`;
  const conclusoes = await listConclusoesTarefas(desdeISO);
  return calcularDesempenho({ meses, tarefas, usuarios, conclusoes });
}
