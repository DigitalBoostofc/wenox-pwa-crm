# Contrato — Loop dinâmico "Revisão Layout" (esteira Social Media)

> ## ⚠️ DEPRECADO
> Este contrato descreve a **derivação automática** do status do post pela esteira de
> revisão. O produto está migrando para **status global manual** (modelo Notion,
> grupos + opções): o status do post deixa de ser derivado e passa a ser uma opção
> escolhida na mão. **Não construa nada novo sobre este documento.**
>
> - Contrato vigente: [`status-global-contract.md`](./status-global-contract.md)
> - Planejamento e fases: [`status-global-roadmap.md`](./status-global-roadmap.md)
>
> Mantido como **referência histórica** até a fase de limpeza (F4 do roadmap), quando a
> esteira de revisão (`/_up/review`, `revisao_layout`, propagação card→tarefa) é
> aposentada em conjunto com o backend.

---

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

Implemente `papelDaEtapa(e, i?): Papel = e.papel ?? derivaDoTexto(e.texto) ?? POS[i] ?? 'revisao'`
(o fallback posicional `POS[i]` é o ÚLTIMO recurso e só entra com `i` fornecido — ver **§9**).

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

> ⚠️ Com os ciclos de revisão as esteiras divergem de tamanho POR POST, então o
> `idxEtapa` global **não pode** indexar os outros posts. Ver **§9** para a indexação
> por-post (`sessionIndex`/`classify`) — o `idxEtapa` global vira só representativo
> (título/exibição).

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

---

## 9. Indexação por-post (`RevisaoPostsPage`) — espelha o backend byte-a-byte

Com os ciclos "Revisão Layout", a esteira de cada post pode ter tamanho diferente. Um
`idxEtapa` global mandaria veredito pra etapa errada. A página passa a derivar **por post**
o índice acionável e o estado, a partir do **papel da sessão** (`papelEtapa` do GET; em
respostas antigas, o POSICIONAL do `idxEtapa`).

### Helpers canônicos (`src/quadros/types.ts`)

```
GATES = ['revisao', 'aprovacao_cliente', 'agendamento']
POS   = { 0:'copy', 1:'layout', 2:'revisao', 3:'aprovacao_cliente', 4:'agendamento' }

// papel da etapa, com fallback posicional como ÚLTIMO recurso:
papelDaEtapa(e, i?) = e.papel ?? derivaPapelDoTexto(e.texto) ?? POS[i] ?? 'revisao'
// (derivaPapelDoTexto agora devolve `undefined` p/ texto desconhecido; `i` é opcional —
//  sem ele mantém o default legado 'revisao', não quebrando os callers atuais.)

// 1ª etapa não-feita do post é o gate da sessão? então é o idx a acionar; senão -1.
function sessionIndex(ec, papelEtapa) {
  const i = ec.findIndex(e => !e.feito);
  if (i === -1) return -1;
  return papelDaEtapa(ec[i], i) === papelEtapa ? i : -1;
}

// classifica o post na sessão
function classify(ec, papelEtapa) {
  const i = ec.findIndex(e => !e.feito);
  if (i === -1) return { state: 'CONCLUIDO' };
  const p0 = papelDaEtapa(ec[i], i);
  if (GATES.includes(p0)) return p0 === papelEtapa ? { state: 'PENDENTE', idx: i } : { state: 'ADIANTE' };
  if (p0 === 'revisao_layout') {
    const r = ec[i-1];
    const pr = r ? papelDaEtapa(r, i-1) : '';
    if (pr === papelEtapa && r.veredito === 'reprovado') return { state: 'REPROVADO', idx: i-1, motivo: r.motivo || '' };
    return { state: 'RETRABALHO_OUTRO' };
  }
  return { state: 'EM_PRODUCAO' };
}
```

### Como cada cálculo deriva (por post, não pelo idx global)

| Cálculo | Regra |
|---|---|
| `papelSessao` | `papelEtapa || POS[idxEtapa] || ''` (fallback compat respostas antigas). `idxEtapa` global é só título/exibição. |
| posição inicial | 1º post com `classify(...).state === 'PENDENTE'` (fallback 0). |
| acionável (post atual) | `sessionIndex(ec, papelSessao) !== -1` (≡ `classify().state === 'PENDENTE'`). |
| `decididos` | `posts.filter(p => classify(p.ec, papelSessao).state !== 'PENDENTE').length`. |
| `total` | `posts.length`. |
| `todosDecididos` | `!posts.some(p => classify(...).state === 'PENDENTE')`. |
| `reprovados` | posts com ícone `reprovado` (classify `REPROVADO` **ou** gate da sessão já decidido `reprovado` — pega o reprovar otimista antes do refetch). |
| `aprovados` | `decididos − reprovados`. |
| badge / ícone do post | `PENDENTE → ○` · `REPROVADO/reprovado otimista → ✗ vermelho` · resto decidido → `✓ verde`. |
| `idxGate` (exibição) | `sessionIndex` se pendente; senão a etapa do papel da sessão logo antes da 1ª não-feita (ou a última se concluído). Usado p/ o veredito/motivo/data exibidos. |

### POST de decisão e idx -1

- `enviarDecisao`/`enviarAgendamento` mandam `idx = sessionIndex(post.ec, papelSessao)`.
- **NUNCA postar `idx === -1`**: se não acionável, os botões somem e o post mostra
  *"em retrabalho — aguardando o design"*. O backend **não é rede de segurança** — `idx -1`
  corromperia a esteira (wrap em índice Python).
- Updates otimistos (`atualizarPostLocal`/`atualizarPostAgendado`) aplicam no `sessionIndex`
  daquele post. Aprovado **e** reprovado marcam `feito = true` (saem de PENDENTE). As novas
  etapas do ciclo (revisao_layout + re-revisão numerada) são inseridas pelo **backend** e só
  aparecem no refetch — o frontend não as simula.

### Caminho feliz (sem loops)

Com esteira de 5, `sessionIndex == idxEtapa` global e `classify` reproduz o comportamento
anterior (revisão idx 2 / aprovação idx 3 / agendamento idx 4) — sem regressão.
