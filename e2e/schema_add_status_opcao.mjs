/**
 * schema_add_status_opcao.mjs
 *
 * Adiciona o campo `status_opcao` (type text, opcional) às coleções `tarefas`
 * e `cartoes` em produção — fonte de verdade do status no modelo global
 * (grupos+opções). O PocketBase descarta silenciosamente campos fora do
 * schema, então sem este campo o backfill e a UI (F2) não persistem nada.
 *
 * Idempotente: verifica se o campo já existe antes de criar. NÃO commita
 * credenciais, NÃO altera regras nem outros campos.
 *
 * Como rodar:
 *   PB_ADMIN_SENHA=<senha> node e2e/schema_add_status_opcao.mjs
 */

const BASE_API = 'https://api.wenox.com.br';
const PB_ADMIN_EMAIL = process.env.PB_ADMIN ?? 'adm@wenox.com.br';
const PB_ADMIN_SENHA = process.env.PB_ADMIN_SENHA ?? '';
const COLECOES = ['tarefas', 'cartoes'];

if (!PB_ADMIN_SENHA) {
  console.error('[erro] Defina PB_ADMIN_SENHA como variável de ambiente.');
  process.exit(1);
}

let pbToken = null;

async function authPB() {
  const r = await fetch(`${BASE_API}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_ADMIN_EMAIL, password: PB_ADMIN_SENHA }),
  });
  if (!r.ok) throw new Error(`Auth falhou: ${r.status} ${await r.text()}`);
  const data = await r.json();
  pbToken = data.token;
  console.log('[auth] superuser autenticado');
}

async function getCollection(name) {
  const r = await fetch(`${BASE_API}/api/collections/${name}`, {
    headers: { Authorization: pbToken },
  });
  if (!r.ok) throw new Error(`GET collection ${name} falhou: ${r.status} ${await r.text()}`);
  return r.json();
}

async function updateCollection(name, payload) {
  const r = await fetch(`${BASE_API}/api/collections/${name}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: pbToken },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`PATCH collection ${name} falhou: ${r.status} ${await r.text()}`);
  return r.json();
}

async function addStatusOpcao(name) {
  const col = await getCollection(name);
  const fields = col.fields ?? col.schema ?? [];

  if (fields.some((f) => f.name === 'status_opcao')) {
    console.log(`[ok] ${name}: campo status_opcao já existe — nada a fazer.`);
    return;
  }

  console.log(`[schema] ${name}: adicionando campo status_opcao...`);
  const novosCampos = [
    ...fields,
    {
      name: 'status_opcao',
      type: 'text',
      required: false,
      options: { min: null, max: null, pattern: '' },
    },
  ];

  const updated = await updateCollection(name, { fields: novosCampos });
  const criado = (updated.fields ?? updated.schema ?? []).find((f) => f.name === 'status_opcao');
  if (criado) console.log(`[ok] ${name}: status_opcao criado (id=${criado.id})`);
  else console.warn(`[aviso] ${name}: PATCH ok mas campo não encontrado na resposta.`);
}

async function main() {
  await authPB();
  for (const c of COLECOES) await addStatusOpcao(c);
  console.log('=== FIM ===');
}

main().catch((err) => { console.error('[erro]', err.message); process.exit(1); });
