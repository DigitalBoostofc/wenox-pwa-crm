# Plano de implementação — backend Python (cutover do status de posts)

> **Quem:** dev do backend Python (serviço externo, fora deste repo).
> **Fonte de verdade:** [`status-global-contract.md`](./status-global-contract.md).
> **Decisões fechadas:** [`status-global-perguntas-backend.md`](./status-global-perguntas-backend.md).
>
> Resumo da virada: o status do post **deixa de ser derivado** das `etapas_card` e passa
> a ser uma **opção escolhida manualmente** (`cartoes.status_opcao`, id estável). O backend
> deixa de ser dono do status (esteira/`/_up/review`) e passa a ser **consumidor de
> `status_opcao`** + **produtor** só dos estados de saída (`op_agendado`, `op_postado`).

---

## 0. Princípios

1. **Decide por id marcado, nunca por nome nem por grupo.** Ids: `op_agendar`,
   `op_agendado`, `op_postado`.
2. **Allowlist de publicação:** só os ids marcados disparam ação; todo o resto (e vazio)
   = não publica.
3. **`status_opcao` é a verdade.** `status_post` vira espelho de saída temporário (até §6).
4. **Idempotência por ledger próprio** (`meta_creation_id`/`meta_post_id` por card), não por
   confiar só no status — protege contra post duplicado se o usuário mexer no chip.
5. **Fail-safe:** sem campo no schema, ou sem ids marcados na config → não sobe o motor /
   não publica e alarma. Silêncio nunca é "ok".

---

## 1. Config de ids marcados (do lado do backend)

Ids ficam guardados **na minha config de serviço** (env/arquivo), não hardcoded espalhado:

```python
# settings.py
STATUS_IDS = {
    "agendar":  "op_agendar",   # GATILHO humano (frontend) -> agendar/publicar
    "agendado": "op_agendado",  # ESTADO que o backend escreve quando a Meta aceita
    "postado":  "op_postado",   # ESTADO terminal que o backend escreve ao publicar
}
ESTEIRA_ENABLED = False          # desliga a esteira no deploy do cutover (ver §5)
ESPELHO_STATUS_POST = True       # escreve status_post espelho até §6; vira False em F4
LEITURA_DUPLA = True             # aceita fallback ao espelho na janela de transição
```

`status_global.versao` **não** é gate de ação — é carimbo de auditoria e invalidação de
cache. O gate real é "os 3 ids ainda existem em `configuracoes.status_global.opcoes`".

---

## 2. Ler `status_opcao` — regra de decisão (com fallback ao espelho)

A esteira de polling/seleção de cards publicáveis muda para esta resolução, em ordem de
precedência. Só posts (cards com algum status) entram; não-posts ficam de fora.

```python
def resolver_acao(card, cfg) -> str:
    """
    Retorna a 'marca' de ação: 'agendar' | 'agendado' | 'postado' | 'ignorar'.
    cfg = snapshot validado de configuracoes.status_global.
    """
    op = (card.get("status_opcao") or "").strip()

    # (1) status_opcao conhecido -> verdade
    if op == STATUS_IDS["agendar"]:
        return "agendar"
    if op == STATUS_IDS["agendado"]:
        return "agendado"
    if op == STATUS_IDS["postado"]:
        return "postado"
    if op:                       # id presente mas NÃO marcado (rascunho/produção/alteração/novo)
        return "ignorar"

    # (2) status_opcao vazio + espelho legado presente -> fallback (janela de transição)
    if LEITURA_DUPLA:
        legado = (card.get("status_post") or "").strip()
        marca = MAP_STATUS_POST_PARA_MARCA.get(legado)
        if marca:
            metrics.incr("posts_resolvidos_por_espelho_total")  # tem que ir a 0 antes do §6
            return marca

    # (3) ambos vazios -> não é post publicável / não-post
    return "ignorar"


# Tabela §3.1 do contrato, do lado do backend (espelho -> marca de ação)
MAP_STATUS_POST_PARA_MARCA = {
    "agendar":  "agendar",
    "agendado": "agendado",
    "postado":  "postado",
    # em_producao / em_alteracao -> ausentes de propósito = 'ignorar'
}
```

