# Contrato — Loop dinâmico "Revisão Layout" (esteira Social Media)

> **Fonte única de verdade** para o cutover coordenado entre o **frontend** (este repo,
> React + TS + PocketBase PWA) e o **backend Python externo** (outra pessoa).
> Os dois lados DEVEM seguir este documento à risca.

---

## 1. Modelo de dados — `cartoes.etapas_card[]` (JSON, SEM migração de schema PB)

Cada etapa ganha o campo `papel` (string):

```ts
{ id, texto, tipo, papel, responsavel?, feito, feito_por?, feito_em?, veredito?, motivo? }
```

`papel` ∈: `copy` | `layout` | `revisao` | `aprovacao_cliente` | `agendamento` | `revisao_layout`.

`tipo` continua `'interna' | 'aprovacao_cliente'` (compat):
- `aprovacao_cliente` → `tipo = 'aprovacao_cliente'`
- todos os outros papéis → `tipo = 'interna'`

**Esteira inicial** (`gerarPostsMes`): 5 etapas, papéis na ordem
`[copy, layout, revisao, aprovacao_cliente, agendamento]`, com os textos atuais:
`Copy`, `Layout`, `Revisão interna`, `Aprovação do cliente`, `Confirmação de agendamento`.

**Fallback legado**: se uma etapa não tiver `papel`, derive do texto:
- `Copy` → `copy`
- `Layout` → `layout`
- `Revisão interna` → `revisao`
- `Aprovação do cliente` → `aprovacao_cliente`
- `Confirmação de agendamento` → `agendamento`
- texto que começa com `Revisão Layout` → `revisao_layout`

Implemente `papelDaEtapa(e): Papel = e.papel ?? derivaDoTexto(e.texto)`.

---

## 2. Inserção dinâmica (BACKEND faz isso no `/decisao` reprovado — frontend só LÊ o resultado)

Ao reprovar a etapa pendente de papel `revisao` OU `aprovacao_cliente` no índice `idx`, o backend:

1. Marca `ec[idx]`: `feito = true`, `veredito = 'reprovado'`, `motivo`.
2. **NÃO reabre o Layout.**
3. Insere logo após `idx`:
   - **(a)** `revisao_layout`: texto `'Revisão Layout'` (ou `'Revisão Layout N'` p/ N ≥ 2),
     `tipo = 'interna'`, `responsavel = o do layout`, `feito = false`.
   - **(b)** cópia do papel reprovado, numerada: texto `'Revisão interna K'` ou
     `'Aprovação do cliente K'`, `feito = false`.

O **frontend NÃO insere nada** — só renderiza a esteira que vier.

---

## 3. Confirmar Revisão Layout = AÇÃO IN-APP (frontend + `quadrosService`)

Quando a etapa atual tem papel `revisao_layout`, o `CartaoSheet` mostra o MESMO bloco do
Layout (conteúdo da Copy read-only + anexar arte) MAIS o motivo da reprovação anterior, e um
botão **"Confirmar Revisão Layout"** que chama o fluxo existente
(`handleConfirmarEtapa → confirmarEtapaCard → atualizarCartao` grava `etapas_card` com
`feito = true / feito_por / feito_em`; `status_post` recalculado por `statusDaEsteira`).
Após confirmar, o ponteiro vai pra próxima pendente (a re-revisão numerada).
**NÃO precisa de backend.**

---

## 4. `statusDaEsteira` (`src/quadros/types.ts`) — POR PAPEL

Primeira etapa pendente (primeira com `feito = false`):
- nenhuma → `'agendado'`
- papel `revisao_layout` → `'em_alteracao'`
- papel `agendamento` → `'agendar'`
- senão → `'em_producao'`

(Remover o check `texto === 'Confirmação de agendamento'`.)

---

## 5. `RevisaoPostsPage` (`src/quadros/RevisaoPostsPage.tsx`) — derivar por dado, não por idx fixo

O `GET /_up/review` agora retorna, além de `idxEtapa`, os campos `papelEtapa` e `textoEtapa`. Use-os:
- `nomeEtapa = data.textoEtapa` (em vez do hardcode `idxEtapa === 2 ? 'Revisão interna' : ...`)
- `isAgendamento = data.papelEtapa === 'agendamento'`

Mantenha o resto do fluxo (aprovar/reprovar/agendar postam
`{ token, cardId, idx, veredito, ... }` com o `idx` retornado).

**Defensivo**: se `papelEtapa`/`textoEtapa` vierem ausentes (resposta antiga), caia no
comportamento atual por idx (2/3/4) — mas o backend vai mandar os campos.

---

## 6. `CartaoSheet` (`src/quadros/CartaoSheet.tsx`) — render por papel

A esteira pode ter > 5 itens. A ação inline da etapa ATUAL passa a casar por
`papelDaEtapa(etapa)` em vez de `etapa.texto === 'Layout'` etc.:

- `copy` → bloco Copy atual.
- `layout` → bloco Layout atual.
- `revisao_layout` → bloco igual ao Layout (conteúdo da Copy + anexar arte) + mostrar o
  `motivo` da última etapa reprovada anterior (a etapa de papel `revisao`/`aprovacao_cliente`
  imediatamente acima com `veredito = 'reprovado'`) num aviso (text-amber/red) +
  botão **"✓ Confirmar Revisão Layout"**.
- `revisao` OU `aprovacao_cliente` → bloco "Abrir tela de revisão" atual.
- `agendamento` → bloco atual (se houver) / confirmar.

Os rótulos das etapas (lista) e a numeração da bolinha seguem a esteira como está nos dados.

---

## 7. Tipos / `ESTEIRA_SOCIAL` / `gerarPostsMes`

- `EtapaCard` (`src/quadros/types.ts`): adicionar `papel?: Papel` e exportar o tipo `Papel`.
- `ESTEIRA_SOCIAL`: adicionar `papel` em cada item (`[copy, layout, revisao, aprovacao_cliente, agendamento]`).
- `gerarPostsMes` (`src/quadros/quadrosService.ts`): gravar `papel` em cada etapa criada (a partir do `ESTEIRA_SOCIAL`).
- Onde houver lógica que assume texto fixo de etapa, migre p/ `papelDaEtapa`.

---

## 8. Tarefa (NÃO mexer na propagação aqui)

A propagação card → `tarefa.etapas` é feita pelo backend por papel; a tarefa NÃO cresce com
ciclos (continua 5 etapas). No frontend, só garanta que nada quebre quando a esteira do CARD
tiver mais de 5 itens (a tarefa segue 5).
