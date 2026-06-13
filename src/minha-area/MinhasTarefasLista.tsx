import { useEffect, useState } from 'react';
import { listUsuarios } from '@/usuarios/usuariosService';
import { useDadosAgencia } from '@/dashboard/useDadosAgencia';
import { useAuth } from '@/auth/useAuth';
import type { Tarefa } from '@/tarefas/types';
import { TarefaViewSheet } from '@/tarefas/TarefaViewSheet';
import { prazoBR, tarefaConcluida, prazoLimite } from '@/tarefas/format';
import { temEtapas, etapaAtual, ehVezDoUsuario, aguardandoAprovacaoCliente } from '@/tarefas/etapas';
import {
  TarefasTabela, catPrazoData, corPrazo, nomeCliente, dragResize,
} from '@/tarefas/TarefasTabela';
import { AvatarMembro } from '@/dashboard/AvatarMembro';
import { logoUrl } from '@/clientes/clientesService';
import { corAvatar, inicial } from '@/clientes/format';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* --------------------- Colunas (fixas) de Etapas Pendentes ---------------- */

const COLS_ETAPAS: { key: string; label: string; w?: number }[] = [
  { key: 'cliente', label: 'Cliente', w: 72 },
  { key: 'projeto', label: 'Projeto' },
  { key: 'tarefa', label: 'Tarefa / Etapa' },
  { key: 'status', label: 'Status', w: 170 },
  { key: 'prazo', label: 'Prazo', w: 130 },
  { key: 'resp', label: 'Responsável', w: 110 },
];
const LARGURA_ETAPAS_KEY = 'wenox-minha-etapas-larguras-v1';
function carregarLargurasEtapas(): Record<string, number> {
  try { const s = localStorage.getItem(LARGURA_ETAPAS_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
}
function salvarLargurasEtapas(l: Record<string, number>) {
  try { localStorage.setItem(LARGURA_ETAPAS_KEY, JSON.stringify(l)); } catch { /* */ }
}

/* ------------------------------- Componente ------------------------------- */

export function MinhasTarefasLista({ somenteLeitura }: { somenteLeitura?: boolean }) {
  const { tarefas, carregando, refresh } = useDadosAgencia();
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const [viewId, setViewId] = useState<string | null>(null);
  const [largurasEtapas, setLargurasEtapas] = useState<Record<string, number>>(carregarLargurasEtapas);

  // Logins de cliente (role=Cliente) por id do cliente — p/ foto do "Aguardando Cliente".
  const [clienteUsers, setClienteUsers] = useState<Record<string, { id: string; nome?: string; foto?: string; collectionId?: string; collectionName?: string }>>({});
  useEffect(() => {
    listUsuarios()
      .then((us) => {
        const m: Record<string, typeof clienteUsers[string]> = {};
        for (const u of us) if (u.role === 'Cliente' && u.cliente) m[u.cliente] = u;
        setClienteUsers(m);
      })
      .catch(() => { /* sem permissão p/ listar → cai no logo do cliente */ });
  }, []);

  const minhas = tarefas.filter((t) => (t.responsaveis ?? []).includes(uid));

  function iniciarResizeEtapas(key: string, thEl: HTMLElement, e: React.MouseEvent) {
    dragResize(thEl, e, (w) => setLargurasEtapas((prev) => { const n = { ...prev, [key]: w }; salvarLargurasEtapas(n); return n; }));
  }

  // Etapas pendentes: a etapa atual de cada tarefa em andamento (com etapas) do usuário.
  const etapasPendentes = minhas
    .filter((t) => temEtapas(t) && !tarefaConcluida(t.status))
    .map((t) => ({ t, etapa: etapaAtual(t.etapas ?? []) }))
    .filter((r): r is { t: Tarefa; etapa: NonNullable<typeof r.etapa> } => !!r.etapa)
    .sort((a, b) => (prazoLimite(a.etapa.prazo)?.getTime() ?? Infinity) - (prazoLimite(b.etapa.prazo)?.getTime() ?? Infinity));

  function badgeEtapa(t: Tarefa) {
    if (ehVezDoUsuario(t, uid)) return <Badge className="border border-orange-500/50 bg-orange-500/15 text-[10px] text-orange-500">Concluir Etapa</Badge>;
    if (aguardandoAprovacaoCliente(t)) return <Badge className="border border-yellow-500/50 bg-yellow-500/15 text-[10px] text-yellow-500">Aguardando Cliente</Badge>;
    return <Badge className="border border-amber-700/50 bg-amber-700/15 text-[10px] text-amber-600">Aguardando Equipe</Badge>;
  }
  function clienteCell(t: Tarefa) {
    const c = t.expand?.cliente;
    if (!c) return <span className="text-muted-foreground">—</span>;
    const nome = nomeCliente(t);
    const logo = c.logo ? logoUrl(c as never, '100x100') : '';
    return logo
      ? <img src={logo} alt={nome} title={nome} loading="lazy" className="size-7 rounded-md object-cover" />
      : <div title={nome} className={cn('grid size-7 place-items-center rounded-md text-[10px] font-bold text-white', corAvatar(nome))}>{inicial(nome)}</div>;
  }

  if (carregando) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="flex flex-col gap-4">
      <TarefasTabela tarefas={minhas} onAbrir={setViewId} persistPrefix="wenox-minha-lista" />

      {/* Etapas Pendentes */}
      {etapasPendentes.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold tracking-tight sm:text-lg">Etapas Pendentes</h3>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    {COLS_ETAPAS.map((c) => (
                      <th key={c.key} className="relative px-4 py-3 font-medium"
                        style={largurasEtapas[c.key] ? { width: largurasEtapas[c.key] } : (c.w ? { width: c.w } : undefined)}>
                        {c.label}
                        <span role="separator" aria-orientation="vertical" aria-label="Redimensionar"
                          onMouseDown={(e) => iniciarResizeEtapas(c.key, e.currentTarget.parentElement!, e)}
                          className="group absolute right-0 top-0 z-10 flex h-full w-2 cursor-col-resize select-none items-center justify-center">
                          <span aria-hidden className="h-2/3 w-px bg-border transition-colors group-hover:w-0.5 group-hover:bg-primary" />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {etapasPendentes.map(({ t, etapa }) => {
                    const resp = etapa.tipo === 'aprovacao_cliente'
                      ? null
                      : (t.expand?.responsaveis ?? []).find((r) => r.id === etapa.responsavel);
                    const cat = catPrazoData(etapa.prazo, false);
                    return (
                      <tr key={t.id} onClick={() => setViewId(t.id)}
                        className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-secondary/50">
                        <td className="overflow-hidden px-4 py-3">{clienteCell(t)}</td>
                        <td className="overflow-hidden px-4 py-3 text-muted-foreground">{t.expand?.projeto?.nome ?? '—'}</td>
                        <td className="overflow-hidden px-4 py-3">
                          <span className="font-medium">{t.nome}</span>
                          <span className="block truncate text-xs text-muted-foreground">{etapa.texto}</span>
                        </td>
                        <td className="overflow-hidden px-4 py-3">{badgeEtapa(t)}</td>
                        <td className="overflow-hidden px-4 py-3">
                          {etapa.prazo
                            ? <span className={cn('text-xs', corPrazo(cat))}>{prazoBR(etapa.prazo)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="overflow-hidden px-4 py-3">
                          {etapa.tipo === 'aprovacao_cliente'
                            ? (clienteUsers[t.cliente ?? '']
                                ? <AvatarMembro membro={clienteUsers[t.cliente!]} className="size-7 text-[10px]" />
                                : clienteCell(t))
                            : resp
                              ? <AvatarMembro membro={resp} className="size-7 text-[10px]" />
                              : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <TarefaViewSheet
        tarefaId={viewId}
        aberto={viewId !== null}
        onClose={() => setViewId(null)}
        onMudou={() => refresh()}
        somenteLeitura={somenteLeitura}
      />
    </div>
  );
}
