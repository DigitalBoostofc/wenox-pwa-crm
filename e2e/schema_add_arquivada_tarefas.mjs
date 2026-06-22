/**
 * schema_add_arquivada_tarefas.mjs
 *
 * Adiciona campo `arquivada` (type bool, opcional, default false) à coleção `tarefas`
 * em produção. Idempotente: verifica se o campo já existe antes de criar.
 *
 * NÃO commita. NÃO imprime credenciais. NÃO altera regras nem outros campos.
 *
 * Como rodar:
 *   PB_ADMIN_SENHA=<senha> node e2e/schema_add_arquivada_tarefas.mjs
 */

const BASE_API = 'https://api.wenox.com.br';
const PB_ADMIN_EMAIL = process.env.PB_ADMIN ?? 'adm@wenox.com.br';
const PB_ADMIN_SENHA = process.env.PB_ADMIN_SENHA ?? '';

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
  if (!r.ok) throw new Error(`GET collection falhou: ${r.status} ${await r.text()}`);
  return r.json();
}

async function updateCollection(name, payload) {
  const r = await fetch(`${BASE_API}/api/collections/${name}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: pbToken },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`PATCH collection falhou: ${r.status} ${await r.text()}`);
  return r.json();
}

async function main() {
  await authPB();

  const col = await getCollection('tarefas');
  const fields = col.fields ?? col.schema ?? [];

  const jaExiste = fields.some((f) => f.name === 'arquivada');
  if (jaExiste) {
    console.log('[ok] Campo arquivada já existe em tarefas — nada a fazer.');
    return;
  }

  console.log('[schema] Adicionando campo arquivada a tarefas...');
  const novosCampos = [
    ...fields,
    {
      name: 'arquivada',
      type: 'bool',
      required: false,
    },
  ];

  const updated = await updateCollection('tarefas', { fields: novosCampos });
  const criado = (updated.fields ?? updated.schema ?? []).find((f) => f.name === 'arquivada');
  if (criado) {
    console.log(`[ok] Campo arquivada criado com id=${criado.id}`);
  } else {
    console.warn('[aviso] PATCH retornou sucesso mas campo não encontrado na resposta.');
  }
}

main().catch((err) => { console.error('[erro]', err.message); process.exit(1); });
