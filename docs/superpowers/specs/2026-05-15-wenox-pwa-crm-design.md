# Wenox PWA CRM — Design Spec

**Data:** 2026-05-15
**Owner:** Leonardo Groff (Agência Wenox)
**Status:** Aprovado pelo usuário — pronto para fase de planejamento de implementação

---

## 1. Contexto e Motivação

Hoje o fluxo da agência é fragmentado entre Trello (tarefas), Notion (banco de dados de clientes) e Google Drive (propostas e documentos). Isso causa retrabalho manual — especialmente no encerramento de cliente, quando é preciso consolidar os acessos do Notion em um documento no Drive e enviar.

O objetivo é construir um sistema interno único que centralize o ciclo de vida do cliente da agência: cadastro, equipe envolvida, acessos (credenciais) e documentos. Em fases futuras, expandir para substituir o Trello (tarefas/projetos) e abrir acesso para o próprio cliente consultar seus dados.

## 2. Usuários e Acesso

- **Fase inicial:** uso interno (Owner + Admin + equipe Wenox).
- **Fase futura:** clientes finais terão acesso restrito para ver/baixar dados próprios.
- Arquitetura já preparada para esse acesso futuro (roles e RLS no banco).

## 3. Stack Técnica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | **Ionic React + Capacitor** | Mobile-first nativo, PWA cidadão de primeira classe, futuro app nativo via Capacitor |
| Backend | **PocketBase** | Single binary; SQLite + Auth + Storage + API; ~80 MB RAM |
| Infra | **VPS Hostinger + EasyPanel** | 4 GB RAM / 50 GB disco já disponíveis |
| Deploy | Git push → EasyPanel auto-deploy | Frontend como build estático; PocketBase como container |

**Domínios:** `app.wenox.com.br` (PWA) e `api.wenox.com.br` (PocketBase).

## 4. Arquitetura

```
┌─────────────────────────────────────────┐
│  Celular (Chrome/Safari)                │
│  PWA Ionic instalado → ícone na home    │
└──────────────┬──────────────────────────┘
               │ HTTPS (Let's Encrypt)
               ▼
┌─────────────────────────────────────────┐
│  VPS Hostinger (EasyPanel)              │
│                                         │
│  ┌──────────────┐    ┌────────────────┐ │
│  │ Ionic React  │───▶│  PocketBase    │ │
│  │ (estático)   │    │  SQLite + Auth │ │
│  │              │    │  + File store  │ │
│  └──────────────┘    └────────────────┘ │
│                                         │
│  Cron diário → backup pb_data           │
└─────────────────────────────────────────┘
```

**Consumo estimado:** ~110 MB RAM e ~6 GB disco inicial. Sobra folga para outros serviços.

## 5. Modelo de Dados

### Tabela `usuarios` (membros da Wenox)
Nome, e-mail, senha (PocketBase Auth), cargo, área, telefone, foto, status (Ativo/Inativo), **role** (Owner / Admin / Gestor / Membro / Visualizador).

### Tabela `clientes`
- Nome fantasia *(obrigatório)*
- Razão social
- CPF/CNPJ
- **Categoria:** Cliente / Parceiro *(obrigatório)*
- **Origem:** Indicação / Site / Tráfego / Outros
- **Serviços** (multi): Social Media / Tráfego Pago / Desenvolvimento / Branding / Outros
- Responsável principal (FK → `usuarios`) *(obrigatório)*
- Telefone / WhatsApp *(obrigatório)*
- E-mail
- Site
- **Status:** Ativo / Inativo *(obrigatório)*
- Data de início / encerramento
- Logo (upload)
- Observações (texto longo)

### Tabela `equipe_cliente`
Cliente (FK) · Usuário (FK) · Área (Social Media / Tráfego / Atendimento / Criação / Dev / Outros) · Status.

### Tabela `acessos`
Cliente (FK) · Plataforma · URL/Site · Usuário/Login · **Senha (AES-256 criptografada)** · Responsável (FK) · Status · Observações.

### Tabela `documentos`
Cliente (FK) · Nome · Tipo (Contrato / Briefing / Proposta / Relatório / Outros) · Arquivo (PocketBase storage) · Data · Tamanho (auto) · Responsável (FK) · Status (Ativo / Arquivado).

### Tabela `logs_acesso_sensivel`
Quem revelou qual senha, quando. Visível ao Owner.

## 6. Permissões — Matriz por Role

**Escopo:** Owner/Admin enxergam todos os clientes. Gestor/Membro/Visualizador enxergam apenas clientes onde estão vinculados em `equipe_cliente`.

| Ação | Owner | Admin | Gestor | Membro | Visual. |
|---|---|---|---|---|---|
| Clientes — listar | todos | todos | vinculados | vinculados | vinculados |
| Clientes — criar | ✅ | ✅ | ✅ | ❌ | ❌ |
| Clientes — editar info | ✅ | ✅ | ✅ | ✅ | ❌ |
| Clientes — excluir/arquivar | ✅ | ✅ | ❌ | ❌ | ❌ |
| Equipe — ver | ✅ | ✅ | ✅ | ✅ | ✅ |
| Equipe — adicionar/remover | ✅ | ✅ | ✅ | ❌ | ❌ |
| Acessos — ver lista (sem senha) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Acessos — revelar senha | ✅ | ✅ | ✅ | só se responsável | ❌ |
| Acessos — criar/editar | ✅ | ✅ | ✅ | só se responsável | ❌ |
| Acessos — excluir | ✅ | ✅ | ✅ | ❌ | ❌ |
| Documentos — ver/baixar | ✅ | ✅ | ✅ | ✅ | ✅ |
| Documentos — upload | ✅ | ✅ | ✅ | ✅ | ❌ |
| Documentos — excluir | ✅ | ✅ | ✅ | só os próprios | ❌ |
| Usuários — gerenciar | ✅ | ✅ | ❌ | ❌ | ❌ |
| Roles — atribuir | ✅ | ✅ (exceto Owner) | ❌ | ❌ | ❌ |

