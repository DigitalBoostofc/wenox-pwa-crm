# Redesenho de Fluxos por Papel — wenox-pwa-crm

## Contexto

Separação de **PERFORMANCE** (como estou indo?) de **OPERAÇÃO** (o que preciso fazer agora?),
por tipo de conta. Dois papéis centrais:

- **Gestor** (`canGerirEquipe` = Owner / Admin / Gestor): visão de negócio — toda a equipe.
- **Membro** (e Visualizador): visão pessoal — minhas demandas e minha performance.

Princípio: **ligar peças prontas que estão desligadas no código. NÃO apagar dados.**

---

## Frente 1 — Dashboard do Membro: painel de DESEMPENHO

**Arquivo:** `src/dashboard/DashboardPage.tsx`

### Antes
`VisaoMembro`: tela morta com botão "Ir para Minha Área".

### Depois — `CockpitMembro`
Envolvido por `DadosAgenciaProvider` (sem `comUsuarios`/`comClientes`).

Composição de peças existentes:
1. **Saudação + SeletorMeses** (1 mês padrão).
2. **KPIs pessoais** — Abertas, Atrasadas, Concluídas no mês, Taxa no prazo %
   — via `desempenhoDoUsuario(user.id, nome, tarefas, meses)` de `relatoriosService.ts:186`.
3. **PainelDesempenho** (`blocosDesempenho.tsx:77`) com `resumoDeMembro(...)` — donuts Concluídas/Abertas.
4. **Tendência de pontualidade PESSOAL** — `LinhaPontualidade` alimentada por loop de
   `desempenhoDoUsuario` sobre `mesesRecentes(6)`, filtrado ao usuário (espelha `TendenciaPontualidade`).
5. **BarrasMensais** (`charts.tsx:182`, antes órfão) — entregas/mês no prazo × atrasada do membro.
6. **Pontualidade por ETAPA** (lógica nova) — `pontualidadeEtapasDoUsuario(uid, tarefas, meses)`
   adicionada em `relatoriosService.ts`: para cada `etapa` com `responsavel === uid && feito`,
   classifica `feito_em` vs `etapa.prazo` → no prazo / atrasada / sem prazo.
   Renderizado como `RoscaSegmentada` ou barra "Suas etapas no prazo: N%".

**Arquivos alterados:**
- `src/dashboard/DashboardPage.tsx` — substitui `VisaoMembro` por `CockpitMembro`
- `src/dashboard/relatoriosService.ts` — adiciona `pontualidadeEtapasDoUsuario`

---

## Frente 2 — Minha Área: CENTRAL DE DEMANDAS (operacional)

**Arquivos:** `src/minha-area/MinhaAreaPage.tsx`, `src/minha-area/blocos.tsx`

### Mudanças
- Remove `MinhaProdutividadeBloco` da Minha Área (performance migrou pro Dashboard).
- Reforça `MeuDiaBloco` com informações explícitas de cada item:
  - Prazo efetivo + destaque vermelho se vencido.
  - Agrupamento por urgência (Atrasadas / Hoje / Esta semana / Depois).
  - Seção Aguardando colapsável com "Vez de fulano".
- Monta `MeusProjetosBloco` (`blocos.tsx:182`, antes órfão) como seção secundária.
- NÃO monta `MeusDadosBloco` (dado cadastral não é demanda).

**Arquivos alterados:**
- `src/minha-area/MinhaAreaPage.tsx`

---

## Frente 3 — Cockpit do Gestor: revisão

**Arquivos:** `src/dashboard/DashboardPage.tsx` (CockpitNegocio), `src/dashboard/blocosNegocio.tsx`

### Mudanças
- Monta `SaudeProjetosBloco` (`blocosNegocio.tsx:41`, antes órfão) na grade do cockpit
  ao lado do `PulsoEquipeBloco`.
- Injeta `BarrasMensais` na `VisaoGeralDesempenho` (volume mensal da agência),
  complementando a `LinhaPontualidade`.
- Mantém todos os blocos existentes.

**Arquivos alterados:**
- `src/dashboard/DashboardPage.tsx`
- `src/dashboard/blocosDesempenho.tsx`

---

## Frente 4 — Consistência de navegação

**Arquivo:** `src/components/layout/nav.ts`

### Mudança
`titleForPath('/minha-area')` retornava "Minhas Tarefas" (bug), deve retornar "Minha Área".
Corrija casando com o rótulo do `NAV_ITEMS` (`'Minha Área'`).
O teste `tests/nav.test.ts` já cobre esse caso (`it('/minha-area → Minha Área (regressão PR #4)')`).

---

## Reuso de componentes

| Componente | Localização | Uso |
|---|---|---|
| `desempenhoDoUsuario` | `relatoriosService.ts:186` | KPIs + tendência pessoal |
| `PainelDesempenho` | `blocosDesempenho.tsx:77` | Donuts do membro |
| `resumoDeMembro` | `blocosDesempenho.tsx:49` | Adapter de DesempenhoMembro |
| `LinhaPontualidade` | `charts.tsx:126` | Tendência pessoal |
| `BarrasMensais` | `charts.tsx:182` | Volume mensal |
| `RoscaSegmentada` | `charts.tsx:75` | Pontualidade por etapa |
| `SaudeProjetosBloco` | `blocosNegocio.tsx:41` | Cockpit Gestor |
| `MeusProjetosBloco` | `blocos.tsx:182` | Minha Área |
| `mesesRecentes` | `relatoriosService.ts:39` | Loop de tendência |
| `SeletorMeses` | `SeletorMeses.tsx` | Filtro de meses |

---

## Barra de qualidade

- WCAG: cores com contraste suficiente, `aria-label` em SVGs, `role="img"`.
- Responsivo: `grid gap-3 sm:grid-cols-2 lg:grid-cols-4`.
- Estados vazios, carregando e erro tratados em todos os blocos.
- Sem placeholders / dados fake.

---

## Validação

```bash
npx tsc --noEmit
npm test
```

Testes novos/atualizados:
- `pontualidadeEtapasDoUsuario` (função pura) — `tests/relatoriosService.test.ts`
- Branches de papel no `DashboardPage` — `tests/DashboardPage.test.tsx`

---

## Branch e commits

Branch: `feature/fluxos-por-papel`

Commits por frente:
1. `docs: plano de redesenho por papel`
2. `feat(relatorios): pontualidadeEtapasDoUsuario`
3. `feat(dashboard): CockpitMembro substitui VisaoMembro`
4. `feat(dashboard): SaudeProjetosBloco + BarrasMensais no CockpitNegocio`
5. `feat(minha-area): remove produtividade, monta MeusProjetosBloco`
6. `fix(nav): titleForPath /minha-area → Minha Área`
7. `test: pontualidadeEtapasDoUsuario + DashboardPage por papel`
