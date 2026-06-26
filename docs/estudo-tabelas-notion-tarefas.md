# Estudo: tabelas do Notion → o que mais implementar nas tabelas de tarefas

> Data: 2026-06-26 · Base: `src/tarefas/TarefasTabela.tsx` (pós edição inline estilo Notion)

## 1. Como as tabelas (databases) do Notion funcionam

No Notion, "tabela" não é uma planilha — é **uma das visualizações de um banco de dados**. O dado vive uma vez; a tabela, o kanban, o calendário e a galeria são só lentes diferentes sobre as mesmas linhas. Os pilares:

### 1.1 Propriedades (tipos de coluna)
Cada coluna tem um **tipo** que define edição e exibição:
- **Texto, Número, URL, Email, Telefone** — entrada livre, com formatação por tipo.
- **Select / Multi-select / Status** — opções coloridas; Status tem grupos (To-do / In progress / Done).
- **Date** — data única ou intervalo (início→fim), com hora opcional e lembrete.
- **Person** — pessoas do workspace (avatares).
- **Checkbox** — booleano.
- **Files & media** — anexos.
- **Relation** — liga linhas a outro banco (ex.: tarefa → projeto).
- **Rollup** — agrega um campo das linhas relacionadas (ex.: nº de posts do projeto).
- **Formula** — campo calculado a partir de outros.
- **Created/Edited time, Created/Edited by** — automáticos.
- **Button** — dispara ação (criar linha, editar campos, abrir link).

### 1.2 Visualizações salvas
Vários "views" por banco, cada um com **filtros, ordenação, colunas, agrupamento e layout próprios**. Tipos: Table, Board (kanban), Calendar, Timeline (Gantt), List, Gallery, Chart. Cada view tem um nome e um contador de itens.

### 1.3 Edição 100% inline
**Toda** célula edita no lugar, sem sair da grade. Navegação por teclado (setas, Tab, Enter para editar, Esc para sair), copiar/colar de planilha, e arrastar para preencher.

### 1.4 Agrupamento (group by)
Agrupa linhas por qualquer propriedade (status, responsável, prioridade…), com **sub-grupos**, cabeçalhos colapsáveis, contagem por grupo e a opção de mover linha entre grupos (que reescreve a propriedade).

### 1.5 Filtros compostos
Construtor com **E/OU**, grupos aninhados, e operadores por tipo (contém, está vazio, antes/depois, é/não é). Filtros rápidos ("quick filters") viram chips no topo.

### 1.6 Ordenação multinível
Ordena por várias colunas em cascata (ex.: Prioridade ↓, depois Prazo ↑).

### 1.7 Cálculos de rodapé (aggregations)
Cada coluna tem um rodapé com: count, count empty/filled, **percent** filled, sum, average, median, min, max, range, earliest/latest date. Também por grupo.

### 1.8 Ações em massa
Selecionar várias linhas (checkbox / shift-click) → editar uma propriedade de todas, mover, apagar, duplicar.

### 1.9 Linha como página
Cada linha abre como **página completa** (peek lateral ou tela cheia) com corpo de conteúdo, comentários e propriedades.

### 1.10 Outros refinamentos
Reordenar linhas por arrasto (ordem manual), congelar colunas, quebrar texto / altura de linha, templates de linha, sub-itens (hierarquia pai-filho), formatação condicional, exportar CSV/Markdown.

---

## 2. Onde nossa tabela já está (mapa do que temos)

| Recurso Notion | Status na `TarefasTabela` |
|---|---|
| Colunas configuráveis (mostrar/ocultar, reordenar) | ✅ via menu "Colunas" (drag) |
| Redimensionar coluna | ✅ |
| Persistência de preferências por contexto | ✅ `persistPrefix` (localStorage, isolado por área) |
| Edição inline | ✅ parcial — Status, Prazo, Prioridade, Descrição, Comentário |
| Filtros | ✅ Status, Prioridade, Prazo, Mês (simples, um por vez) |
| Ordenação | ⚠️ um nível só (prazo / prioridade / nome) |
| Status com grupos+opções coloridas | ✅ (modelo global Notion já implementado) |
| Seções colapsáveis | ✅ Abertas / Atrasadas / Concluídas |
| Linha "+ Nova tarefa" | ✅ rodapé da tabela |
| Linha abre página/sheet | ✅ |
| Recorrência | ✅ campo no schema |
| **Agrupar por qualquer campo** | ❌ |
| **Ações em massa** | ❌ |
| **Cálculos de rodapé** | ❌ |
| **Filtros compostos (E/OU)** | ❌ |
| **Ordenação multinível** | ❌ |
| **Views salvas e nomeadas** | ❌ (só lista/kanban global) |
| **Navegação por teclado** | ❌ |
| **Edição inline de nome / responsáveis / etiquetas** | ❌ |
| **Reordenar linhas por arrasto** | ❌ (campo `ordem` existe, sem UI) |
| **Calendar / Timeline view** | ❌ (existe só para quadros) |

