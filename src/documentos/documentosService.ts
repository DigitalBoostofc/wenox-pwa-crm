import { pb } from '@/lib/pocketbase';
import { registrarHistorico } from '@/atividade/atividadeService';
import type { Documento, DocumentoInput } from './types';

const col = () => pb.collection('documentos');

export async function listDocumentos(clienteId: string): Promise<Documento[]> {
  const res = await col().getFullList({
    filter: `cliente = "${clienteId}"`,
    sort: '-created',
  });
  return res as unknown as Documento[];
}

/** URL pública do arquivo anexado (ou '' se for link). */
export function urlArquivo(d: Documento): string {
  if (d.tipo !== 'arquivo' || !d.arquivo) return '';
  return pb.files.getURL(d as unknown as Record<string, unknown>, d.arquivo);
}

/** É um arquivo de imagem? (preview no próprio sistema) */
export function isImagem(d: Documento): boolean {
  if (d.tipo !== 'arquivo' || !d.arquivo) return false;
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(d.arquivo);
}

/** Endereço para abrir: o link informado ou o arquivo anexado. */
export function abrir(d: Documento): string {
  if (d.tipo === 'link') {
    const u = d.url ?? '';
    return u.startsWith('http') ? u : `https://${u}`;
  }
  return urlArquivo(d);
}

export async function createDocumento(
  input: DocumentoInput,
  arquivo?: File | null,
): Promise<Documento> {
  const uid = pb.authStore?.record?.id;
  let rec: Documento;
  if (input.tipo === 'arquivo' && arquivo) {
    const fd = new FormData();
    fd.append('cliente', input.cliente);
    fd.append('nome', input.nome);
    fd.append('categoria', input.categoria ?? '');
    fd.append('tipo', 'arquivo');
    fd.append('observacoes', input.observacoes ?? '');
    fd.append('arquivo', arquivo);
    if (uid) {
      fd.append('created_by', uid);
      fd.append('updated_by', uid);
    }
    rec = (await col().create(fd)) as unknown as Documento;
  } else {
    rec = (await col().create({
      ...input,
      ...(uid ? { created_by: uid, updated_by: uid } : {}),
    })) as unknown as Documento;
  }
  await registrarHistorico(
    'documento',
    rec.id,
    `Documento "${rec.nome}" adicionado`,
  );
  return rec;
}

export async function removeDocumento(d: Documento): Promise<void> {
  await col().delete(d.id);
  await registrarHistorico(
    'documento',
    d.id,
    `Documento "${d.nome}" removido`,
  );
}
