# P11 — Papel Cliente (Área do Cliente)

## Escopo travado (decisões de Leonardo, 2026-05-21)

- Conta de login pro cliente, **criada por um botão "Criar acesso" na ficha do cliente**.
- O cliente vê: **Projetos dele · Tarefas dele · Documentos do projeto · Dados da própria empresa**. NÃO vê: acessos/credenciais, outros clientes, equipe Wenox, configurações, financeiro.
- O cliente pode **aprovar tarefas + comentar** E **criar tarefas/solicitações**. Não edita nada da Wenox.
- **Fluxo de aprovação entra nesta fase**: tarefa em "Aguardando aprovação" ganha botões Aprovar / Pedir alteração.

## Backend (PocketBase — prod api.wenox.com.br)

1. `usuarios`:
   - Campo `role` (select) += valor **`Cliente`**.
   - Novo campo `cliente` (relation→clientes, single, opcional) — preenchido só nas contas Cliente.
2. `tarefas`: novo campo `aprovacao` (select: vazio | `aprovada` | `alteracao`) — registra o veredito do cliente, desacoplado do `status` (que é gerenciável).
3. **Collection rules** — contas Cliente veem só o que é delas (`@request.auth.cliente.id`):
   - `clientes`: list/view += `|| @request.auth.cliente.id ?= id`.
   - `projetos`: list/view += `|| @request.auth.cliente.id ?= cliente`.
   - `tarefas`: list/view += `|| @request.auth.cliente.id ?= cliente`.
   - `documentos`: list/view += `|| @request.auth.cliente.id ?= cliente`.
   - `comentarios`/`historico`: Cliente pode ler/criar comentário nas entidades que enxerga.
   - `acessos`: **sem cláusula Cliente** — credenciais ficam invisíveis pro cliente.
   - CUD: Cliente pode criar `tarefas` (do próprio cliente) e `comentarios`; pode atualizar `tarefas` do próprio cliente (pra aprovação). Não cria/edita clientes, projetos, etc.
4. Seed `status_tarefa` += "Em alteração" (Leonardo ajusta depois).

## Frontend

### Criar acesso
- Botão **"Criar acesso"** no header/Visão Geral da ClienteDetailPage (Owner/Admin/Gestor).
- Modal: nome, e-mail, senha (gera sugestão). Cria `usuarios` com role=Cliente + cliente=<id>.
- Mostra as credenciais após criar, pra repassar (reusa o padrão do commit `f94ac74`).
- Se o cliente já tem acesso, o botão vira "Acesso criado" + opção de resetar senha.

### Shell restrito do cliente
- `App.tsx`/`AppShell`: quando `user.role === 'Cliente'`, troca a árvore — sidebar e rotas restritas.
- Sidebar do cliente: **Meus Projetos · Minhas Tarefas · Documentos · Minha Empresa**. Sem Clientes/Equipe/Config/Usuários/Financeiro.
- `perms.ts` + `permissoesConfig`: role Cliente não acessa módulos internos.

### Telas do cliente
- **Meus Projetos**: ProjetosListPage já escopado pelas rules — cliente vê só os dele (sem botão "Novo projeto").
- **Minhas Tarefas**: TarefasListPage escopada. Cliente pode criar tarefa (form com cliente travado no dele, sem escolher equipe).
- **Documentos**: documentos dos projetos dele (sem upload — só baixar/abrir).
- **Minha Empresa**: ClienteDetailPage do próprio id, **read-only, sem aba Acessos, sem Editar**.

### Aprovação de tarefas
- TarefaDetailPage: quando `user.role === 'Cliente'` e a tarefa está em "Aguardando aprovação" →
  botões **Aprovar** e **Pedir alteração**.
  - Aprovar → `aprovacao='aprovada'` + comentário automático "✅ Cliente aprovou" no feed.
  - Pedir alteração → abre campo de texto obrigatório → `aprovacao='alteracao'` + status "Em alteração" + comentário "🔁 Alteração solicitada: <texto>".
- Lado Wenox: badge de aprovação na tarefa (aprovada / alteração solicitada) na lista e no detalhe.

## Testes / verificação

- `tests/` — perms do papel Cliente; service de criar acesso.
- e2e: criar acesso de cliente → logar como cliente → ver só os próprios dados → aprovar uma tarefa.
- build:ci + vitest + e2e local/prod. Limpar registros de teste.

## Fluxo de entrega

Branch `p11-papel-cliente` → backend (superuser PB) → criar-acesso → shell restrito → telas → aprovação → testes/e2e → merge main → validação ✋ Leonardo.

## Riscos / pontos de atenção

- Rules são a segurança real — testar como conta Cliente que ela NÃO acessa acessos/credenciais nem outros clientes.
- `@request.auth.cliente` exige o campo relation em `usuarios`; rules referenciam `@request.auth.cliente.id`.
- Reset de senha do cliente: superuser/Admin define nova senha (sem e-mail SMTP no MVP).
