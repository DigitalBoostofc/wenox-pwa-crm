# Plano P4 — Cliente completo + opções gerenciáveis

> Spec: `docs/superpowers/specs/2026-05-15-wenox-os-roadmap.md`.
> Objetivo: cadastro de cliente com TODOS os campos do card Notion + listas
> (Origem/Status/Serviços) gerenciáveis pelo Leonardo (sem mexer em código).
> Primeiro passo concreto para largar o Notion.

## Decisões aprovadas (Leonardo, 2026-05-15)

- Listas Origem/Status/Serviços **NÃO podem ser fixas no código** — Leonardo
  adiciona/edita/remove pela interface.
- Gestão dessas listas fica **dentro de Configurações**.
- **Bloquear a remoção** de uma opção enquanto algum cliente a estiver usando.
- **Serviços** = múltipla escolha; **Origem** e **Status** = escolha única.

## Modelo de dados

### Nova coleção `opcoes`
Genérica, parametriza listas de todo o sistema (escala p/ outros módulos):
| campo | tipo | nota |
|---|---|---|
| `tipo` | select (`origem`,`status`,`servico`) | obrigatório |
| `valor` | text | obrigatório; rótulo exibido |
| `ordem` | number | ordenação na UI |
| `created`/`updated` | autodate | (gotcha PocketBase 0.26 — criar explícito) |

Regras PocketBase: `list/view` = qualquer logado; `create/update/delete` = só
Owner/Admin (reusar critério de `canGerirUsuarios`). Índice único (`tipo`,`valor`).

**Seed inicial** (Leonardo edita depois): origem = Indicação, Site, Tráfego,
Parceria, Outros · status = Ativo, Inativo · servico = Web Design, Gestão de
Tráfego, Design Gráfico, Social Media.

### Coleção `clientes` — campos a garantir/adicionar
Mapeando o card Notion (print 2026-05-15):
`nome_fantasia` (existe) · `razao_social` · `cnpj` · `telefone` (existe) ·
`email` · `site` · `endereco` · `origem` → **relation→opcoes** (single) ·
`servicos` → **relation→opcoes** (multi) · `status` → **relation→opcoes**
(single) · `data_inicio` · `data_encerramento` (Período) · `url_dashboard` ·
`url_drive` · `url_trello` · `observacoes` · `created`/`updated` (autodate) ·
`created_by`/`updated_by` → relation→usuarios (setado pelo app; PB não tem
autofield de usuário atual).

> `categoria` (Cliente/Parceiro) — manter como está (não é do card; fora do escopo
> mexer). `status` vira relation: filtros e badge da lista deixam de ser
> hardcoded Ativo/Inativo e passam a derivar das opções (badge neutra).

## "Bloquear remoção em uso"

PocketBase não bloqueia delete de registro referenciado por relation. Logo a
trava é na **camada de serviço** (`opcoesService.removerOpcao`): antes de deletar,
contar `clientes` que referenciam aquela opção (por `origem`/`status`/`servicos`);
se houver, rejeitar com mensagem clara. UI mostra o erro e não remove.

## Tarefas (TDD onde aplicável)

1. **Backend `opcoes`** — criar coleção + regras + índice + seed. (Passo admin
   PocketBase; precisa superusuário — Leonardo executa ou fornece credencial.)
2. **Backend `clientes`** — adicionar campos faltantes; migrar `origem`/`status`/
   `servicos` para relation→opcoes; backfill dos clientes existentes p/ as opções
   semeadas. created_by/updated_by.
3. **`opcoesService.ts`** — list por tipo, criar, editar, reordenar, remover (com
   guarda de uso). Testes unitários (mock pb): guarda bloqueia remoção em uso.
4. **`clientesService.ts`** — expandir create/update p/ novos campos + set
   created_by/updated_by. Ajustar `listClientes` (expand origem/status/servicos).
5. **Configurações → aba/seção "Parâmetros"** — 3 listas (Origem/Status/Serviços)
   com adicionar/editar/reordenar/remover; só Owner/Admin (perms). Erro de
   remoção-em-uso visível. Teste de componente.
6. **ClienteFormPage** — re-skin do formulário com TODOS os campos: selects de
   Origem/Status vindos de `opcoes`, multi-select de Serviços, datas (Período),
   URLs (Dashboard/Drive/Trello), Razão Social, CNPJ, Endereço, Observações.
   Validação. Testes adaptados (labels novos; manter contrato dos existentes).
7. **ClienteDetailPage** — exibir todos os campos agrupados (cartões: Identificação,
   Contato, Comercial, Links, Observação); badges de Serviços; criado/editado por.
8. **ClientesListPage** — filtros de status dinâmicos (das opções) + "Todos";
   badge neutra. Manter busca.
9. **Build + 31+ testes verdes + e2e** (atualizar `criar-cliente.mjs` p/ novos
   campos obrigatórios) local + prod. Limpar registros de teste.
10. **finishing-a-development-branch** — branch `p4-cliente-completo`, merge `main`
    → deploy. Validação Leonardo (desktop+mobile): cadastrar cliente real
    completo + gerenciar uma opção + tentar remover opção em uso (deve barrar).

## Riscos / gotchas

- **Migração de dados existentes**: clientes atuais têm `status` como texto
  ('Ativo'/'Inativo'); backfill p/ relation antes de trocar o campo, senão quebra
  a lista. Fazer com cuidado e backup.
- Passo 1/2 exige **superusuário PocketBase** (senha no gerenciador do Leonardo)
  — combinar como executar (Leonardo aplica no admin UI seguindo passo a passo,
  ou fornece credencial temporária).
- `created`/`updated` autodate: PocketBase 0.26 não cria sozinho (lição P2/P3).
- e2e: `criar-cliente.mjs` precisa preencher campos novos obrigatórios.
- Não usar `<Route>` pathless (lição hotfix P3).

## Critério de aceite

- [ ] Leonardo cadastra um cliente real com todos os campos do Notion.
- [ ] Leonardo adiciona/edita/reordena opções em Configurações sem código.
- [ ] Remover opção em uso é **bloqueado** com mensagem clara.
- [ ] Serviços multi; Origem/Status únicos.
- [ ] Clientes antigos continuam abrindo (migração ok).
- [ ] build + testes + e2e verdes (local e prod); validado desktop+mobile.
