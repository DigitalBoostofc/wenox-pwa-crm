# Runbook do cutover — status global (passo a passo turnkey)

> Estado em 2026-06-25: o lado **frontend + PocketBase está completo e em produção**
> (F0–F3 + correções de exibição + F4 parcial). Falta a parte **cross-team** (n8n
> write-side + serviço externo `/_up`) e o **F4 final**. Este runbook torna isso
> executável sem adivinhação. Contexto: [`status-global-contract.md`](./status-global-contract.md),
> [`status-global-backend-plan.md`](./status-global-backend-plan.md).

## ✅ Já feito e em produção
- Config `configuracoes.status_global` v1; campo `status_opcao` (text) no schema de `tarefas` e `cartoes`; backfill (4 tarefas, 60 posts).
- F1 (núcleo+editor), F2 (tarefas manuais), F3 (posts manuais) — PRs #33/#34/#37.
- Exibição: `resolverOpcaoCard`/`resolverOpcao` preferem o legado conhecido (sinal fresco do n8n) na transição — PRs #39/#40. Chip de card e tarefa sempre corretos.
- F4 parcial (frontend, código morto): removidos `statusDerivado`, `STATUS_POST`, `corStatusPost` — PR #41.
- Publicador IG real ("Publicar IG agendado (Boost)") lê a coleção `agendamentos_ig`, NÃO `status_post`, e está **INATIVO** → sem risco de publicação acidental.

## ⚠️ Lições/gotchas (LER antes de mexer)
- **PB descarta campo fora do schema** — todo campo novo exige migração antes de escrever (`e2e/schema_add_status_opcao.mjs`).
- **Deploy `docker cp` é ADITIVO** — `git rm` NÃO remove arquivo do container; sobrescreva com NO-OP.
- **NÃO deployar hook PB de request sem testar em PB local** — `onRecord{Create,Update}Request` em cartoes/tarefas causou HTTP 400 em TODAS as escritas (incidente 2026-06-25). Hooks que funcionam aqui: `onRecordAfterDeleteSuccess` (ver `pb_hooks/tarefas_cascade.pb.js`).
- Ações outward-facing (publicar no Meta) são irreversíveis → confirmar antes.

---

## PASSO 1 — n8n write-side: workflows passam a gravar `status_opcao`
Hoje gravam só o legado. A exibição já está coberta pela precedência (#39/#40), então isto é para tornar `status_opcao` autoritativo no BANCO (necessário antes de remover os espelhos no F4). **Editar o code node direto na UI do n8n é mais seguro** que reconstruir via MCP; se usar o MCP (`update_workflow`), rode `validate_workflow` antes e teste pelo webhook de teste.

### 1a. "Validação WhatsApp (cliente)" — id `9p9B18dkwbQxkuiC` (ATIVO, webhook cliente)
No code node "Validar Etapa", adicionar `status_opcao` nos PATCH de card e tarefa:
- `agpost`: `PATCH cartoes {status_post:'agendado', agendado_em:stamp}` → **+ `status_opcao:'op_agendado'`**.
- `altpost`: `PATCH cartoes {status_post:'em_alteracao'}` → **+ `status_opcao:'op_em_alteracao'`**.
- Aprovar/Revisar tarefa (deriv): adicionar `status_opcao` no PATCH da tarefa, mapeando do nome derivado:
  `Não iniciado→op_nao_iniciado, Em andamento→op_em_andamento, Aguardando aprovação→op_aguardando, Em alteração→op_em_alteracao, Concluído→op_concluido`.
  Ex.: `var OP={'Não iniciado':'op_nao_iniciado','Em andamento':'op_em_andamento','Aguardando aprovação':'op_aguardando','Em alteração':'op_em_alteracao','Concluído':'op_concluido'};` e no patch `status_opcao: OP[status]||''`.

### 1b. "Gerador mensal Social Media" — id `EeltJftHxamI6piv` (ATIVO, cron dia 1)
Na criação de card (`status_post:'em_producao'`) → **+ `status_opcao:'op_em_producao'`**. (Baixo risco: cron mensal.)

### 1c. Inativos (ajustar só ao religar): "Alerta agendamento de posts" (lê status_post='agendar'), "Avisos de revisão de posts", "Publicar IG agendado (Boost)" (lê `agendamentos_ig`). Quando forem ligados no modelo novo, ler/escrever `status_opcao`.

Mapa de referência (ids seed estáveis): `em_producao↔op_em_producao, agendar↔op_agendar, agendado↔op_agendado, postado↔op_postado, em_alteracao↔op_em_alteracao`.

## PASSO 2 — Serviço externo `media.wenox.com.br/_up` (código fora deste repo)
Seguir [`status-global-backend-plan.md`](./status-global-backend-plan.md): preflight de schema; ler `status_opcao` (allowlist `op_agendar`/`op_agendado`/`op_postado`); parar de derivar/escrever `status_post`; `ESTEIRA_ENABLED=false`; `/_up/review` → 410 por 1 ciclo; idempotência por ledger; cancelar agendamento ao sair da allowlist.

## PASSO 3 — Re-backfill (realinhar `status_opcao` no banco)
Depois que os escritores (passo 1/2) mudarem, rodar um re-sync que sobrescreve `status_opcao` a partir do legado para os valores conhecidos (o `e2e/seed_status_global.mjs` atual só preenche VAZIO — adicionar um modo `--resync` que reescreve de `status_post`/`status` por nome). `PB_ADMIN_SENHA=… node e2e/seed_status_global.mjs --resync`.

## PASSO 4 — Janela de leitura dupla (~7 dias)
Backend lê `status_opcao` com fallback ao espelho; métrica `posts_resolvidos_por_espelho_total` deve ir a 0. Só então avançar.

## PASSO 5 — F4 final (remover legado, em conjunto)
Frontend (quando o serviço externo NÃO ler mais `status_post`):
- `src/quadros/types.ts`: remover `statusDaEsteira`, `sessionIndex`, `classify`, `GATES_PAPEL`, `EstadoPost`/`ClassificacaoPost` (e `POS_PAPEL`/`papelDaEtapa`/`ORDEM_PAPEL` se ficarem órfãos).
- `src/quadros/quadrosService.ts`: remover gating/handoff por papel em `confirmarEtapaCard` (parar de escrever `status_post`/`status_opcao` derivado), `progressoCardsDasTarefas` (e a flag `emAlteracaoInterna`).
- `src/quadros/RevisaoPostsPage.tsx` + rota `/revisao/:token` em `src/App.tsx` (ou repensar como mudança manual de opção).
- Parar de escrever os espelhos `status` (tarefa) / `status_post` (card) — em `espelhoStatus`/`espelhoStatusCard` e nos services. Reverter a precedência-por-legado em `resolverOpcao`/`resolverOpcaoCard` para preferir `status_opcao` (ou remover o fallback).
- Testes: atualizar/retirar os que dependem da esteira (`quadrosService.cascade`, `quadrosService.criarTarefaSocialMedia`, `quadrosService.editarMes`, `CartaoSheet.ehPost`, `revisaoEsteira.classify`, `cartaoPost.predicate`).
Backend: remover `/_up/review`, inserção de `revisao_layout`, propagação card→tarefa.

## Rollback
Cada passo é reversível: n8n tem histórico de versão; PRs de frontend revertem via novo merge; espelhos legados continuam válidos até o passo 5. Nunca remover o espelho antes do passo 4 fechar.
