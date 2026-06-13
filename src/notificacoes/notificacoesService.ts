import { pb } from '@/lib/pocketbase';

export type TipoNotificacao =
  | 'aprovacao' | 'alteracao' | 'atribuicao' | 'comentario' | 'mencao';

export interface Notificacao {
  id: string;
  destinatario: string;
  tipo?: TipoNotificacao;
  titulo: string;
  mensagem?: string;
  link?: string;
  lida?: boolean;
  autor?: string;
  created?: string;
}

const col = () => pb.collection('notificacoes');

export async function listMinhasNotificacoes(): Promise<Notificacao[]> {
  const uid = pb.authStore?.record?.id;
  if (!uid) return [];
  const r = await col().getList(1, 40, {
    filter: `destinatario = "${uid}"`,
    sort: '-created',
  });
  return r.items as unknown as Notificacao[];
}

export async function contarNaoLidas(): Promise<number> {
  const uid = pb.authStore?.record?.id;
  if (!uid) return 0;
  try {
    const r = await col().getList(1, 1, {
      filter: `destinatario = "${uid}" && lida = false`,
    });
    return r.totalItems;
  } catch {
    return 0;
  }
}

export async function marcarLida(id: string): Promise<void> {
  await col().update(id, { lida: true });
}

export async function marcarTodasLidas(): Promise<void> {
  const uid = pb.authStore?.record?.id;
  if (!uid) return;
  const naoLidas = await col().getFullList({
    filter: `destinatario = "${uid}" && lida = false`,
    fields: 'id',
  });
  await Promise.all(naoLidas.map((n) => col().update(n.id, { lida: true })));
}

interface NotifConteudo {
  tipo: TipoNotificacao;
  titulo: string;
  mensagem?: string;
  link?: string;
}

/** Cria uma notificação por destinatário. Best-effort: nunca lança;
 *  remove duplicados e pula o próprio autor da ação. */
export async function notificar(
  destinatarios: string[],
  n: NotifConteudo,
): Promise<void> {
  const uid = pb.authStore?.record?.id;
  const alvos = [...new Set(destinatarios)].filter((d) => d && d !== uid);
  await Promise.all(
    alvos.map((d) =>
      col()
        .create({ ...n, destinatario: d, autor: uid, lida: false })
        .catch(() => { /* notificação é best-effort */ }),
    ),
  );
}

/** ids dos usuários de gestão (Owner/Admin/Gestor). */
export async function idsGestao(): Promise<string[]> {
  try {
    const r = await pb.collection('usuarios').getFullList({
      filter: 'role = "Owner" || role = "Admin" || role = "Gestor"',
      fields: 'id',
    });
    return r.map((u) => u.id);
  } catch {
    return [];
  }
}
