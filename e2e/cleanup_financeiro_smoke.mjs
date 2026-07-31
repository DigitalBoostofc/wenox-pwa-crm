/**
 * Limpa dados de smoke QA do financeiro no PocketBase.
 * Idempotente. Default: DRY-RUN (só imprime o que seria apagado).
 * Aplica deletes apenas com --apply.
 *
 * Credenciais (.env): VITE_PB_URL / PB_ADMIN_EMAIL / PB_ADMIN_SENHA
 *
 * Escopo:
 *   - fin_lancamentos: descricao starts with "QA Smoke"
 *     OR contains "Validacao pos-fix" OR starts with "Validacao pos-fix"
 *   - fin_contas: nome exato "Banco QA Smoke" ou "Banco Validar Tipo"
 *     somente se não restarem lançamentos vinculados
 *   - NUNCA apaga "Caixa principal"
 *
 * Uso:
 *   node e2e/cleanup_financeiro_smoke.mjs          # dry-run
 *   node e2e/cleanup_financeiro_smoke.mjs --apply  # deleta
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(resolve(__dirname, '..', '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* .env opcional se vars já estiverem no ambiente */
}

const BASE = process.env.VITE_PB_URL || 'https://api.wenox.com.br';
const EMAIL = process.env.PB_ADMIN_EMAIL ?? 'adm@wenox.com.br';
const SENHA = process.env.PB_ADMIN_SENHA;
if (!SENHA) {
  console.error('Defina PB_ADMIN_SENHA');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const CONTAS_SMOKE = new Set(['Banco QA Smoke', 'Banco Validar Tipo']);
const CONTAS_PROTEGIDAS = new Set(['Caixa principal']);

/** @type {string} */
let token = '';

async function auth() {
  const r = await fetch(`${BASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password: SENHA }),
  });
  const d = await r.json();
  if (!d.token) throw new Error('auth fail ' + JSON.stringify(d).slice(0, 200));
  token = d.token;
  console.log('[auth] ok');
}

async function pbListAll(col, filter = '', fields = '') {
  const PAGE = 200;
  let page = 1;
  /** @type {any[]} */
  const all = [];
  let total = Infinity;

  while (all.length < total) {
    let qs = `perPage=${PAGE}&page=${page}&skipTotal=0`;
    if (filter) qs += `&filter=${encodeURIComponent(filter)}`;
    if (fields) qs += `&fields=${encodeURIComponent(fields)}`;
    const r = await fetch(`${BASE}/api/collections/${col}/records?${qs}`, {
      headers: { Authorization: token },
    });
    if (!r.ok) throw new Error(`list ${col} ${r.status} ${await r.text()}`);
    const d = await r.json();
    const items = d.items || [];
    total = d.totalItems ?? items.length;
    all.push(...items);
    if (items.length < PAGE) break;
    page++;
  }
  return all;
}

async function pbDelete(col, id) {
  const r = await fetch(`${BASE}/api/collections/${col}/records/${id}`, {
    method: 'DELETE',
    headers: { Authorization: token },
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`DELETE ${col}/${id} ${r.status}: ${txt.slice(0, 200)}`);
  }
}

/**
 * Match de smoke em descricao (mesmas regras do requisito).
 * @param {string | null | undefined} descricao
 */
function isSmokeDescricao(descricao) {
  const d = String(descricao ?? '');
  if (d.startsWith('QA Smoke')) return true;
  if (d.includes('Validacao pos-fix')) return true;
  if (d.startsWith('Validacao pos-fix')) return true;
  return false;
}

/**
 * Filtro PocketBase aproximado (server-side); revalidamos client-side.
 * startsWith "Validacao pos-fix" ⊆ contains "Validacao pos-fix",
 * mas mantemos ambos por clareza do requisito.
 */
const LANC_FILTER =
  'descricao ~ "QA Smoke%" || descricao ~ "%Validacao pos-fix%" || descricao ~ "Validacao pos-fix%"';

async function main() {
  console.log('='.repeat(60));
  console.log('CLEANUP financeiro smoke QA');
  console.log(`mode: ${APPLY ? 'APPLY (delete real)' : 'DRY-RUN (sem deletes)'}`);
  console.log(`base: ${BASE}`);
  console.log('='.repeat(60));

  await auth();

  // ── 1. Lançamentos smoke ────────────────────────────────────────────────
  console.log('\n[1] Buscando fin_lancamentos smoke...');
  let candidatos = [];
  try {
    candidatos = await pbListAll(
      'fin_lancamentos',
      LANC_FILTER,
      'id,descricao,conta,valor,data,status',
    );
  } catch (e) {
    // Fallback: listar sem filtro se o operador ~ falhar em alguma versão
    console.warn('  filtro PB falhou, listando e filtrando client-side:', String(e.message || e).slice(0, 120));
    const all = await pbListAll('fin_lancamentos', '', 'id,descricao,conta,valor,data,status');
    candidatos = all.filter((x) => isSmokeDescricao(x.descricao));
  }

  const lancamentos = candidatos.filter((x) => isSmokeDescricao(x.descricao));
  console.log(`  → ${lancamentos.length} lançamento(s) a remover`);
  for (const l of lancamentos) {
    const desc = String(l.descricao ?? '').slice(0, 80);
    console.log(`    - ${l.id} | ${desc} | conta=${l.conta ?? '-'} | ${l.valor ?? ''} | ${l.status ?? ''}`);
  }

  let deletedLanc = 0;
  let failedLanc = 0;
  if (APPLY) {
    for (const l of lancamentos) {
      try {
        await pbDelete('fin_lancamentos', l.id);
        deletedLanc++;
      } catch (err) {
        failedLanc++;
        console.error(`    FAIL lanc ${l.id}: ${String(err.message || err).slice(0, 160)}`);
      }
    }
  }

  // ── 2. Contas smoke (só se sem lançamentos restantes) ───────────────────
  console.log('\n[2] Avaliando fin_contas smoke...');
  const contas = await pbListAll('fin_contas', '', 'id,nome,tipo,ativo');
  const contasAlvo = contas.filter((c) => CONTAS_SMOKE.has(String(c.nome ?? '')));
  const protegidasHit = contas.filter((c) => CONTAS_PROTEGIDAS.has(String(c.nome ?? '')));
  if (protegidasHit.length) {
    console.log(`  protegidas (não tocadas): ${protegidasHit.map((c) => c.nome).join(', ')}`);
  }

  // IDs de smoke que saem (ou já saíram em APPLY) — contas ficam deletáveis se só restarem esses
  const smokeIds = new Set(lancamentos.map((l) => l.id));

  /** @type {{ id: string, nome: string, remaining: number, action: string }[]} */
  const contaPlan = [];
  for (const c of contasAlvo) {
    const linked = await pbListAll(
      'fin_lancamentos',
      `conta = "${c.id}"`,
      'id,descricao',
    );
    // Após remoção dos smoke (prevista ou já feita), quantos lançamentos sobram?
    const remaining = APPLY
      ? linked // em APPLY os smoke já foram apagados; o que listar é o que sobrou
      : linked.filter((l) => !smokeIds.has(l.id) && !isSmokeDescricao(l.descricao));
    const n = remaining.length;
    let action = 'skip';
    if (CONTAS_PROTEGIDAS.has(c.nome)) {
      action = 'protected';
    } else if (n === 0) {
      action = APPLY ? 'delete' : 'would-delete';
    } else {
      action = `skip-has-${n}-lancamentos`;
    }
    contaPlan.push({ id: c.id, nome: c.nome, remaining: n, action });
    console.log(`    - ${c.id} | ${c.nome} | remaining_after_smoke=${n} | ${action}`);
  }
  if (!contasAlvo.length) {
    console.log('  → nenhuma conta smoke encontrada');
  }

  let deletedContas = 0;
  let skippedContas = 0;
  let failedContas = 0;
  for (const p of contaPlan) {
    if (p.action !== 'delete' && p.action !== 'would-delete') {
      skippedContas++;
      continue;
    }
    if (!APPLY) continue;
    try {
      await pbDelete('fin_contas', p.id);
      deletedContas++;
    } catch (err) {
      failedContas++;
      console.error(`    FAIL conta ${p.id}: ${String(err.message || err).slice(0, 160)}`);
    }
  }

  // ── 3. Summary ──────────────────────────────────────────────────────────
  const wouldDeleteContas = contaPlan.filter((p) => p.action === 'would-delete' || p.action === 'delete').length;
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log(`  mode:                  ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`  lancamentos matched:   ${lancamentos.length}`);
  console.log(`  lancamentos deleted:   ${APPLY ? deletedLanc : 0}${APPLY ? '' : ' (dry-run → 0)'}`);
  console.log(`  lancamentos failed:    ${failedLanc}`);
  console.log(`  contas matched:        ${contasAlvo.length}`);
  console.log(`  contas deletable:      ${wouldDeleteContas}`);
  console.log(`  contas deleted:        ${APPLY ? deletedContas : 0}${APPLY ? '' : ' (dry-run → 0)'}`);
  console.log(`  contas skipped:        ${skippedContas}`);
  console.log(`  contas failed:         ${failedContas}`);
  if (!APPLY) {
    console.log('\n  Re-run with --apply to delete.');
  }
  console.log('='.repeat(60));

  if (failedLanc || failedContas) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
