import { pb } from '@/lib/pocketbase';
import { registrarHistorico, diffCampos } from '@/atividade/atividadeService';
import type { Cliente, ClienteInput } from './types';

const col = () => pb.collection('clientes');

/** Só as colunas que a lista usa — evita trafegar observação/HTML pesado.
 *  collectionId/collectionName/logo são necessários p/ montar a URL da foto. */
const CAMPOS_LISTA = [
  'id', 'collectionId', 'collectionName', 'nome_fantasia', 'categoria',
  'telefone', 'email', 'origem', 'servicos', 'status', 'created', 'logo',
].join(',');

export async function listClientes(busca: string): Promise<Cliente[]> {
  const opts: Record<string, unknown> = { sort: '-created', fields: CAMPOS_LISTA };
  const q = busca.trim();
  if (q) {
    const safe = q.replace(/"/g, '');
    opts.filter = `nome_fantasia ~ "${safe}" || razao_social ~ "${safe}"`;
  }
  const res = await col().getList(1, 200, opts);
  return res.items as unknown as Cliente[];
}

export async function getCliente(id: string): Promise<Cliente> {
  return (await col().getOne(id)) as unknown as Cliente;
}

/** URL pública da foto/logo do cliente ('' se não tiver).
 *  `thumb` (ex: '100x100') pede uma miniatura ao PocketBase — muito mais
 *  leve que a imagem original (essencial p/ listas com muitos clientes). */
export function logoUrl(
  c: Pick<Cliente, 'id' | 'logo'>,
  thumb?: string,
): string {
  if (!c?.logo) return '';
  return pb.files.getURL(
    c as unknown as Record<string, unknown>,
    c.logo,
    thumb ? { thumb } : undefined,
  );
}

/** `logo` é campo de arquivo no PocketBase: nunca enviar como texto/JSON
 *  (mandar o nome do arquivo como string faz o update falhar). */
function semLogo(dados: Record<string, unknown>): Record<string, unknown> {
  const { logo: _omit, ...resto } = dados;
  void _omit;
  return resto;
}

function comArquivo(
  dados: Record<string, unknown>,
  logo: File,
): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(semLogo(dados))) {
    if (v === undefined || v === null) continue;
    fd.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
  }
  fd.append('logo', logo);
  return fd;
}

export async function createCliente(
  input: ClienteInput,
  logo?: File | null,
): Promise<Cliente> {
  const uid = pb.authStore?.record?.id;
  const dados = { ...input, ...(uid ? { created_by: uid, updated_by: uid } : {}) };
  const rec = (await col().create(
    logo ? comArquivo(dados, logo) : semLogo(dados),
  )) as unknown as Cliente;
  await registrarHistorico('cliente', rec.id, 'Cliente cadastrado');
  return rec;
}

export async function updateCliente(
  id: string,
  input: Partial<ClienteInput>,
  logo?: File | null,
): Promise<Cliente> {
  const uid = pb.authStore?.record?.id;
  let antes: Record<string, unknown> | undefined;
  try {
    antes = (await col().getOne(id)) as unknown as Record<string, unknown>;
  } catch {
    /* sem 'antes' não há diff */
  }
  const dados = { ...input, ...(uid ? { updated_by: uid } : {}) };
  const rec = (await col().update(
    id,
    logo ? comArquivo(dados, logo) : semLogo(dados),
  )) as unknown as Cliente;
  const mudancas = diffCampos(antes, input as Record<string, unknown>);
  if (logo) mudancas.push('foto atualizada');
  if (mudancas.length) {
    await registrarHistorico(
      'cliente',
      id,
      `Alterou ${mudancas.join(' · ')}`,
    );
  }
  return rec;
}

export async function deleteCliente(id: string): Promise<void> {
  await col().delete(id);
}
