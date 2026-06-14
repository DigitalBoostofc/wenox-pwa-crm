import { pb } from '@/lib/pocketbase';
import type { Quadro, Lista, Cartao } from './types';

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

/** Listas (colunas) de um quadro, na ordem do Trello. */
export async function listListas(quadroId: string): Promise<Lista[]> {
  const res = await lcol().getFullList({
    filter: `quadro = "${quadroId}" && fechada = false`,
    sort: 'ordem',
  });
  return res as unknown as Lista[];
}

/** Todos os cartões de um quadro (agrupar por lista no cliente). */
export async function listCartoes(quadroId: string): Promise<Cartao[]> {
  const res = await ccol().getFullList({
    filter: `quadro = "${quadroId}"`,
    sort: 'ordem',
    batch: 1000,
  });
  return res as unknown as Cartao[];
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
