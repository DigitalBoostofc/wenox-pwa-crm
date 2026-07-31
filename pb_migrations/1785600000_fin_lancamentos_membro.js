/// <reference path="../pb_data/types.d.ts" />
/**
 * fin_lancamentos.membro → usuarios (salário / pró-labore).
 * Idempotente: só adiciona o campo se ainda não existir.
 */
migrate((app) => {
  const lancs = app.findCollectionByNameOrId('fin_lancamentos');
  const usuarios = app.findCollectionByNameOrId('usuarios');
  if (!lancs || !usuarios) {
    throw new Error('fin_lancamentos_membro: collections fin_lancamentos/usuarios ausentes');
  }
  const jaTem = (lancs.fields || []).some((f) => f.name === 'membro');
  if (jaTem) return;

  lancs.fields.push(
    new Field({
      name: 'membro',
      type: 'relation',
      required: false,
      maxSelect: 1,
      collectionId: usuarios.id,
      cascadeDelete: false,
    }),
  );
  // índice auxiliar
  try {
    const idx = 'CREATE INDEX IF NOT EXISTS idx_finlanc_membro ON fin_lancamentos (membro)';
    if (!lancs.indexes) lancs.indexes = [];
    if (!lancs.indexes.includes(idx) && !lancs.indexes.some((i) => String(i).includes('idx_finlanc_membro'))) {
      lancs.indexes.push(idx);
    }
  } catch (_) {
    /* indexes API varia entre versões */
  }
  app.save(lancs);
}, (app) => {
  try {
    const lancs = app.findCollectionByNameOrId('fin_lancamentos');
    if (!lancs) return;
    const fields = lancs.fields || [];
    const i = fields.findIndex((f) => f.name === 'membro');
    if (i >= 0) {
      fields.splice(i, 1);
      lancs.fields = fields;
      app.save(lancs);
    }
  } catch (_) {
    /* */
  }
});
