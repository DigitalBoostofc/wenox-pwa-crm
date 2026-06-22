/// <reference path="../pb_data/types.d.ts" />
// listas_cascade.pb.js — Ao deletar uma lista, remove a tarefa vinculada (lista.tarefa).
//
// Robustez: garante que o delete direto no admin também limpe a tarefa,
// complementando a cascata feita no app-side (deletarListaComCards).
// Duplo delete (app + hook) → 404 no segundo → ignorado (best-effort).
//
// Hook: onRecordAfterDeleteSuccess — usa e.record para capturar lista.tarefa
// após a lista ser deletada pelo PB. Não interferir com a cascata app-side;
// sempre best-effort para não quebrar o delete da lista em caso de erro.

onRecordAfterDeleteSuccess((e) => {
  e.next();
  const tarefaId = e.record.getString("tarefa");
  if (!tarefaId) return;

  const app = e.app;
  try {
    const tarefa = app.findRecordById("tarefas", tarefaId);
    app.delete(tarefa);
  } catch (err) {
    // 404 (tarefa já deletada pelo app) ou outro erro — ignora silenciosamente.
    app.logger().warn(
      "listas_cascade: tarefa não deletada",
      "lista", e.record.id,
      "tarefa", tarefaId,
      "err", String(err),
    );
  }
}, "listas");
