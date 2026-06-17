/// <reference path="../pb_data/types.d.ts" />
// Cascade delete de tarefa: remove comentarios/historico órfãos e desvincula listas.
//
// NOTA: este arquivo deve ser copiado para o diretório pb_hooks/ do servidor
// PocketBase e o servidor deve ser reiniciado para que o hook seja ativado.
// Valide a sintaxe da API nesta versão do PocketBase antes de usar em produção
// (findRecordsByFilter, app.delete, app.save e e.next() foram testados na
// interface JSVM do PocketBase 0.23+).
//
// Campos confirmados no app (atividadeService.ts / quadrosService.ts):
//   comentarios → entidade + ref_id
//   historico   → entidade + ref_id
//   listas      → tarefa (relation; NÃO deletar a lista — ela contém os posts)
//   notificacoes → link

onRecordAfterDeleteSuccess((e) => {
  e.next();
  const id = e.record.id;
  const app = e.app;

  // Deletar comentarios e historico cujo ref_id aponta para a tarefa removida.
  for (const col of ["comentarios", "historico"]) {
    try {
      const recs = app.findRecordsByFilter(
        col,
        "entidade = 'tarefa' && ref_id = {:id}",
        "",
        0,
        0,
        { id },
      );
      for (const r of recs) {
        app.delete(r);
      }
    } catch (err) {
      app.logger().error("cascade " + col + " falhou", "err", String(err));
    }
  }

  // Desvincular listas que referenciavam a tarefa (não deletar a lista).
  try {
    const listas = app.findRecordsByFilter(
      "listas",
      "tarefa = {:id}",
      "",
      0,
      0,
      { id },
    );
    for (const l of listas) {
      l.set("tarefa", "");
      app.save(l);
    }
  } catch (err) {
    app.logger().error("cascade listas falhou", "err", String(err));
  }

  // Deletar notificações com link apontando para a tarefa removida.
  // Filtro exato: link = /tarefas/{id} — convenção criada em atividadeService (campo notificacoes.link).
  try {
    const link = "/tarefas/" + id;
    const notifs = app.findRecordsByFilter(
      "notificacoes",
      "link = {:link}",
      "",
      0,
      0,
      { link },
    );
    for (const n of notifs) {
      app.delete(n);
    }
  } catch (err) {
    app.logger().error("cascade notificacoes falhou", "err", String(err));
  }

}, "tarefas");