---

## 3. Sugestões priorizadas

Ordenadas por **impacto ÷ esforço**, considerando nossa stack (PocketBase + React, prefs em localStorage, modelo de status global já pronto).

### 🟢 Quick wins (alto impacto, baixo esforço)

**S1. Edição inline do resto das células**
Estender o que já fizemos para **nome, responsáveis (multi-select com avatares) e etiquetas**. O padrão `editCell` + `salvarInline` (otimista) já existe — é só adicionar os editores. Fecha o ciclo "tudo edita no lugar" que é a essência do Notion.

**S2. Agrupar por (group by)**
Dropdown "Agrupar por: Status / Cliente / Responsável / Prioridade / Projeto / Nenhum". Reusa o padrão de seções colapsáveis que já temos (Abertas/Concluídas) — generaliza para qualquer campo, com contador por grupo. É o recurso que mais "faz parecer Notion".

**S3. Ações em massa**
Checkbox por linha + barra flutuante ("3 selecionadas → Status ▾ · Prazo ▾ · Prioridade ▾ · Apagar"). Para uma agência que mexe em lote (ex.: marcar 10 posts como Concluído), é enorme. Backend já suporta update individual; só batelar.

**S4. Cálculos de rodapé**
Linha de footer por coluna: contagem, **% concluído**, soma (quando numérico), datas min/max. Barato de calcular client-side sobre `filtradas`.

### 🟡 Médio (alto valor, esforço moderado)

**S5. Views salvas e nomeadas**
Hoje temos só `view: lista|kanban` global. Evoluir para **views nomeadas**, cada uma guardando filtros + colunas + ordenação + agrupamento + layout. Persistir por área (extensão natural do `persistPrefix`). Ex.: "Atrasadas da semana", "Por responsável".

**S6. Filtros compostos + chips**
Construtor E/OU com operadores por tipo, e os filtros ativos viram chips removíveis no topo (como o chip de responsável que já existe). Substitui os selects soltos atuais por algo escalável.

**S7. Ordenação multinível**
"Ordenar por Prioridade ↓ e depois Prazo ↑". Pequena mudança no `useMemo` de `filtradas` (lista de critérios em vez de um).

**S8. Reordenar linhas por arrasto (ordem manual)**
O campo `ordem` já existe no schema. Adicionar drag de linha quando a ordenação está em "Manual". Útil para priorização visual dentro de um grupo.

**S9. Navegação por teclado**
Setas para mover entre células, Enter para editar, Tab para próxima, Esc para sair. Transforma a tabela em ferramenta de produtividade real.

### 🔵 Estratégico (mais esforço, define produto)

**S10. Novas visualizações: Calendário e Timeline/Gantt de tarefas**
Já temos `CalendarioPage` para quadros — replicar para tarefas (por prazo) e um Timeline por intervalo de datas. Exige adicionar **data de início** ao schema para intervalos.

**S11. Tipos de propriedade adicionais**
- **Checkbox** (ex.: "aprovado pelo cliente" — campo `aprovacao` já existe).
- **Number** + soma no rodapé (ex.: horas estimadas).
- **Rollup leve**: nº de posts/cards do projeto na linha da tarefa (já temos a relação tarefa↔projeto↔cartões).

**S12. Templates de tarefa**
Modelos pré-preenchidos por área (ex.: "Post Instagram" já vem com etiquetas, prioridade, responsável padrão). Encaixa no botão "Nova tarefa".

**S13. Refinamentos de exibição**
Quebra de texto / altura de linha, congelar a coluna "Tarefa", exportar CSV. Polimento que aproxima da paridade visual com o Notion.

---

## 4. Recomendação de roteiro

1. **Sprint 1 (quick wins):** S1 + S2 + S3 + S4 — ✅ ENTREGUE (em produção). Edição inline ampla, agrupar por, ações em massa, rodapé.
2. **Sprint 2 (poder):** S5 + S6 + S7 — ✅ ENTREGUE (em produção). Visões salvas/nomeadas, filtros compostos (chips) e ordenação multinível. Lógica pura em `src/tarefas/tabelaView.ts`.
3. **Sprint 3 (produtividade):** S8 + S9 — ✅ ENTREGUE (em produção). Arrasto de linhas para reordenar (modo manual) e navegação por teclado (↑/↓/Enter/Espaço).
4. **Backlog estratégico:** S10–S13 conforme a necessidade do negócio aparecer.

