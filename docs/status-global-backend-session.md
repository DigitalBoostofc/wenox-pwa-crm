# Sessão de design — cutover do status de posts (frontend × backend)

> Pauta objetiva para destravar **F3** (posts por opção) e **F4** (limpeza). O
> frontend já está pronto até **F2** (tarefas manuais). Posts dependem desta
> sessão porque `cartoes.status_post` e `etapas_card` são lidos/escritos pelo
> **backend Python** (publicação, agendamento, `/_up/review`).
>
> Fonte de verdade: [`status-global-contract.md`](./status-global-contract.md).
> Planejamento: [`status-global-roadmap.md`](./status-global-roadmap.md).

## Estado atual (o que já existe)

- Config global em `configuracoes` chave **`status_global`** (JSON): `{ versao, grupos[], opcoes[] }`.
  - `grupo: { id, nome, cor, ordem }` · `opcao: { id, grupo, nome, cor, ordem }`.
  - Seed v1 (ids estáveis): grupos `g_a_fazer` / `g_andamento` / `g_concluido`;
    opções `op_nao_iniciado, op_em_producao, op_em_andamento, op_aguardando,
    op_em_alteracao, op_agendar, op_concluido, op_agendado, op_postado`.
- Campo `status_opcao` (text) **já adicionado ao schema** de `tarefas` e `cartoes` em produção
  (via `e2e/schema_add_status_opcao.mjs`). ⚠️ O PB descarta campos fora do schema — qualquer
  ambiente novo precisa rodar isso antes de escrever `status_opcao`.
- Espelho legado `cartoes.status_post` continua válido durante a transição (tabela §3.1 do contrato).
- **Backfill já rodado em produção** (`e2e/seed_status_global.mjs`, idempotente): criou
  `status_global` v1, preencheu `status_opcao` em **4 tarefas** e nos **60 posts reais**
  (cards com `status_post`). Os ~7111 cards sem `status_post` (não-posts) foram deixados vazios
  de propósito — não recebem status global. O frontend ainda **não escreve** `status_opcao` em
  cards (isso é o F3).

## Decisões a fechar nesta sessão

### 1. Quais opções o backend "marca" e o que cada marca dispara
O backend **não** lê `nome` (texto livre, editável) — age por **id de opção** e/ou **grupo**.
Confirmar o conjunto mínimo de ids marcados e a ação de cada um:

| Marca (proposta) | Id de opção (seed) | Ação no backend |
|---|---|---|
| `agendar` | `op_agendar` | entra na fila de agendamento? |
| `agendado` | `op_agendado` | publicar no horário X? |
| `postado` | `op_postado` | estado terminal — não republicar |
| (rascunho/produção/alteração) | demais | não publicar |

- [ ] O backend referencia **ids** (não nomes)? Onde ficam guardados esses ids do lado dele?
- [ ] "Publicar de fato" = transição para `op_agendado`, ou existe opção/flag separada de "publicar agora"?
- [ ] Ao publicar, o backend **escreve** `op_postado` em `cartoes.status_opcao`? (contrato §4 diz "a confirmar")

### 2. Fonte de verdade durante a transição
- [ ] Combinado: **`status_opcao` é a verdade**; `status_post` é espelho de saída do frontend até §6.
- [ ] O backend passa a **ler `status_opcao`** e a **parar de derivar/escrever `status_post`** a partir da esteira — quando? (corte único vs. leitura dupla temporária)

### 3. Aposentadoria da esteira de revisão
O status do post deixa de ser derivado das `etapas_card`. O backend aposenta:
- [ ] `GET /_up/review`
- [ ] inserção dinâmica de `revisao_layout` + numeração de re-revisões
- [ ] propagação card→tarefa por papel
- [ ] qualquer escrita automática de `status_post`/etapas por veredito

`etapas_card` continuam como **checklist informativo** (o backend pode ler, mas **não deriva status**).

### 4. Versionamento e migração
- [ ] `status_global.versao` é a âncora dos ids marcados — o backend valida a versão antes de agir?
- [ ] Ordem do backfill: rodar `seed_status_global.mjs` **antes** ou **depois** do deploy do backend que lê `status_opcao`?
- [ ] Janela de leitura dupla (`status_opcao` || `status_post`) — por quanto tempo, e quem remove o espelho (§6)?

### 5. Quem escreve o quê (revisar a tabela §4 do contrato)

| Campo | Frontend | Backend |
|---|---|---|
| `status_global` | escreve (editor) | só lê |
| `cartoes.status_opcao` | escreve (F3) | lê; escreve `op_postado` ao publicar? **(decidir)** |
| `cartoes.status_post` (espelho) | escreve até §6 | lê até migrar; depois ignora |
| `etapas_card` | escreve (checklist) | lê informativo; **não deriva** |

## Saídas esperadas da sessão (vira o contrato assinado)

1. Lista final de **ids de opção marcados** + ação de cada um (preenche §3 do contrato).
2. Decisão sobre o backend **escrever** `op_postado` ao publicar (preenche §4).
3. Ordem e janela do cutover (backfill → deploy backend → F3 frontend → remover espelho §6).
4. Data/responsável para aposentar `/_up/review` e a esteira.

## Depois da sessão (sequência de execução)

1. ~~**Backfill**~~ ✅ já feito (schema + `seed_status_global.mjs` rodados em produção).
2. **F3** (frontend): `cartoes.status_opcao` no `CartaoSheet`/`QuadroBoardPage`/`CalendarioPage`
   (grava `status_opcao` + espelho `status_post`); chip de status vira opção global.
3. **Backend**: passa a ler `status_opcao`; aposenta esteira conforme combinado.
4. **F4** (limpeza conjunta): remove `statusDerivado`, `statusDaEsteira`/`STATUS_POST`/
   `sessionIndex`/`classify`/`GATES_PAPEL`, gating/handoff em `confirmarEtapaCard`,
   `progressoCardsDasTarefas`, `RevisaoPostsPage`, e os espelhos legados `status`/`status_post`.
