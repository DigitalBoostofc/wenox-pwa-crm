# Recorrência mensal de Social Media — contrato do robô n8n

> A geração automática das tarefas mensais de Social Media é feita por um
> **workflow n8n agendado** (fora deste repositório). Este documento é o
> **contrato**: o que o robô lê/escreve. Se mudar os campos aqui, atualize o
> workflow no n8n — senão a recorrência quebra silenciosamente.

## Visão geral

- **Tipo de tarefa:** `Social Media`.
- **Modelo:** produção adiantada. No mês **N** produz-se o conteúdo **referente ao mês N+1**.
  Ex.: em **1/julho** nasce a tarefa "AGOSTO — Cliente — Social Media", com janela de produção **01/jul → 31/jul**.
- **Janela:** `data_inicio` = dia 1 do mês de produção; `prazo` = último dia do mês de produção (o "fim" reaproveita o campo `prazo` que já existia).
- **Independente de conclusão:** a tarefa nasce no dia 1 **mesmo que a do mês anterior não esteja concluída**. A anterior, se não concluída, aparece como **atrasada** automaticamente (atraso é derivado: `prazo < hoje` e não concluída) — o robô não precisa mexer no status dela.
- **Série (fonte de verdade):** **1 tarefa por PROJETO de Social Media ATIVO por mês**. O robô itera os projetos de Social Media ativos e deduplica por `(projeto, mês de produção)`.

## App (já implementado neste repo)

- Coleção `tarefas` ganhou o campo **`data_inicio`** (date). Fim = `prazo`.
- Ao criar manualmente uma tarefa com `tipo = 'Social Media'`, o app já seta
  `recorrencia = 'mensal'`, `data_inicio` = dia 1 e `prazo` = último dia do mês de produção
  (helper `janelaMesProducao` em `src/tarefas/tarefasService.ts`).
- O motor antigo "gera a próxima ocorrência ao concluir" **NÃO** roda para `tipo = 'Social Media'`
  (guard em `criarProximaOcorrencia`) — quem gera o Social Media é este robô, para não duplicar.
- Recorrências não-Social-Media (semanal/quinzenal/mensal manual) continuam no "gera ao concluir".

## O que o robô deve fazer

**Trigger:** cron, **dia 1 de cada mês, 00:01** (fuso America/Sao_Paulo).

**Autenticação:** usuário robô `automacao@wenox.com.br` (mesmas credenciais/permissões já usadas).
Precisa de `list/view` em `projetos`/`clientes` e `create` em `tarefas`.

**Passos:**

1. Calcular o **mês de produção** = mês atual (`N`), e o **mês de referência** = `N+1`.
   - `data_inicio` = `AAAA-N-01`
   - `prazo` = `AAAA-N-<último dia de N>`
2. Listar **projetos de Social Media ATIVOS**.
   - Ativo = `status` NÃO em `{Inativo, Offboarding, Concluído, Concluido}` (mesma regra de `src/projetos/relacaoTarefa.ts`).
   - Filtrar tipo Social Media conforme o schema de `projetos` (campo `tipo`).
3. Para cada projeto, **deduplicar**: pular se já existir tarefa com
   `tipo='Social Media' && projeto=<id> && data_inicio=<AAAA-N-01>` (evita reccriar se o robô rodar 2x).
4. Criar a tarefa (`POST /api/collections/tarefas/records`) com:

```jsonc
{
  "nome": "<MÊS_REFERÊNCIA em MAIÚsculas> - <CLIENTE> - SOCIAL MEDIA",  // ex.: "AGOSTO - GOLDTECH - SOCIAL MEDIA"
  "tipo": "Social Media",
  "cliente": "<id do cliente do projeto>",
  "projeto": "<id do projeto>",
  "lado": "wenox",
  "responsaveis": ["<ids responsáveis do projeto, se houver>"],
  "recorrencia": "mensal",
  "data_inicio": "AAAA-N-01",
  "prazo": "AAAA-N-<último dia>",
  "status_opcao": "<id da opção inicial de status>",   // opcional; se omitir, o app trata como inicial
  "etapas": [],
  "ordem": 0
}
```

5. (Opcional) Notificar os responsáveis — o app já dispara notificação quando a tarefa
   é criada via UI, mas via API direta você pode replicar se quiser.

## Observações

- **NÃO** apagar/alterar a tarefa do mês anterior. Ela fica como está (atrasada se não concluída).
- Se `responsaveis` do projeto não existir, criar sem responsáveis (o gestor atribui depois).
- A coleção legada `recorrencias_mes` (do antigo sistema de quadros) **não** é usada aqui — pode
  ficar parada ou ser aposentada; o workflow antigo de recorrência de quadros deve ser desligado.
