/// <reference path="../pb_data/types.d.ts" />
// clientes_cascade.pb.js — Remove órfãos com cascadeDelete=FALSE ao deletar um cliente.
//
// O que o BANCO já faz nativamente (cascadeDelete=TRUE no schema — NÃO duplicar aqui):
//   clientes → projetos   (→ tarefas.projeto → hook tarefas_cascade cuida de comentarios/historico/notificacoes/listas)
//   clientes → documentos
//   clientes → contatos
//   clientes → acessos
//   clientes → equipe_cliente
//
// O que ESTE hook cobre (cascadeDelete=FALSE — o PB apenas zeraria o campo relation, não deleta):
//   1. quadros.cliente = <id>  → filhos em ordem: cartoes → listas → quadros
//      NOTA trello_id: deletar o quadro libera o slot (campo simples, não há tabela de slots).
//   2. tarefas avulsas: tarefas.cliente = <id> && tarefas.projeto = ''
//      → hook tarefas_cascade dispara individualmente e limpa comentarios/historico/notificacoes/listas.
//
// TODO (decisão de produto): atividades_social com projeto='' e usuarios.cliente=''
//
// Hook: onRecordDeleteRequest (before-delete) — captura quadros.cliente ANTES do PB
// zerar o campo (o que aconteceria no after-delete com cascadeDelete=FALSE).
// e.next() é chamado no try/finally para o PB executar a deleção nativa do cliente
// e seus filhos com cascadeDelete=TRUE — garantido mesmo que algum bloco interno lance.

onRecordDeleteRequest((e) => {
  const id = e.record.id;
  const app = e.app;

  let nQuadros = 0, nCartoes = 0, nListas = 0, nAvulsas = 0;

  try {
    // 1. Capturar records completos dos quadros do cliente (antes do PB zerar quadro.cliente).
    //    Reutilizados no step 4 para deletar — sem 2ª busca (M1).
    let quadros = [];
    try {
      quadros = app.findRecordsByFilter(
        "quadros",
        "cliente = {:id}",
        "",
        0,
        0,
        { id },
      );
    } catch (err) {
      app.logger().error("cascade quadros (captura) falhou", "cliente", id, "err", String(err));
    }

    // 2 + 3. Para cada quadro: deletar cartoes (todos de uma vez) depois listas.
    for (const q of quadros) {
      const qid = q.id;

      // 2. Deletar cartoes do quadro — limit=0 busca todos de uma vez, sem offset incremental (B1).
      //    Paginação com offset incremental causava órfãos ao deletar durante a iteração.
      try {
        const cartoes = app.findRecordsByFilter(
          "cartoes",
          "quadro = {:qid}",
          "",
          0,
          0,
          { qid },
        );
        for (const c of cartoes) {
          try {
            app.delete(c);
            nCartoes++;
          } catch (err) {
            app.logger().error("cascade cartao delete falhou", "id", c.id, "err", String(err));
          }
        }
      } catch (err) {
        app.logger().error("cascade cartoes falhou", "quadro", qid, "err", String(err));
      }

      // 3. Deletar listas (colunas kanban) do quadro.
      try {
        const listas = app.findRecordsByFilter(
          "listas",
          "quadro = {:qid}",
          "",
          0,
          0,
          { qid },
        );
        for (const l of listas) {
          try {
            app.delete(l);
            nListas++;
          } catch (err) {
            app.logger().error("cascade lista delete falhou", "id", l.id, "err", String(err));
          }
        }
      } catch (err) {
        app.logger().error("cascade listas falhou", "quadro", qid, "err", String(err));
      }
    }

    // 4. Deletar os quadros do cliente — reutiliza records do step 1 (M1).
    for (const q of quadros) {
      try {
        app.delete(q);
        nQuadros++;
      } catch (err) {
        app.logger().error("cascade quadro delete falhou", "id", q.id, "err", String(err));
      }
    }

    // 5. Deletar tarefas avulsas (sem projeto) do cliente.
    // Filtro cobre '' e null: PB armazena relation vazia como '' mas null inclui edge cases (L2).
    // O hook tarefas_cascade dispara para cada tarefa deletada e limpa comentarios/historico/notificacoes/listas.
    try {
      const avulsas = app.findRecordsByFilter(
        "tarefas",
        "cliente = {:id} && (projeto = '' || projeto = null)",
        "",
        0,
        0,
        { id },
      );
      for (const t of avulsas) {
        try {
          app.delete(t);
          nAvulsas++;
        } catch (err) {
          app.logger().error("cascade tarefa avulsa delete falhou", "id", t.id, "err", String(err));
        }
      }
    } catch (err) {
      app.logger().error("cascade tarefas avulsas falhou", "cliente", id, "err", String(err));
    }

  } finally {
    // Resumo de auditoria — sempre emitido para rastrear deleções em produção (H2).
    app.logger().info(
      "cascade cliente concluído",
      "cliente", id,
      "quadros", nQuadros,
      "cartoes", nCartoes,
      "listas", nListas,
      "tarefas_avulsas", nAvulsas,
    );

    // 6. Executar a deleção nativa do cliente — sempre chamado via finally (H2).
    // cascadeDelete=TRUE cuida de: projetos, documentos, contatos, acessos, equipe_cliente.
    e.next();
  }

}, "clientes");