**Overrides individuais por cliente:** fora do MVP (fase 2).

## 7. UX Mobile (PWA)

### Identidade visual
- Tema **dark mode** por padrão (toggle disponível).
- Cor primária **roxo/violeta** (`#7C3AED` ou tom Wenox a definir).
- Status: verde = Ativo, cinza = Inativo.
- Tipografia: Inter / system font.
- Logo Wenox ⚡ no header de login.

### Navegação principal — Bottom tab bar
`👥 Clientes` · `🧑‍💼 Equipe` · `⚙️ Configurações`

### Telas do MVP
1. **Login** — email + senha + "Lembrar-me".
2. **Lista de Clientes** — busca, chips de filtro (Todos / Ativo / Inativo / Cliente / Parceiro), cards com logo+nome+status+contato, pull-to-refresh, FAB "+" para criar.
3. **Detalhe do Cliente** — header (logo + nome + status + Editar) + Ionic Segment com 4 abas: `Info` | `Equipe` | `Acessos` | `Documentos`. Ações rápidas (📞 / 💬 / ✉️). Swipe-to-edit nas listas.
4. **Formulários** — criar/editar Cliente, Equipe, Acesso, Documento. Upload via câmera/galeria. Botão "Salvar" sticky no rodapé.
5. **Aba Equipe** — lista de membros Wenox; Admin gerencia.
6. **Aba Configurações** — perfil, tema, logout, (Admin) gerenciar usuários.

## 8. Segurança

- **Auth:** PocketBase JWT, sessão persistente, HTTPS obrigatório.
- **Senhas de acessos:** criptografadas em repouso com AES-256; chave em variável de ambiente do EasyPanel.
- **Revelação de senha:** só via API com regra de permissão validada; cada revelação gera log.
- **Backup:** cron diário às 03:00 copia `pb_data` para `backups/` com timestamp; retém 14 dias.
- **HTTPS:** Let's Encrypt automático via EasyPanel.
- **2FA e reset por email:** fase 2.

## 9. Deploy

- **PocketBase:** container `ghcr.io/muchobien/pocketbase:latest`, volume `/pb_data`, env `ENCRYPTION_KEY`, domínio `api.wenox.com.br`.
- **PWA:** build local Ionic (`npm run build`) → Git push → EasyPanel deploya como site estático em `app.wenox.com.br`.
- **Branches:** `main` = produção (auto-deploy). `staging` = fase 2.
- **DNS:** apontar `app.wenox.com.br` e `api.wenox.com.br` para IP da VPS.
- **Monitoramento:** EasyPanel built-in. Alertas externos (UptimeRobot) na fase 2.

## 10. Roadmap

### Fase 0 — Setup (semana 1)
VPS + EasyPanel + domínios + PocketBase + repositório Git + pipeline de deploy + login básico.

### Fase 1 — MVP (semanas 2 a 6)
- Login
- Lista de Clientes + filtros + busca
- Formulário criar/editar Cliente
- Detalhe Cliente com 4 abas (Info / Equipe / Acessos / Documentos) — CRUD completo em cada uma
- Aba Equipe (membros Wenox)
- Configurações + gerenciar usuários
- 5 roles + matriz de permissões
- PWA instalável (manifest + service worker + ícones + splash)
- Backup diário automático

**Entregável:** substitui Trello + Notion + Drive no fluxo central de clientes.

### Fase 2 — Refinamentos
Reset de senha por email, 2FA para Admins, auditoria completa, overrides individuais, backup para Google Drive, modo offline básico.

### Fase 3 — Expansão (ordem sugerida)
1. Propostas (substitui parte do Drive)
2. Tarefas / Kanban (substitui Trello)
3. Projetos
4. Agenda
5. Financeiro
6. Dashboards (Social Media, Tráfego Pago)

### Fase 4 — Acesso do cliente
Login separado para cliente final ver dados/acessos/documentos da própria empresa. Role "Cliente Externo".

## 11. Decisões registradas

- Stack escolhida **Ionic React + Capacitor + PocketBase** (não Next.js) porque é desenhada para PWA mobile-first; sobra mais RAM na VPS; permite app nativo futuro sem reescrita.
- **MVP completo** (opção 2): Cliente + 4 seções de uma vez, evitando retrabalho de UX.
- **Sem overrides individuais de permissão no MVP.**
- **Sem 2FA no MVP.**
- Dark mode é padrão, não opcional.

## 12. Premissas e Riscos

- VPS Hostinger sobrevive a 4 GB RAM com folga (verificado consumo estimado).
- SQLite do PocketBase atende ao volume previsto da agência (dezenas a centenas de clientes).
- Backup local na VPS é suficiente para MVP; off-site backup vira fase 2.
- Equipe Wenox conseguirá adotar o sistema gradualmente conforme funcionalidades chegam.
