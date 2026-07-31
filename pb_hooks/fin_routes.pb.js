/// <reference path="../pb_data/types.d.ts" />
/**
 * Wenox — rotas auxiliares do financeiro.
 * POST /api/wenox/fin/conta/{id}/ajuste  { delta | novoSaldo }
 * POST /api/wenox/fin/transferencia      { from, to, valor }
 */

routerAdd('POST', '/api/wenox/fin/conta/{id}/ajuste', (e) => {
  const lib = require(`${__hooks}/fin_saldo_lib.js`);
  lib.assertFinWrite(e);
  const contaId = e.request.pathValue('id');
  const body = e.requestInfo().body || {};
  if (body.delta == null && body.novoSaldo == null) {
    throw new BadRequestError("Informe 'delta' ou 'novoSaldo'.");
  }
  let novoSaldo;
  $app.runInTransaction((txApp) => {
    novoSaldo = lib.ajusteConta(txApp, contaId, {
      delta: body.delta,
      novoSaldo: body.novoSaldo,
    });
  });
  return e.json(200, { ok: true, conta_id: String(contaId), saldo_atual: novoSaldo });
}, $apis.requireAuth());

routerAdd('POST', '/api/wenox/fin/transferencia', (e) => {
  const lib = require(`${__hooks}/fin_saldo_lib.js`);
  lib.assertFinWrite(e);
  const body = e.requestInfo().body || {};
  let out;
  $app.runInTransaction((txApp) => {
    out = lib.transferir(txApp, body.from, body.to, body.valor);
  });
  return e.json(200, {
    ok: true,
    from: { conta_id: String(body.from), saldo_atual: out.fromSaldo },
    to: { conta_id: String(body.to), saldo_atual: out.toSaldo },
  });
}, $apis.requireAuth());
