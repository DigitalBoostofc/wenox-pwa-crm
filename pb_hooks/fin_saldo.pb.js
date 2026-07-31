/// <reference path="../pb_data/types.d.ts" />
/**
 * Wenox — hooks de saldo em fin_lancamentos + guarda saldo_atual em fin_contas.
 */

onRecordCreate((e) => {
  const lib = require(`${__hooks}/fin_saldo_lib.js`);
  lib.assertCreateResolves(e.app, e.record);
  e.next();
  try {
    lib.applyCreate(e.app, e.record);
  } catch (err) {
    console.error('[fin_saldo] create ' + e.record.id + ': ' + err);
    throw err;
  }
}, 'fin_lancamentos');

onRecordUpdate((e) => {
  const lib = require(`${__hooks}/fin_saldo_lib.js`);
  const orig = e.record.original ? e.record.original() : null;
  const before = orig ? lib.snapshot(orig) : { contaId: '', efeito: 0 };
  lib.assertUpdateResolves(e.app, before, e.record);
  e.next();
  try {
    lib.applyUpdate(e.app, before, e.record);
  } catch (err) {
    console.error('[fin_saldo] update ' + e.record.id + ': ' + err);
    throw err;
  }
}, 'fin_lancamentos');

onRecordDelete((e) => {
  const lib = require(`${__hooks}/fin_saldo_lib.js`);
  const before = lib.snapshot(e.record);
  const precisa = before.efeito !== 0;
  const viva = precisa && lib.contaExiste(e.app, before.contaId);
  e.next();
  if (precisa && !viva) {
    console.error('[fin_saldo] delete sem conta viva ' + before.id);
    return;
  }
  try {
    lib.applyDelete(e.app, before);
  } catch (err) {
    console.error('[fin_saldo] delete ' + e.record.id + ': ' + err);
    throw err;
  }
}, 'fin_lancamentos');

// Cliente não grava saldo_atual direto
onRecordUpdateRequest((e) => {
  const orig = e.record.original ? e.record.original() : null;
  if (orig) {
    const antes = Number(orig.get('saldo_atual') || 0);
    const depois = Number(e.record.get('saldo_atual') || 0);
    if (Math.round(antes * 100) !== Math.round(depois * 100)) {
      e.record.set('saldo_atual', antes);
    }
  }
  e.next();
}, 'fin_contas');

// Abertura de conta: saldo_atual = saldo_inicial se não informado
onRecordCreateRequest((e) => {
  const ini = Number(e.record.get('saldo_inicial') || 0);
  const at = e.record.get('saldo_atual');
  if (at == null || at === '' || Number(at) === 0) {
    e.record.set('saldo_atual', isFinite(ini) ? ini : 0);
  }
  if (e.record.get('ativo') == null || e.record.get('ativo') === '') {
    e.record.set('ativo', true);
  }
  e.next();
}, 'fin_contas');
