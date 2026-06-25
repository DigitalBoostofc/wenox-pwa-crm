# Perguntas para o dev do backend — cutover do status de posts

> Responda **inline** (preenchendo `Resposta:`). Cada pergunta vem com um
> **default recomendado** — se concordar, basta escrever "ok". O objetivo é
> fechar o contrato de [`status-global-contract.md`](./status-global-contract.md)
> e destravar **F3** (frontend grava status por opção) e **F4** (remover esteira).

---

## Contexto que você precisa (estado atual em produção)

- Existe uma config global em `configuracoes`, chave **`status_global`** (JSON):
  `{ versao: 1, grupos: [...], opcoes: [...] }`. Cada `opcao` tem `{ id, grupo, nome, cor, ordem }`.
  O usuário pode **renomear/recolorir/reordenar** grupos e opções à vontade — por isso
  **`nome` é texto livre e instável; o `id` é estável**.
- Campo **`cartoes.status_opcao`** (text) **já existe no schema** e já foi **backfilled**
  para os **60 posts reais** (cards com `status_post`). Os ~7111 cards sem `status_post`
  (não-posts) ficaram com `status_opcao` **vazio** de propósito.
- O frontend **ainda não escreve** `status_opcao` em cards (isso é o F3). Hoje só os campos
  legados (`status_post`) valem para posts.
- Ids de opção do seed v1 relevantes para posts:
  `op_em_producao`, `op_agendar`, `op_agendado`, `op_postado`, `op_em_alteracao`.
- Mapa legado atual (`status_post` ↔ opção), que o frontend mantém como espelho:

  | `status_post` | opção |
  |---|---|
  | `em_producao` | `op_em_producao` |
  | `agendar` | `op_agendar` |
  | `agendado` | `op_agendado` |
  | `postado` | `op_postado` |
  | `em_alteracao` | `op_em_alteracao` |

---

## A. Como o backend decide a ação a partir de `status_opcao`

**A1.** Você prefere agir por **id de opção marcado** ou pelo **grupo** da opção?
*Default recomendado:* por **id marcado** (estável mesmo se o usuário reorganizar grupos).
Resposta:

**A2.** Confirma os ids que disparam publicação/agendamento?
*Default:* `op_agendar` = entra na fila de agendamento; `op_agendado` = publica no horário definido.
Existe um estado separado de "publicar agora" ou `op_agendar`/`op_agendado` cobrem tudo?
Resposta:

**A3.** `op_postado` é estado **terminal** (não republica)? 
*Default:* sim.
Resposta:

**A4.** Qualquer **outra** opção (incl. `op_em_producao`, `op_em_alteracao`, rascunhos) = **não publicar**?
*Default:* sim.
Resposta:

**A5.** Cards com `status_opcao` **vazio** (não-posts, ou posts ainda não classificados) — o backend **ignora**?
*Default:* sim, ignora (não publica).
Resposta:

---

## B. O que o backend escreve

**B1.** Ao publicar de fato, o backend **escreve** `cartoes.status_opcao = op_postado`?
*Default:* sim, e também o espelho `status_post = 'postado'`, enquanto o espelho existir.
*(Alternativa: o backend só escreve `status_post` e o frontend reflete — menos consistente.)*
Resposta:

**B2.** O backend **para de derivar/escrever `status_post`** a partir da esteira de revisão?
*Default:* sim — `status_post` deixa de ser derivado; vira só espelho de saída.
Resposta:

---

## C. Aposentar a esteira de revisão

**C1.** Podemos aposentar `GET /_up/review`, a inserção dinâmica de `revisao_layout`,
a numeração de re-revisões e a propagação **card→tarefa por papel**? Em que momento?
*Default:* sim, no mesmo deploy em que você passa a ler `status_opcao`.
Resposta:

**C2.** `etapas_card` continuam existindo como **checklist informativo** — o backend pode
**ler**, mas **não deriva status** delas. Confirma?
*Default:* sim.
Resposta:

---

## D. Ordem do cutover e operação

**D1.** Confirma a ordem segura?
1) schema `status_opcao` (✅ feito) → 2) backfill (✅ feito) → 3) **F3 frontend** grava
`status_opcao` + espelho → 4) **backend** passa a ler `status_opcao` → 5) remove esteira (C) →
6) **F4** remove os espelhos legados, em conjunto.
Resposta:

**D2.** **Janela de leitura dupla** (`status_opcao` || `status_post`): por quanto tempo o backend
lê os dois? Quem dá o sinal de "pode remover o espelho `status_post`"?
*Default:* backend lê os dois por 1 ciclo de validação; o sinal de remoção parte de você.
Resposta:

**D3.** O backend valida `status_global.versao` antes de confiar nos ids marcados (A2)?
*Default:* sim — se a versão subir, você relê a config e revalida os ids.
Resposta:

**D4.** Ciente de que **o PocketBase descarta silenciosamente campos fora do schema**?
Qualquer ambiente novo precisa rodar `e2e/schema_add_status_opcao.mjs` antes de escrever `status_opcao`.
Resposta:

---

## E. Saídas desta sessão (viram o contrato assinado)

- [ ] Lista final de **ids marcados** + ação de cada um (A2/A3/A4) → preenche §3 do contrato.
- [ ] Decisão de o backend **escrever `op_postado`** ao publicar (B1) → preenche §4.
- [ ] Ordem + janela do cutover (D1/D2) e data/responsável para aposentar a esteira (C1).
- [ ] Confirmar que **nada no backend depende de `nome`** (só `id`/`grupo`).