**Decisão de publicação dentro de `marca == "agendar"`** (gatilho):

```python
def executar_agendar(card):
    if ledger.ja_publicado(card["id"]):      # tem meta_post_id -> terminal, nunca republica
        return
    if ledger.ja_agendado(card["id"]):       # tem meta_creation_id -> idempotente, não reenfileira
        return

    quando = parse_dt(card.get("data_publicacao"))
    if quando is None or quando <= now():
        meta_post_id = meta.publicar_agora(card)         # publicação imediata
        ledger.set_publicado(card["id"], meta_post_id)
        escrever_status(card["id"], "postado")           # status_opcao=op_postado (+espelho)
    else:
        creation_id = meta.agendar(card, quando)         # agenda na Meta para 'quando'
        ledger.set_agendado(card["id"], creation_id)
        escrever_status(card["id"], "agendado")          # status_opcao=op_agendado (+espelho)
```

Quando a Meta confirma a publicação de um item agendado (webhook/cron de reconciliação),
escrevo `postado` e movo o ledger de `agendado`→`publicado`.

---

## 3. Escrever status (produtor) — sem mais derivação

O backend só escreve os **estados de saída** e, enquanto o espelho existir, grava os dois
campos no mesmo PATCH para o frontend antigo não regredir.

```python
ESCRITA = {
    "agendado": ("op_agendado", "agendado"),
    "postado":  ("op_postado",  "postado"),
}

def escrever_status(card_id, marca):
    op_id, legado = ESCRITA[marca]
    patch = {"status_opcao": op_id}
    if ESPELHO_STATUS_POST:               # True até §6; False em F4
        patch["status_post"] = legado
    pb.patch("cartoes", card_id, patch)
```

> **Nunca** mais escrever `status_post` derivado de etapa/veredito. As únicas escritas que
> sobram são estas duas, e o espelho some em §6.

---

## 4. Aposentar a esteira de revisão

No **deploy do cutover** (`ESTEIRA_ENABLED=False`), desligar a *lógica*:

- **`GET /_up/review`** → não processa mais veredito. Mantém o endpoint vivo respondendo
  **`410 Gone`** (ou no-op `200`) por 1 ciclo, para não dar `404` em cron/caller esquecido.
  Remove o endpoint de fato em **F4**.
- **Inserção dinâmica de `revisao_layout`** → desligada. Não cria mais essas etapas.
- **Numeração de re-revisões** → desligada.
- **Propagação card→tarefa por papel** → desligada.
- **Qualquer escrita de `status_post`/etapas por veredito** → desligada.

```python
@app.get("/_up/review")
def review_endpoint():
    if not ESTEIRA_ENABLED:
        return Response(status=410)   # Gone — esteira aposentada; remover rota em F4
    ...  # caminho antigo, morto após o cutover
```

`etapas_card` permanecem como **checklist informativo**: posso **ler** (progresso/
responsável/histórico), **nunca derivar status** nem inserir etapas por veredito.

### Cancelamento (estado some da allowlist)

Se um card que eu havia agendado na Meta voltar para uma opção **não-marcada** (ex.:
`op_em_alteracao`) ou vazia enquanto ainda não publicou:

```python
def reconciliar(card):
    marca = resolver_acao(card, cfg)
    if marca == "ignorar" and ledger.ja_agendado(card["id"]) and not ledger.ja_publicado(card["id"]):
        meta.cancelar_agendamento(ledger.creation_id(card["id"]))
        ledger.clear_agendado(card["id"])
        # NÃO toco status_opcao aqui — o humano é dono do chip; só desfaço o agendamento na Meta.
```

`op_postado` é terminal: voltar o chip de `postado`→`agendar` **não** republica (guarda do
ledger `ja_publicado`).

---

## 5. Validação de `status_global.versao` e dos ids

No boot e a cada ciclo:

