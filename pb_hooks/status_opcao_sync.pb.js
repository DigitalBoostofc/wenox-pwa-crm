/// <reference path="../pb_data/types.d.ts" />
// Cutover do status global (modelo grupos+opções): mantém `status_opcao` (fonte
// de verdade) em sincronia com os espelhos legados quando algum escritor grava
// SÓ o legado — em especial os workflows do n8n (Validação WhatsApp escreve
// cartoes.status_post; o fluxo de cliente escreve tarefas.status por nome).
//
// Regra (idempotente, sem loop): se o campo legado tem um valor CONHECIDO e o
// status_opcao atual não bate com a opção equivalente, ajusta status_opcao no
// MESMO write (hook de request, antes de persistir → não gera segunda escrita).
// Quando o legado é vazio/desconhecido (ex.: opção de post sem equivalente, ou
// opção customizada), o hook NÃO toca em status_opcao — preserva a escolha manual.
//
// NOTA: copiar para o pb_hooks/ do servidor (deploy.yml faz isso; PB hot-reload).
// API JSVM confirmada no PocketBase 0.23+ (e.record/e.app/e.next; getString/set;
// onRecord{Create,Update}Request — mesmos padrões de tarefas_cascade.pb.js).

// cartoes.status_post (legado) → id de opção (seed v1, ids estáveis).
var CARTAO_STATUS_POST_OPCAO = {
  em_producao: "op_em_producao",
  agendar: "op_agendar",
  agendado: "op_agendado",
  postado: "op_postado",
  em_alteracao: "op_em_alteracao",
};

// tarefas.status (legado, NOME do seed) → id de opção.
var TAREFA_STATUS_OPCAO = {
  "Não iniciado": "op_nao_iniciado",
  "Em andamento": "op_em_andamento",
  "Aguardando aprovação": "op_aguardando",
  "Em alteração": "op_em_alteracao",
  "Concluído": "op_concluido",
};

function sincronizar(e, campoLegado, mapa) {
  try {
    var legado = e.record.getString(campoLegado);
    var alvo = mapa[legado];
    if (alvo && e.record.getString("status_opcao") !== alvo) {
      e.record.set("status_opcao", alvo);
    }
  } catch (err) {
    e.app.logger().error("sync status_opcao", "campo", campoLegado, "err", String(err));
  }
  e.next();
}

onRecordCreateRequest(function (e) { sincronizar(e, "status_post", CARTAO_STATUS_POST_OPCAO); }, "cartoes");
onRecordUpdateRequest(function (e) { sincronizar(e, "status_post", CARTAO_STATUS_POST_OPCAO); }, "cartoes");
onRecordCreateRequest(function (e) { sincronizar(e, "status", TAREFA_STATUS_OPCAO); }, "tarefas");
onRecordUpdateRequest(function (e) { sincronizar(e, "status", TAREFA_STATUS_OPCAO); }, "tarefas");
