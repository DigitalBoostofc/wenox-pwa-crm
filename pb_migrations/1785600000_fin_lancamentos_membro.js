/// <reference path="../pb_data/types.d.ts" />
/**
 * fin_lancamentos.membro → usuarios + list/view rule: Membro só vê os próprios (membro vazio ou self).
 */
migrate((app) => {
  const lancs = app.findCollectionByNameOrId('fin_lancamentos');
  const usuarios = app.findCollectionByNameOrId('usuarios');

  const hasMembro =
    typeof lancs.fields?.getByName === 'function'
      ? !!lancs.fields.getByName('membro')
      : (lancs.fields || []).some?.((f) => f.name === 'membro');

  if (!hasMembro) {
    const field = new Field({
      name: 'membro',
      type: 'relation',
      required: false,
      maxSelect: 1,
      collectionId: usuarios.id,
      cascadeDelete: false,
    });
    if (typeof lancs.fields?.add === 'function') {
      lancs.fields.add(field);
    } else {
      lancs.fields.push(field);
    }
  }

  const LEITURA_PRIV =
    '@request.auth.id != "" && @request.auth.role != "Cliente" && (@request.auth.role != "Membro" || membro = "" || membro = @request.auth.id)';
  lancs.listRule = LEITURA_PRIV;
  lancs.viewRule = LEITURA_PRIV;

  try {
    const idx = 'CREATE INDEX IF NOT EXISTS idx_finlanc_membro ON fin_lancamentos (membro)';
    if (!lancs.indexes) lancs.indexes = [];
    if (!lancs.indexes.some((i) => String(i).includes('idx_finlanc_membro'))) {
      lancs.indexes.push(idx);
    }
  } catch (_) {
    /* */
  }

  app.save(lancs);
}, (app) => {
  try {
    const lancs = app.findCollectionByNameOrId('fin_lancamentos');
    const LEITURA = '@request.auth.id != "" && @request.auth.role != "Cliente"';
    lancs.listRule = LEITURA;
    lancs.viewRule = LEITURA;
    if (typeof lancs.fields?.removeByName === 'function') {
      try {
        lancs.fields.removeByName('membro');
      } catch (_) {
        /* */
      }
    } else {
      const fields = lancs.fields || [];
      const i = fields.findIndex?.((f) => f.name === 'membro');
      if (i >= 0) fields.splice(i, 1);
    }
    app.save(lancs);
  } catch (_) {
    /* */
  }
});
