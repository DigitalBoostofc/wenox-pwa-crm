# Deploy de PocketBase Hooks

## Por que este hook NÃO entra em produção pelo CI/Docker

O pipeline de CI/CD desta aplicação builda apenas o frontend (Vite → nginx). O PocketBase corre separado — em um VPS ou EasyPanel — e **não é reconstruído pelo pipeline**. Portanto, qualquer arquivo em `pb_hooks/` só chega ao servidor via deploy manual.

Enquanto o hook `pb_hooks/tarefas_cascade.pb.js` não estiver ativo no servidor, o único cleanup ativo é o bloco client-side em `src/tarefas/tarefasService.ts::removerTarefa` — e ele opera **silenciosamente** para usuários sem permissão de delete nas coleções auxiliares.

---

## Deploy automatizado (CI)

A partir de agora o `deploy.yml` copia automaticamente o diretório `pb_hooks/` para o container do PocketBase e o reinicia, em todo push na branch `main` — **após** o deploy do frontend.

### Pré-requisito (configuração única)

Defina 2 **repo variables** no GitHub (Settings → Secrets and variables → Actions → aba **Variables**):

| Variable | Descrição | Exemplo |
|---|---|---|
| `PB_CONTAINER` | Nome do container do PocketBase no VPS (descubra com `sudo docker ps` no VPS) | `easypanel-pocketbase-1` |
| `PB_HOOKS_PATH` | Caminho do `pb_hooks/` dentro do container | `/pb/pb_hooks` (padrão; pode omitir) |

### Comportamento enquanto não configurado

Enquanto `PB_CONTAINER` não estiver definida, o step emite um `::warning::` visível no log da Action e encerra normalmente — **não quebra o deploy do frontend** (`continue-on-error: true`).

### ⚠️ Caveat: recriação de container pelo EasyPanel

Se o EasyPanel **recriar** o container (atualização de versão, restart de stack), os hooks copiados via `docker cp` se perdem até o próximo push na `main`. Para persistência total, monte `pb_hooks/` como **volume** no EasyPanel apontando para o caminho configurado em `PB_HOOKS_PATH`.

---

## Passo a passo: deploy manual do hook (FALLBACK)

> Use esta seção apenas se o deploy automatizado via CI não estiver configurado (ver seção acima).

1. **Acesse o VPS / painel EasyPanel** onde o PocketBase está rodando.

2. **Copie o arquivo** para o diretório `pb_hooks/` da instância:

   ```bash
   cp pb_hooks/tarefas_cascade.pb.js /path/to/pocketbase/pb_hooks/tarefas_cascade.pb.js
   ```

   Substitua `/path/to/pocketbase/` pelo caminho real da instalação PocketBase no servidor.

3. **Reinicie o serviço PocketBase** para que o hook seja carregado:

   ```bash
   # Exemplo com systemd
   sudo systemctl restart pocketbase

   # Exemplo com Docker / EasyPanel
   docker restart <nome-do-container-pocketbase>
   ```

4. **Verifique nos logs do PocketBase** que o hook carregou sem erros:

   ```
   # Procure por algo semelhante a:
   # hooks/tarefas_cascade.pb.js loaded
   # ou ausência de erros de sintaxe JSVM
   ```

   Qualquer erro de sintaxe JS aparecerá na inicialização do PocketBase.

5. **Confirme o comportamento**: delete uma tarefa de teste e valide que os registros órfãos em `comentarios`, `historico`, `listas` e `notificacoes` foram limpos.

---

## Checklist para o PR

Copie e cole no corpo do PR ao fazer o deploy:

- [ ] Arquivo `pb_hooks/tarefas_cascade.pb.js` copiado para o servidor PocketBase
- [ ] Serviço PocketBase reiniciado
- [ ] Logs do PocketBase inspecionados — hook carregou sem erros de sintaxe JSVM
- [ ] Teste manual: deletar uma tarefa e confirmar limpeza dos órfãos
- [ ] Bloco client-side em `removerTarefa` marcado para remoção (`TODO(cascade)`) — pode ser removido em PR subsequente após confirmar o hook estável em produção

---

## Aviso importante

Até o hook estar ativo no servidor, **somente o cleanup client-side atua** — e apenas para usuários com permissão de delete nas coleções `comentarios`, `historico`, `listas` e `notificacoes`. Usuários sem essa permissão terão órfãos não limpos. O hook server-side resolve isso porque roda com privilégios de admin do PocketBase.
