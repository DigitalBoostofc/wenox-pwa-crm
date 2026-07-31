/**
 * Garante campo fin_lancamentos.membro → usuarios e rules de privacidade Membro.
 * Idempotente. Body mínimo (só fields/indexes/rules tocados).
 *
 *   node e2e/setup_fin_membro.mjs
 *   node e2e/setup_fin_membro.mjs --prod   # alias (mesmo default se VITE_PB_URL for prod)
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

/** Membro não lista/vê lançamentos de salário de outros (membro preenchido ≠ self). */
const LEITURA_PRIV =
  '@request.auth.id != "" && @request.auth.role != "Cliente" && (@request.auth.role != "Membro" || membro = "" || membro = @request.auth.id)';
const ESCRITA =
  '@request.auth.id != "" && (@request.auth.role = "Owner" || @request.auth.role = "Admin" || @request.auth.role = "Gestor")';

async function main() {
  const auth = await fetch(`${BASE}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password: SENHA }),
  }).then((r) => r.json());
  if (!auth.token) throw new Error('auth fail ' + JSON.stringify(auth).slice(0, 200));
  const tok = auth.token;
  console.log('[auth] ok', BASE);

  const lancs = await fetch(`${BASE}/api/collections/fin_lancamentos`, {
    headers: { Authorization: tok },
  }).then((r) => r.json());
  const users = await fetch(`${BASE}/api/collections/usuarios`, {
    headers: { Authorization: tok },
  }).then((r) => r.json());
  if (!lancs?.id || !users?.id) throw new Error('collections missing');

  const fields = [...(lancs.fields || [])];
  let touched = false;
  if (!fields.some((f) => f.name === 'membro')) {
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
    touched = true;
    console.log('[+] campo membro');
  } else {
    console.log('[skip] campo membro já existe');
  }

  const indexes = Array.isArray(lancs.indexes) ? [...lancs.indexes] : [];
  const idx = 'CREATE INDEX IF NOT EXISTS idx_finlanc_membro ON fin_lancamentos (membro)';
  if (!indexes.some((i) => String(i).includes('idx_finlanc_membro'))) {
    indexes.push(idx);
    touched = true;
  }

  const patch = {
    fields,
    indexes,
    listRule: LEITURA_PRIV,
    viewRule: LEITURA_PRIV,
    // create/update/delete inalterados se já corretos — reforça escrita
    createRule: lancs.createRule || ESCRITA,
    updateRule: lancs.updateRule || ESCRITA,
    deleteRule: lancs.deleteRule || ESCRITA,
  };

  if (
    lancs.listRule !== LEITURA_PRIV ||
    lancs.viewRule !== LEITURA_PRIV ||
    touched
  ) {
    const r = await fetch(`${BASE}/api/collections/${lancs.id}`, {
      method: 'PATCH',
      headers: { Authorization: tok, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(`PATCH fin_lancamentos ${r.status} ${await r.text()}`);
    console.log('[ok] fin_lancamentos atualizado (membro + list/view rule privacidade)');
  } else {
    console.log('[ok] já atualizado');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
