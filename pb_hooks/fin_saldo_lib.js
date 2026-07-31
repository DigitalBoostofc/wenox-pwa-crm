/// <reference path="../pb_data/types.d.ts" />
/**
 * Wenox — integridade de saldo (fin_saldo_lib.js).
 * Adaptado do Cleanox: saldo_atual só via incremento SQL atômico.
 * Campo relation da conta no lançamento: `conta` (não conta_id).
 */

function efeito(rec) {
  if (!rec) return 0;
  if (String(rec.get('status') || '') !== 'pago') return 0;
  const valor = Number(rec.get('valor') || 0);
  if (!isFinite(valor)) return 0;
  return String(rec.get('tipo') || '') === 'receita' ? valor : -valor;
}

function relId(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.length ? String(v[0]) : '';
  return String(v);
}

function snapshot(rec) {
  return {
    id: String(rec.id || ''),
    contaId: relId(rec.get('conta')),
    efeito: efeito(rec),
  };
}

function contaExiste(app, contaId) {
  const id = String(contaId || '');
  if (!id) return false;
  try {
    app.findRecordById('fin_contas', id);
    return true;
  } catch (_) {
    return false;
  }
}

function assertContaIncrementavel(app, kind, contaId, delta) {
  if (Math.round(Number(delta) * 100) !== 0 && !contaExiste(app, contaId)) {
    throw new BadRequestError(
      "Conta '" + (contaId || '?') + "' não encontrada (" + kind + '); lançamento não gravado.',
    );
  }
}

function assertCreateResolves(app, rec) {
  const s = snapshot(rec);
  assertContaIncrementavel(app, 'create', s.contaId, s.efeito);
}

function assertUpdateResolves(app, before, rec) {
  const after = snapshot(rec);
  if (before.contaId === after.contaId) {
    assertContaIncrementavel(app, 'update', after.contaId, after.efeito - before.efeito);
    return;
  }
  assertContaIncrementavel(app, 'update-estorno', before.contaId, -before.efeito);
  assertContaIncrementavel(app, 'update-aplica', after.contaId, after.efeito);
}

function failNoRows(app, kind, lancId, contaId, delta) {
  const msg =
    '[fin_saldo][SALDO-ORPHAN] (' + kind + ') lanc=' + (lancId || '?') +
    ' conta=' + (contaId || '?') + ' delta=' + delta;
  try { app.logger().error(msg); } catch (_) {}
  console.error(msg);
  throw new BadRequestError(
    "Conta '" + (contaId || '?') + "' não encontrada ao ajustar o saldo.",
  );
}

function incSaldo(app, contaId, delta) {
  const id = String(contaId || '');
  if (!id) return 0;
  const cents = Math.round(Number(delta) * 100);
  if (!cents) return 0;
  const now = new Date().toISOString().replace('T', ' ').slice(0, 23) + 'Z';
  const res = app.db()
    .newQuery(
      'UPDATE fin_contas SET saldo_atual = ROUND(COALESCE(saldo_atual, 0) + {:delta}, 2), updated = {:now} WHERE id = {:id}',
    )
    .bind({ delta: cents / 100, now: now, id: id })
    .execute();
  return res.rowsAffected();
}

function incSaldoOrThrow(app, kind, lancId, contaId, delta) {
  const affected = incSaldo(app, contaId, delta);
  if (affected === 0 && Math.round(Number(delta) * 100) !== 0) {
    failNoRows(app, kind, lancId, contaId, delta);
  }
  return affected;
}

function saldoAtual(app, contaId) {
  const conta = app.findRecordById('fin_contas', String(contaId));
  return Number(conta.get('saldo_atual') || 0);
}

function applyCreate(app, rec) {
  const s = snapshot(rec);
  if (s.efeito !== 0) incSaldoOrThrow(app, 'create', s.id, s.contaId, s.efeito);
}

function applyUpdate(app, before, rec) {
  const after = snapshot(rec);
  if (before.contaId === after.contaId) {
    const delta = after.efeito - before.efeito;
    if (delta !== 0) incSaldoOrThrow(app, 'update', after.id, after.contaId, delta);
    return;
  }
  app.runInTransaction((txApp) => {
    if (before.efeito !== 0) {
      incSaldoOrThrow(txApp, 'update-estorno', after.id, before.contaId, -before.efeito);
    }
    if (after.efeito !== 0) {
      incSaldoOrThrow(txApp, 'update-aplica', after.id, after.contaId, after.efeito);
    }
  });
}

function applyDelete(app, before) {
  if (before.efeito !== 0) {
    incSaldoOrThrow(app, 'delete', before.id, before.contaId, -before.efeito);
  }
}

/** Escrita: Owner / Admin / Gestor */
function assertFinWrite(e) {
  if (!e.auth) throw new UnauthorizedError('Autenticação necessária.');
  const role = String(e.auth.get('role') || '');
  if (role !== 'Owner' && role !== 'Admin' && role !== 'Gestor') {
    throw new ForbiddenError('Sem permissão para alterar o financeiro.');
  }
}

function ajusteConta(app, contaId, opts) {
  const id = String(contaId || '');
  if (!id) throw new BadRequestError('conta inválida.');
  let delta;
  if (opts && opts.delta != null) delta = Number(opts.delta);
  else if (opts && opts.novoSaldo != null) {
    delta = Number(opts.novoSaldo) - saldoAtual(app, id);
  } else throw new BadRequestError("Informe 'delta' ou 'novoSaldo'.");
  if (!isFinite(delta)) throw new BadRequestError('Valor de ajuste inválido.');
  const affected = incSaldo(app, id, delta);
  if (affected === 0 && Math.round(delta * 100) !== 0) {
    throw new BadRequestError("Conta '" + id + "' não encontrada.");
  }
  return saldoAtual(app, id);
}

function transferir(app, fromId, toId, valor) {
  const from = String(fromId || '');
  const to = String(toId || '');
  const v = Number(valor);
  if (!from || !to) throw new BadRequestError("Informe 'from' e 'to'.");
  if (from === to) throw new BadRequestError('Origem e destino iguais.');
  if (!isFinite(v) || v <= 0) throw new BadRequestError("'valor' deve ser > 0.");
  saldoAtual(app, from);
  saldoAtual(app, to);
  incSaldo(app, from, -v);
  incSaldo(app, to, v);
  return { fromSaldo: saldoAtual(app, from), toSaldo: saldoAtual(app, to) };
}

module.exports = {
  efeito,
  relId,
  snapshot,
  contaExiste,
  assertCreateResolves,
  assertUpdateResolves,
  applyCreate,
  applyUpdate,
  applyDelete,
  assertFinWrite,
  ajusteConta,
  transferir,
  incSaldo,
  saldoAtual,
};
