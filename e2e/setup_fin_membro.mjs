/**
 * Garante campo fin_lancamentos.membro → usuarios no PB (prod/local).
 * Idempotente. Credenciais: .env PB_ADMIN_* / VITE_PB_URL
 *
 *   node e2e/setup_fin_membro.mjs
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
  /* */
}

const BASE = process.env.VITE_PB_URL || 'https://api.wenox.com.br';
const EMAIL = process.env.PB_ADMIN_EMAIL ?? 'adm@wenox.com.br';
const SENHA = process.env.PB_ADMIN_SENHA;
if (!SENHA) {
  console.error('Defina PB_ADMIN_SENHA');
  process.exit(1);
}

async function main() {
  const auth = await fetch(`${BASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password: SENHA }),
  }).then((r) => r.json());
  if (!auth.token) throw new Error('auth fail ' + JSON.stringify(auth).slice(0, 200));
  const tok = auth.token;
  console.log('[auth] ok');

  const lancs = await fetch(`${BASE}/api/collections/fin_lancamentos`, {
    headers: { Authorization: tok },
  }).then((r) => r.json());
  const users = await fetch(`${BASE}/api/collections/usuarios`, {
    headers: { Authorization: tok },
  }).then((r) => r.json());
  if (!lancs?.id || !users?.id) throw new Error('collections missing');

  const fields = lancs.fields || [];
  if (fields.some((f) => f.name === 'membro')) {
    console.log('[skip] campo membro já existe');
    return;
  }

  fields.push({
    name: 'membro',
    type: 'relation',
    required: false,
    maxSelect: 1,
    collectionId: users.id,
    cascadeDelete: false,
    presentable: false,
    system: false,
    hidden: false,
  });

  const indexes = Array.isArray(lancs.indexes) ? [...lancs.indexes] : [];
  const idx = 'CREATE INDEX IF NOT EXISTS idx_finlanc_membro ON fin_lancamentos (membro)';
  if (!indexes.some((i) => String(i).includes('idx_finlanc_membro'))) indexes.push(idx);

  const body = { ...lancs, fields, indexes };
  const r = await fetch(`${BASE}/api/collections/${lancs.id}`, {
    method: 'PATCH',
    headers: { Authorization: tok, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH fin_lancamentos ${r.status} ${await r.text()}`);
  console.log('[ok] campo membro adicionado em fin_lancamentos');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
