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
Resposta: **Por id marcado.** Ok. O backend guarda um pequeno conjunto de ids
acordados (`op_agendar`, `op_agendado`, `op_postado`) em config própria e nunca olha
`grupo` nem `nome` para decidir ação. Grupo é só categoria visual do frontend; se eu
agisse por grupo, o usuário renomear/mover opções entre grupos mudaria meu comportamento
sem querer. Id é o único contrato estável.

**A2.** Confirma os ids que disparam publicação/agendamento?
*Default:* `op_agendar` = entra na fila de agendamento; `op_agendado` = publica no horário definido.
Existe um estado separado de "publicar agora" ou `op_agendar`/`op_agendado` cobrem tudo?
Resposta: **Confirmo, com um ajuste de semântica que torna a propriedade de quem
escreve cada estado clara.** O único **gatilho humano** é `op_agendar` — é o "go" do
frontend. Os outros dois são **estados de saída que EU (backend) escrevo**:

- `op_agendar` → **GATILHO**. Eu leio, valido e enfileiro na Meta. Decido pela
  `data_publicacao` do card: se for futura, **agendo** na Meta para aquele horário; se
  for agora/passado (ou vazia), **publico imediatamente**. Não preciso de uma flag
  separada de "publicar agora" — a data resolve isso. Ao a Meta aceitar, eu escrevo
  `op_agendado` (caso agendado) ou `op_postado` (caso publicado na hora).
- `op_agendado` → **estado que eu escrevo** quando a Meta aceitou o agendamento. É
  idempotente: se eu reler um card já em `op_agendado` que já tem `meta_creation_id` no
  meu ledger, **não reenfileiro**. Se um humano setar `op_agendado` na mão sem ter
  passado por `op_agendar` (sem ledger), eu trato como gatilho equivalente e agendo —
  mas o caminho canônico é `op_agendar`.
- Não existe estado separado de "publicar agora": `op_agendar` + `data_publicacao`
  cobrem agendamento e publicação imediata.

**A3.** `op_postado` é estado **terminal** (não republica)? 
*Default:* sim.
Resposta: **Sim, terminal.** Ok. `op_postado` nunca dispara nova publicação. Defesa em
profundidade: além de checar o id, eu guardo `meta_post_id` no meu ledger por card —
se já existe um `meta_post_id`, não republico independente do status. Reverter
`op_postado`→`op_agendar` na mão **não** vai republicar o mesmo card (proteção contra
post duplicado); se for intenção real de republicar, isso vira fluxo explícito futuro,
não um efeito colateral de mudar chip.

**A4.** Qualquer **outra** opção (incl. `op_em_producao`, `op_em_alteracao`, rascunhos) = **não publicar**?
*Default:* sim.
Resposta: **Sim — allowlist, não denylist.** Ok. Só os ids marcados disparam ação.
Qualquer outro id (`op_em_producao`, `op_em_alteracao`, `op_em_andamento`,
`op_aguardando`, `op_nao_iniciado`, `op_concluido`, ids futuros que o usuário criar) =
**não publicar**. Isso é importante: como o usuário pode criar opções novas a qualquer
momento, o seguro é "ninguém publica exceto a lista marcada". Caso especial: se um card
já estava `op_agendado` na Meta e volta para uma opção não-marcada (ex.: `op_em_alteracao`),
eu **cancelo o agendamento** na Meta (ver plano §"Cancelamento").

**A5.** Cards com `status_opcao` **vazio** (não-posts, ou posts ainda não classificados) — o backend **ignora**?
*Default:* sim, ignora (não publica).
Resposta: **Sim, ignora.** Ok. `status_opcao` vazio = invisível para o motor de
publicação. Durante a janela de leitura dupla (D2), se `status_opcao` estiver vazio mas
existir `status_post` legado, eu caio no **fallback do espelho** (ver A/B no plano) só
para os 60 posts já backfilled — mas vazio-e-sem-`status_post` (os ~7111 não-posts)
nunca entra no motor.

---

## B. O que o backend escreve

