// ATENÇÃO: este repo NÃO possui pipeline de migrations automático.
// O CI/CD (deploy.yml) copia apenas pb_hooks/ via docker cp e NÃO aplica migrations.
// Esta coleção PRECISA ser criada/aplicada MANUALMENTE no admin do PocketBase de produção:
//   https://api.wenox.com.br/_/ → Collections → Import collections (JSON abaixo)
//   OU via CLI: pocketbase migrate up  (dentro do container)
//
// O robô n8n e o toggle de recorrência dependem dos nomes de campo aqui definidos —
// NÃO renomeie os campos sem atualizar o workflow n8n correspondente.

/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const quadrosCol = app.findCollectionByNameOrId("quadros");
  const collection = new Collection({
    name: "recorrencias_mes",
    type: "base",
    fields: [
      {
        name: "quadro",
        type: "relation",
        required: true,
        options: {
          collectionId: quadrosCol.id,
          cascadeDelete: true,
          maxSelect: 1,
          minSelect: 1,
        },
      },
      {
        name: "ativa",
        type: "bool",
        options: { default: true },
      },
      {
        name: "padrao_posts",
        type: "text",
        // valores esperados: 'padrao8' | 'padrao12' | 'personalizado'
      },
      {
        name: "qtd_custom",
        type: "number",
      },
      {
        name: "dias_custom",
        type: "json",
        // number[] ex.: [2, 4]
      },
      {
        name: "design_id",
        type: "text",
        // id do usuário responsável de Design (não relation para evitar cascade)
      },
      {
        name: "social_id",
        type: "text",
        // id do usuário responsável de Social Media
      },
      {
        name: "ultimo_mes",
        type: "number",
        required: true,
        // 1-12: último mês gerado (seed = mês do modal na ativação)
      },
      {
        name: "ultimo_ano",
        type: "number",
        required: true,
      },
    ],
    indexes: [
      // índice único: uma config por quadro
      "CREATE UNIQUE INDEX idx_recorrencias_mes_quadro ON recorrencias_mes (quadro)",
    ],
  });

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("recorrencias_mes");
  app.delete(collection);
});