> **Notas da Sprint 3:** o arrasto (grip ⠿) só aparece no modo **manual** — sem critérios de ordenação ativos e sem agrupamento — porque reordenar à mão conflita com ordenar por campo. A ordem manual é gravada no campo `ordem` (já existente no schema) e vira a ordenação padrão (com prazo de desempate), retrocompatível. Teclado: com uma linha focada, ↑/↓ navega, Enter abre o painel, Espaço marca/desmarca. A edição célula-a-célula por teclado (estilo planilha) ficou para depois — os editores inline são acionados por clique.

> **Notas da Sprint 2:** filtros são em **AND** (operador OU fica para depois). Visões salvas guardam filtros + ordenação + agrupamento; **colunas/larguras** seguem persistidas globalmente por área (não entram na visão ainda). O filtro de **Mês** continua separado por causa da lógica de "Atrasadas" (competência anterior ao mês selecionado).

> Nada aqui reintroduz etapas/fluxo — segue 100% manual, estilo Notion, como definido no MVP.

---

## 5. Pesquisa adicional — recursos do Notion ainda não mapeados (2026-06-26)

Revisão das *databases* do Notion buscando o que **ainda falta** além de S1–S13. ⚡ = frontend puro (sem schema), dá pra fazer já; 🔒 = exige migração de schema/decisão de produto.

**Novos — frontend, sem schema (⚡):**
- **N1. Menu no cabeçalho da coluna** — clicar no título abre ações: ordenar ↑/↓ por ela, ocultar, filtrar por ela. Interação-assinatura do Notion; reusa ordens/colDefs/filtros.
- **N2. Cabeçalho fixo (sticky)** — o cabeçalho gruda no topo ao rolar. ⏸️ ADIADO: o wrapper `overflow-x-auto` (rolagem horizontal) vira contêiner de scroll e quebra o `position: sticky` relativo à página; precisa de outra abordagem (ex.: caixa com altura máxima e scroll interno) antes de valer a pena.
- **N3. Densidade / altura de linha** — alternar Compacto/Confortável.
- **N4. Colunas de auditoria** — "Criado em" / "Atualizado em" como colunas somente-leitura (dados já em `created`/`updated`).
- **N5. Exportar CSV** — baixa a visão atual (filtrada+ordenada+colunas visíveis). [= parte do S13]
- **N6. Calc por coluna no rodapé** — escolher a agregação de cada coluna em vez de fixa. [evolui S4]
- **N7. Grupos coloridos + recolher todos** — cabeçalho do grupo de status com a cor da opção.
- **N8. Filtros OU / grupos aninhados** — hoje só AND. [evolui S6]
- **N9. Formatação condicional** — pintar linha/célula por regra (ex.: vencida, prioridade alta).
- **N10. Duplicar tarefa** — ação de linha/massa que cria cópia (usa `criarTarefa`).
- **N11. Congelar 1ª coluna** — coluna "Tarefa" fixa ao rolar na horizontal. [parte do S13]
- **N12. Busca na tabela** — campo de busca textual escopado à tabela.

**Novos — exigem schema/decisão (🔒):**
- **N13. Tipos de coluna ricos** — Número, Checkbox, URL, Arquivos, Data com hora/intervalo → **migração de schema** em `tarefas` (campo fora do schema é descartado — ver [[reference-infra-prod]]).
- **N14. Rollup** — agregar dados relacionados (ex.: nº de posts do projeto na linha) → leitura cross-coleção.
- **N15. Sub-itens (hierarquia pai-filho)** — campo `parent` + UI de indentação.
- **N16. Fórmulas** — coluna calculada por expressão.
- **N17. Visões Calendário e Timeline/Gantt** (grande) — telas novas; Timeline precisa de data de início.

### Sprint 4 (entregue) — leva segura sem schema
**N1 + N3 + N4 + N5** (N2 adiado — ver acima). Tudo frontend reusando o existente:
- N1 menu no cabeçalho da coluna (ordenar ↑/↓, filtrar por, ocultar);
- N3 alternância de densidade (Compacto/Confortável), persistida;
- N4 colunas "Criado em"/"Atualizado em" (somente leitura);
- N5 export CSV da visão atual (linhas filtradas/ordenadas + colunas visíveis, com BOM p/ Excel).

Os ⚡ restantes (N2, N6–N12) e os 🔒 (N13–N17) seguem no backlog; os 🔒 dependem de decisão de produto + migração de schema antes de qualquer escrita.