**B1.** Ao publicar de fato, o backend **escreve** `cartoes.status_opcao = op_postado`?
*Default:* sim, e também o espelho `status_post = 'postado'`, enquanto o espelho existir.
*(Alternativa: o backend só escreve `status_post` e o frontend reflete — menos consistente.)*
Resposta: **Sim — eu escrevo `status_opcao = op_postado` como verdade.** Ok. Ao publicar
de fato, escrevo `cartoes.status_opcao = "op_postado"`, e **enquanto o espelho existir
(até §6)** escrevo também `cartoes.status_post = "postado"` no mesmo PATCH, para o código
antigo do frontend não regredir. Mesmo padrão ao agendar: escrevo `status_opcao =
"op_agendado"` (+ espelho `status_post = "agendado"`). O frontend **não** precisa
"refletir" o que eu fiz — a fonte de verdade é o `status_opcao` que eu mesmo gravei.
Depois do §6 eu paro de tocar `status_post` e escrevo só `status_opcao`.

**B2.** O backend **para de derivar/escrever `status_post`** a partir da esteira de revisão?
*Default:* sim — `status_post` deixa de ser derivado; vira só espelho de saída.
Resposta: **Sim.** Ok. A partir do deploy do cutover, `status_post` **nunca mais** é
derivado de `etapas_card`/veredito. As únicas escritas de `status_post` que sobram são o
**espelho de saída** dos meus próprios estados (`agendado`/`postado`), e só durante a
janela de transição. Em §6 esse espelho some e eu escrevo exclusivamente `status_opcao`.

---

## C. Aposentar a esteira de revisão

**C1.** Podemos aposentar `GET /_up/review`, a inserção dinâmica de `revisao_layout`,
a numeração de re-revisões e a propagação **card→tarefa por papel**? Em que momento?
*Default:* sim, no mesmo deploy em que você passa a ler `status_opcao`.
Resposta: **Sim, mas com um passo intermediário de segurança em vez de remoção atômica.**
No **deploy do cutover** eu **desligo a escrita** desses mecanismos (feature-flag
`ESTEIRA_ENABLED=false`): paro de inserir `revisao_layout`, de numerar re-revisões, de
propagar card→tarefa e de escrever `status_post`/etapas por veredito. O **endpoint
`GET /_up/review` eu mantenho vivo respondendo `410 Gone` (ou no-op 200)** por 1 ciclo,
para não dar 404 em qualquer caller/cron esquecido enquanto observo os logs. **Removo o
código morto de fato em §6/F4**, junto da remoção dos espelhos no frontend. Resumo: a
**lógica** morre no cutover; o **endpoint e o código** saem em F4. Responsável: eu
(backend); data: no mesmo deploy de "passa a ler `status_opcao`" (ver D1, passo 4).

**C2.** `etapas_card` continuam existindo como **checklist informativo** — o backend pode
**ler**, mas **não deriva status** delas. Confirma?
*Default:* sim.
Resposta: **Confirmo.** `etapas_card` viram leitura informativa (progresso/responsável/
histórico). Não derivo `status_opcao`/`status_post` delas, não insiro etapas por veredito,
não uso elas como porteira de publicação. Se eu precisar exibir progresso em algum painel
meu, leio sem escrever.

---

## D. Ordem do cutover e operação

**D1.** Confirma a ordem segura?
1) schema `status_opcao` (✅ feito) → 2) backfill (✅ feito) → 3) **F3 frontend** grava
`status_opcao` + espelho → 4) **backend** passa a ler `status_opcao` → 5) remove esteira (C) →
6) **F4** remove os espelhos legados, em conjunto.
Resposta: **Confirmo a ordem.** Ok. O ponto crítico é o passo 3 vir **antes** do 4: o
frontend (F3) tem de estar gravando `status_opcao` + espelho **antes** de eu passar a ler
`status_opcao`, senão eu leria um campo vazio e nada publicaria. Como o backfill (§5) já
preencheu os 60 posts reais, eu nasço o cutover já enxergando esses 60 mesmo antes de
qualquer edição nova do F3 — o fallback ao espelho (D2) cobre o intervalo. Passos 5 e 6
são meus + frontend em conjunto, coordenados pelo sinal de D2.

