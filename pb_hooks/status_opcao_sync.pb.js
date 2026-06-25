/// <reference path="../pb_data/types.d.ts" />
// NO-OP — desativado após incidente (a versão anterior com onRecord{Create,Update}Request
// fez toda escrita em cartoes/tarefas retornar HTTP 400). Como o deploy usa `docker cp`
// (aditivo, não apaga arquivos removidos), este arquivo precisa existir vazio para
// SOBRESCREVER a versão ruim no container. Não registra nenhum hook.
//
// A sincronização status_opcao ↔ legado será refeita por outro mecanismo após
// investigar a API JSVM correta desta versão do PocketBase.
