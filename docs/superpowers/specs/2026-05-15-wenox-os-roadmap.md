# Wenox OS — Spec consolidado e roadmap (2026-05-15)

> Fonte oficial: `2026-05-15-wenox-os-handoff.pdf` (Handoff PRD V1 — 14 páginas).
> Este .md reconcilia o documento com a **realidade do projeto** e fixa o roadmap aprovado.
> Substitui conceitualmente o spec antigo `2026-05-15-wenox-pwa-crm-design.md` (Ionic/CRM — obsoleto).

## O que muda em relação ao documento

O PDF foi escrito assumindo: GitHub bloqueado, sem backend, **tudo mockado**, validar UI antes
de qualquer dado real. **Esse cenário não vale mais.** Já temos:

- GitHub conectado, repo `wenox-pwa-crm` privado.
- PocketBase em produção (`api.wenox.com.br`), P1–P3 entregues com **dados reais**
  (clientes, usuários, permissões por role).
- PWA no ar (`app.wenox.com.br`) com auto-deploy no push da `main`.

Conclusão: a regra "mock-first" do doc está **superada pela realidade, a favor**. Não mockamos
dados que já existem de verdade. Todo o resto do documento (identidade visual, design system,
AppShell, 11 módulos, 4 perfis) continua valendo como bíblia.

## Decisões aprovadas (Leonardo, 2026-05-15)

1. **Backend fica** — PocketBase real, não voltar pra mock.
2. **Trocar Ionic → Tailwind CSS + shadcn/ui + lucide-react** (Ionic é fraco no desktop;
   doc pede cockpit SaaS premium desktop+mobile).
3. Tem que ficar **excelente no desktop E no mobile**.
4. **Adotar os 11 módulos** do documento.
5. Perfis: **Administrador / Gestor / Colaborador / Cliente** (Gestor = leitura do operacional
   sob sua responsabilidade; Colaborador = só suas demandas; Cliente = só o que é dele).
6. **Um módulo por vez, com aprovação do Leonardo em cada etapa.**
7. **Divergir do doc na ordem**: doc manda Dashboard primeiro; a dor real é **sair do Notion**
   → Cliente + Equipe do Cliente + Acessos vêm ANTES do Dashboard.
8. **Refatorar `equipe_cliente`**: o P3 criou `equipe_cliente` ligando cliente↔usuário Wenox.
   Conceitualmente errado — a equipe Wenox é alocada por **projeto**, não por cliente.
   Será aposentada no P5 e substituída por `contatos_cliente`.

## Ritual por plano/módulo

Escopo ✋ → Plano técnico ✋ → Execução (TDD + e2e) → Validação local + produção ✋ → próximo.
Fluxo: writing-plans → subagent-driven inline → finishing-a-development-branch (merge `main` = deploy).

## Modelo de dados (conforme notas de voz do Leonardo)

- **Equipe Wenox**: pessoas que trabalham na agência (Paula, Davi, Léo). Cadastro próprio.
- **Cliente**: a empresa (ex: Fibra Telecom). Guarda os **dados de acesso/credenciais**.
- **Equipe do Cliente / Contatos**: pessoas do lado do cliente (Pablo = marketing/operacional,
  Márcio = dono/aprovador). NÃO é equipe Wenox. Serve pra saber com quem falar e compartilhar
  acesso só com quem está cadastrado.
- **Projeto**: a "cola" da relação. **Cliente sem contrato não tem equipe Wenox.** Só com
  projeto ativo aloca-se equipe Wenox + define-se quais contatos do cliente participam.
- **Tarefas/Atividades**: sempre dentro de um projeto. Prazo + responsável(eis) — pode ser
  mais de um. Board Kanban; responsável muda conforme a etapa (copy→Paula, layout→Davi,
  aprovação→volta Paula).

## Campos do cadastro de Cliente (do card Notion — print 2026-05-15)

Nome do cliente · CPF/CNPJ · Razão Social · Contato (tel) · E-mail · Website · Endereço ·
Origem (select) · Período de Atividade (data início→fim) · Dashboard (url) · Drive (url) ·
Trello (url) · Status (select) · Observação (texto longo) · Serviços (multi-select:
Web Design / Gestão de Tráfego / Design Gráfico / Social Media) · Criado por/em (auto) ·
Última edição por/em (auto).

> **Pendente do Leonardo:** listas de opções de Origem, Status e Serviços completas;
> prints da Equipe do Cliente e dos Acessos.

## Tokens visuais (do doc, obrigatórios)

Roxo neon `#8B5CF6` · Fúcsia `#D946EF` · Ciano `#22D3EE` · Dark base `#080A16` ·
Card dark `#111327` · Texto `#F8FAFC`/`#CBD5E1` · Light base `#F8FAFC` ·
Borda `rgba(255,255,255,0.10)` (dark) / `#E2E8F0` (light).
Dark mode = identidade principal; light mode existe sem perder o premium.
Bordas arredondadas (radius alto), sombras suaves com brilho roxo/ciano, sans-serif moderna.

## Roadmap aprovado

| Plano | Mapeia no doc | Entrega |
|---|---|---|
| **P3.5 Fundação visual** | Sprint 1 (base/layout/sidebar/header) | Remove Ionic; Tailwind+shadcn/ui+lucide; tokens; AppShell (sidebar fixa desktop + drawer mobile + header busca/notif/tema/perfil); dark default + light; re-skin Login/Clientes/Detalhe/Usuários. Backend/permissões/testes preservados. |
| **P4 Cliente completo** | Sprint 2 (Clientes) | Expande `clientes` com todos os campos do card Notion + criado/editado por. |
| **P5 Equipe do Cliente** | implícito | Cria `contatos_cliente` (operacional/aprovador). Aposenta `equipe_cliente`. |
| **P6 Acessos** | não no doc | Credenciais criptografadas AES (`ENCRYPTION_KEY`) por cliente. **Mata o Notion.** |
| **P7 Dashboard Admin** | Sprint 1 (Dashboard) | Cockpit com dados REAIS: receita prevista, projetos ativos, tarefas pendentes, risco, saúde, projetos em movimento, capacidade da equipe. |
| **P8 Equipe Wenox** | Sprint 3 (Equipe) | Cadastro das pessoas da agência (cargo, carga). |
| **P9 Projetos** | Sprint 2 (Projetos) | `projetos` (cliente 1:N; aloca equipe Wenox + contatos cliente; status/etapas). |
| **P10 Tarefas** | Sprint 2 (Tarefas) | Kanban por projeto; responsável(eis) multi; etapas. Substitui Trello. |
| **P11+** | Sprint 3/4 + IA | Minha Área, Financeiro, Contratos/Propostas, Agenda, Configurações, IA Wenox. |

## Os 11 módulos (do doc)

Dashboard · Minha Área · Equipe · Clientes · Projetos · Tarefas · Financeiro ·
Contratos & Propostas · Agenda · IA Wenox · Configurações.