**D2.** **Janela de leitura dupla** (`status_opcao` || `status_post`): por quanto tempo o backend
lê os dois? Quem dá o sinal de "pode remover o espelho `status_post`"?
*Default:* backend lê os dois por 1 ciclo de validação; o sinal de remoção parte de você.
Resposta: **Leitura dupla por ~1 ciclo (proponho 7 dias corridos) e o sinal de remoção
parte de mim.** Regra de resolução, nesta precedência:

1. Se `status_opcao` ∈ ids conhecidos → **decide por ele** (verdade).
2. Senão, se `status_opcao` vazio **e** `status_post` presente → **fallback ao espelho**
   via tabela §3.1 (`agendar→op_agendar`, etc.). Cobre os 60 posts e qualquer card que o
   F3 ainda não reescreveu.
3. Senão (ambos vazios) → ignora.

Critério para eu dar o sinal de remover o espelho: por **1 ciclo inteiro (7 dias)**,
**zero** cards caírem no caso (2) — ou seja, todo post publicável já chega com
`status_opcao` preenchido pelo F3. Quando esse contador zerar e os dashboards de
publicação baterem, **eu** aviso o frontend que pode parar de escrever `status_post`
(§6/F4). Métrica que eu exponho: `posts_resolvidos_por_espelho_total` (tem que ir a 0).

**D3.** O backend valida `status_global.versao` antes de confiar nos ids marcados (A2)?
*Default:* sim — se a versão subir, você relê a config e revalida os ids.
Resposta: **Sim, com fail-safe.** Ok. No boot e a cada ciclo eu leio
`configuracoes.status_global`, cacheio `versao` + o mapa de opções. Importante: como o id
é estável e o usuário só edita `nome`/`cor`/`ordem`/`grupo`, **mudar a `versao` não muda
meu comportamento** — eu revalido apenas que meus 3 ids marcados (`op_agendar`,
`op_agendado`, `op_postado`) **ainda existem** na lista de `opcoes`. Se algum id marcado
**sumir** (alguém deletou a opção), eu entro em **modo seguro: não publico nada** e
alarmo (`status_global_ids_marcados_ausentes`), porque perdi meu gatilho confiável. Nunca
"adivinho" por nome. A `versao` serve de carimbo de auditoria e de invalidação de cache,
não de gate de ação.

**D4.** Ciente de que **o PocketBase descarta silenciosamente campos fora do schema**?
Qualquer ambiente novo precisa rodar `e2e/schema_add_status_opcao.mjs` antes de escrever `status_opcao`.
Resposta: **Ciente.** Ok. Antes de qualquer escrita de `status_opcao` num ambiente novo,
roda-se `e2e/schema_add_status_opcao.mjs` (idempotente). Defesa minha no boot: faço um
**preflight** que lê o schema da coleção `cartoes` via API admin do PB e **aborta o
serviço com erro claro** se o campo `status_opcao` não estiver no schema — em vez de
"escrever" e o PB descartar em silêncio (que é o pior dos mundos: parece sucesso, perde
dado). Sem o campo no schema, eu não subo o motor de publicação.

---

## E. Saídas desta sessão (viram o contrato assinado)

- [x] Lista final de **ids marcados** + ação de cada um (A2/A3/A4) → preenche §3 do contrato.
      → `op_agendar` (gatilho: agenda/publica), `op_agendado` (backend escreve: agendado na Meta),
      `op_postado` (backend escreve: terminal). Demais ids/vazio = não publica.
- [x] Decisão de o backend **escrever `op_postado`** ao publicar (B1) → preenche §4.
      → **Sim**, escreve `status_opcao=op_postado` (+ espelho `status_post=postado` até §6).
- [x] Ordem + janela do cutover (D1/D2) e data/responsável para aposentar a esteira (C1).
      → Ordem D1 confirmada; janela de leitura dupla = 7 dias; esteira desligada (flag) no
      deploy do cutover e removida em F4; responsável = eu (backend).
- [x] Confirmar que **nada no backend depende de `nome`** (só `id`/`grupo`).
      → Confirmado: só `id`. Nem `nome` nem `grupo` entram em decisão de publicação.
