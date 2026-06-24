import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useDadosAgencia } from '@/dashboard/useDadosAgencia';
import { useAuth } from '@/auth/useAuth';
import { etapaAtualIndex } from '@/tarefas/etapas';
import { TarefasTabela, colunasComVisiveis } from '@/tarefas/TarefasTabela';
import { progressoCardsDasTarefas, type ProgressoCardsTarefa } from '@/quadros/quadrosService';
import { POS_PAPEL } from '@/quadros/types';
import { TarefaViewSheet } from '@/tarefas/TarefaViewSheet';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Minha Área — visão lista: UMA tabela só (Cliente, Projeto, Tarefa, Etapa atual,
 * Status da etapa, Progresso, Prazo da etapa). Clicar numa tarefa de calendário
 * vai pro quadro na lista pendente; sem lista vinculada, abre a tarefa.
 */
export function MinhasTarefasLista({ somenteLeitura }: { somenteLeitura?: boolean }) {
  const { tarefas, carregando, refresh } = useDadosAgencia();
  const { user } = useAuth();
  const history = useHistory();
  const uid = user?.id ?? '';
  const [viewId, setViewId] = useState<string | null>(null);
  const [progressoFull, setProgressoFull] = useState<Record<string, ProgressoCardsTarefa>>({});

  const minhas = useMemo(
    () => tarefas.filter((t) => (t.responsaveis ?? []).includes(uid) && !t.arquivada),
    [tarefas, uid],
  );

  // Progresso dos cards (contador x/N + quadro/lista p/ navegar) das minhas tarefas.
  const idsMinhas = minhas.map((t) => t.id).join(',');
  useEffect(() => {
    const ids = idsMinhas ? idsMinhas.split(',') : [];
    if (!ids.length) { setProgressoFull({}); return; }
    let cancelado = false;
    progressoCardsDasTarefas(ids)
      .then((res) => { if (!cancelado) setProgressoFull(res); })
      .catch(() => { if (!cancelado) setProgressoFull({}); });
    return () => { cancelado = true; };
  }, [idsMinhas]);

  // {feitos,total} da etapa atual de cada tarefa → coluna "Progresso".
  const progressoCards = useMemo(() => {
    const m: Record<string, { feitos: number; total: number; emAlteracaoInterna?: boolean }> = {};
    for (const t of minhas) {
      const prog = progressoFull[t.id];
      if (!prog || prog.total === 0) continue;
      const idx = etapaAtualIndex(t.etapas ?? []);
      if (idx < 0) continue;
      const papel = POS_PAPEL[idx] ?? 'revisao';
      m[t.id] = { feitos: prog.porPapel[papel] ?? 0, total: prog.total, emAlteracaoInterna: prog.emAlteracaoInterna };
    }
    return m;
  }, [minhas, progressoFull]);

  const colunasPadrao = useMemo(
    () => colunasComVisiveis(['cliente', 'projeto', 'tarefa', 'etapa_atual', 'status_etapa', 'progresso', 'prazo_etapa']),
    [],
  );

  // Clicar: vai pro quadro na lista pendente (se houver); senão abre a tarefa.
  function abrir(id: string) {
    const prog = progressoFull[id];
    if (prog?.quadro && prog.lista) history.push(`/quadros/${prog.quadro}?lista=${prog.lista}`);
    else setViewId(id);
  }

  if (carregando) return <Skeleton className="h-64 w-full rounded-xl" />;

  return (
    <div className="flex flex-col gap-4">
      <TarefasTabela
        tarefas={minhas}
        onAbrir={abrir}
        persistPrefix="wenox-minha-lista-v2"
        onMudou={refresh}
        progressoCards={progressoCards}
        colunasPadrao={colunasPadrao}
      />

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