```python
def carregar_cfg():
    cfg = pb.get_first("configuracoes", filter='chave="status_global"').valor  # JSON
    ids_existentes = {o["id"] for o in cfg["opcoes"]}
    faltando = [v for v in STATUS_IDS.values() if v not in ids_existentes]
    if faltando:
        metrics.gauge("status_global_ids_marcados_ausentes", len(faltando))
        raise ModoSeguro(f"ids marcados ausentes em status_global: {faltando}")  # não publica
    cache.set(cfg, versao=cfg["versao"])
    return cfg
```

- `versao` muda → relê e revalida; **não muda comportamento** (id é estável).
- id marcado sumiu → **modo seguro: não publica nada** + alarme. Nunca adivinha por nome.

### Preflight de schema (PB descarta campo fora do schema)

```python
def preflight():
    schema = pb.admin_get_collection("cartoes").schema
    if not any(f["name"] == "status_opcao" for f in schema):
        raise FatalBoot("cartoes.status_opcao ausente no schema — rode e2e/schema_add_status_opcao.mjs")
```

Sem o campo no schema, **o motor de publicação não sobe** (em vez de "salvar" e o PB
descartar em silêncio).

---

## 6. Ordem e janela do cutover

| # | Passo | Quem | Estado |
|---|---|---|---|
| 1 | schema `status_opcao` em `tarefas`+`cartoes` | infra | ✅ feito |
| 2 | backfill `status_global` v1 + `status_opcao` (60 posts) | infra | ✅ feito |
| 3 | **F3 frontend** grava `status_opcao` + espelho `status_post` | frontend | pré-requisito do 4 |
| 4 | **backend lê `status_opcao`** + desliga esteira (`ESTEIRA_ENABLED=False`) | **backend** | deploy do cutover |
| 5 | janela de **leitura dupla** (~7 dias); métrica `posts_resolvidos_por_espelho_total`→0 | backend | observação |
| 6 | **F4** remove espelhos + código morto (`/_up/review`, `revisao_layout`) | frontend+backend | sinal vem do backend |

**Crítico:** passo 3 **antes** do 4. Como o backfill já cobriu os 60 posts reais, no
momento do cutover eu já enxergo esses 60 mesmo sem edição nova do F3; o fallback ao
espelho cobre o intervalo.

**Sinal para remover o espelho (§6):** por **1 ciclo inteiro (7 dias corridos)**, **zero**
cards resolvidos pelo caso (2) — ou seja, `posts_resolvidos_por_espelho_total == 0` na
janela e dashboards de publicação batendo. Aí **eu** aviso o frontend para parar de
escrever `status_post`, viro `ESPELHO_STATUS_POST=False` e removemos o código morto juntos.

---

## 7. Tabela final — id de opção → ação no backend

| `status_opcao` | Marca | Ação no backend | Quem escreve |
|---|---|---|---|
| `op_agendar` | **gatilho** | enfileira: se `data_publicacao` futura → agenda na Meta; se agora/passado/vazia → publica já. Idempotente via ledger. | frontend (humano) |
| `op_agendado` | estado | "agendado na Meta". Não reenfileira se já tem `meta_creation_id`. Se setado na mão sem ledger → trata como gatilho. | **backend** (+ espelho `agendado`) |
| `op_postado` | terminal | **não republica** nunca (guarda `meta_post_id`). | **backend** (+ espelho `postado`) |
| `op_em_producao` | — | ignora (não publica) | frontend |
| `op_em_alteracao` | — | ignora; se já agendado e não publicado → **cancela** agendamento na Meta | frontend |
| `op_em_andamento`, `op_aguardando`, `op_nao_iniciado`, `op_concluido` | — | ignora | frontend |
| qualquer **id novo** criado pelo usuário | — | ignora (allowlist) | frontend |
| **vazio** + `status_post` presente | fallback | resolve pela tabela §3.1 (janela de leitura dupla) | — |
| **vazio** + sem `status_post` | — | ignora (não-post) | — |

> Fallback do espelho (`status_post`): `agendar→agendar`, `agendado→agendado`,
> `postado→postado`; `em_producao`/`em_alteracao` → ignora. Removido em §6.
