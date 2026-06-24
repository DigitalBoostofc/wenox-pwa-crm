# Contrato — Status global (grupos + opções, manual)

> **Fonte única de verdade** para o cutover coordenado entre o **frontend** (este repo,
> React + TS + PocketBase PWA) e o **backend Python externo** (outra pessoa).
> Os dois lados DEVEM seguir este documento à risca.
>
> Substitui [`esteira-revisao-layout-contract.md`](./esteira-revisao-layout-contract.md)
> (depreciado): o status do post **deixa de ser derivado da esteira** e passa a ser uma
> **opção escolhida manualmente**. Planejamento e fases em
> [`status-global-roadmap.md`](./status-global-roadmap.md).

---

## 1. Modelo de dados

### 1.1 Config global — `configuracoes` chave `status_global` (JSON)

```ts
interface StatusGrupo { id: string; nome: string; cor: CorStatus; ordem: number; }
interface StatusOpcao { id: string; grupo: string; nome: string; cor: CorStatus; ordem: number; }
interface StatusGlobalConfig { versao: number; grupos: StatusGrupo[]; opcoes: StatusOpcao[]; }
```

`CorStatus ∈ { cinza, azul, ambar, vermelho, verde, roxo }` (igual ao atual em
`src/tarefas/status.ts`). **Conjunto único** — a mesma lista de opções serve tarefas e
posts. Quem edita: gestores (frontend). Quem lê: frontend **e** backend.

### 1.2 Campos novos nas coleções (SEM migração de schema PB — campos JSON/string)

- `tarefas.status_opcao: string` — id de uma `StatusOpcao`.
- `cartoes.status_opcao: string` — id de uma `StatusOpcao`.

### 1.3 Espelho legado (durante a transição — até §6)

Sempre que `status_opcao` for gravado, o frontend grava também o campo legado equivalente:
- `tarefas.status` ← `nome` da opção (compat com código antigo e filtros).
- `cartoes.status_post` ← valor legado equivalente (ver tabela §3).

O backend pode continuar lendo `status_post` enquanto não migrar, mas **a fonte de
verdade passa a ser `status_opcao`**. Ao final (§6) o espelho é removido.

---

## 2. O que MUDA para o backend

O status do post **deixa de ser derivado** das `etapas_card`. Concretamente, o backend:

1. **Para de derivar/escrever `status_post`** a partir da esteira.
2. **Passa a ler `cartoes.status_opcao`** para decidir publicação/agendamento (ver §3).
3. **Aposenta a lógica de esteira de revisão**: `GET /_up/review`, inserção dinâmica de
   `revisao_layout`, numeração de re-revisões, e a propagação card→tarefa por papel.
4. **Não toca mais** `status_post` nem cria/insere etapas por veredito.

As `etapas_card` continuam existindo como **checklist informativo** (progresso/
responsável/histórico). O backend pode lê-las, mas **não deriva status delas**.

---

## 3. Como o backend interpreta `status_opcao`

O backend NÃO interpreta `nome` (texto livre, editável). Ele age sobre o **grupo** da
opção (categoria estável) e/ou sobre um pequeno conjunto de **ids de opção marcados**
acordados no cutover. Proposta de marcação (a confirmar na sessão de design):

| Intenção do backend | Como decidir |
|---|---|
| Publicar/agendar de fato | opção marcada como `agendar`/`agendado` no acordo de ids |
| Não publicar (rascunho/produção/alteração) | qualquer outra opção |
| "já postado" | opção marcada como `postado` |

### 3.1 Mapa de compatibilidade opção ↔ `status_post` legado

Enquanto o espelho existir, cada opção tem um `status_post` legado equivalente (gravado
pelo frontend), para o backend antigo não quebrar:

| `status_post` legado | Opção equivalente (grupo inicial) |
|---|---|
| `em_producao` | "Em produção" (A fazer) |
| `agendar` | "Agendar" (Em andamento) |
| `agendado` | "Agendado" (Concluído) |
| `postado` | "Postado" (Concluído) |
| `em_alteracao` | "Em alteração" (Em andamento) |

> Os ids exatos das opções marcadas são fixados no backfill (§5) e versionados em
> `status_global.versao`. O backend deve referenciar **ids**, não nomes.

---

## 4. Contrato de escrita (quem grava o quê)

| Campo | Frontend | Backend |
|---|---|---|
| `status_global` (config) | **escreve** (editor de grupos/opções) | só lê |
| `tarefas.status_opcao` | **escreve** (seletor manual / kanban) | — |
| `cartoes.status_opcao` | **escreve** (chip manual / board) | lê; pode escrever em `postado` ao publicar (a confirmar) |
| `cartoes.status_post` (legado) | escreve como espelho até §6 | lê até migrar; depois ignora |
| `etapas_card` | escreve (checklist) | lê informativo; **não deriva status** |

Regra de ouro: **`status_opcao` é a fonte de verdade**. `status_post` é espelho de
saída do frontend durante a transição, nunca mais uma derivação.

---

## 5. Migração / backfill *(via PB superuser, idempotente)*

1. Criar `status_global` v1: grupos **A fazer / Em andamento / Concluído** com as opções
   mapeadas de `DEFAULT_STATUS` e de `STATUS_POST` (ver §3.1 e roadmap §5).
2. Backfill `tarefas.status_opcao` a partir de `tarefas.status` (match por nome).
3. Backfill `cartoes.status_opcao` a partir de `cartoes.status_post` (tabela §3.1).
4. Registrar os **ids das opções marcadas** (agendar/agendado/postado) que o backend usa.
5. Reexecutável sem efeito colateral (idempotente): só preenche `status_opcao` vazio.

---

## 6. Retirada do legado *(fase final, coordenada)*

Quando o backend ler exclusivamente `status_opcao`:
1. Frontend para de escrever os espelhos `status` / `status_post`.
2. Remover `statusDaEsteira`, `STATUS_POST`, `sessionIndex`/`classify`/`GATES_PAPEL`
   (`src/quadros/types.ts`), gating/handoff em `confirmarEtapaCard` e
   `progressoCardsDasTarefas` (`src/quadros/quadrosService.ts`), e `RevisaoPostsPage`.
3. Backend remove `/_up/review`, inserção de `revisao_layout` e a propagação card→tarefa.
4. Este contrato passa a ser o único; o da esteira é arquivado.

---

## 7. Checklist de cutover (ordem segura)

- [ ] **F0** Contrato (este doc) revisado e aceito por frontend + backend.
- [ ] **F1** Núcleo `status.ts` + editor de grupos/opções no ar (aditivo, nada ligado).
- [ ] **Backfill** `status_global` v1 + `status_opcao` em tarefas e cards.
- [ ] **F2** Tarefas manuais no frontend (derivação desligada; espelho `status` ativo).
- [ ] **Sessão de design** backend confirma ids marcados e regras de publicação (§3).
- [ ] **F3** Posts por opção: frontend grava `status_opcao` + espelho; backend lê `status_opcao`.
- [ ] **F4** Retirada do legado (§6) em frontend e backend, em conjunto.
