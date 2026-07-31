/**
 * Cria collections fin_* + seed mínimo no PocketBase (prod/local).
 * Idempotente. Credenciais: .env PB_ADMIN_EMAIL / PB_ADMIN_SENHA / VITE_PB_URL
 *
 *   node e2e/setup_financeiro.mjs
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
} catch { /* */ }

const BASE = process.env.VITE_PB_URL || 'https://api.wenox.com.br';
const EMAIL = process.env.PB_ADMIN_EMAIL ?? 'adm@wenox.com.br';
const SENHA = process.env.PB_ADMIN_SENHA;
if (!SENHA) {
  console.error('Defina PB_ADMIN_SENHA');
  process.exit(1);
}

const LEITURA = '@request.auth.id != "" && @request.auth.role != "Cliente"';
const ESCRITA =
  '@request.auth.id != "" && (@request.auth.role = "Owner" || @request.auth.role = "Admin" || @request.auth.role = "Gestor")';

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

async function getCol(name) {
  const r = await fetch(`${BASE}/api/collections/${name}`, {
    headers: { Authorization: token },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GET ${name} ${r.status} ${await r.text()}`);
  return r.json();
}

async function createCol(body) {
  const r = await fetch(`${BASE}/api/collections`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST collection ${body.name} ${r.status} ${await r.text()}`);
  return r.json();
}

async function pbCreate(col, data) {
  const r = await fetch(`${BASE}/api/collections/${col}/records`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(`create ${col} ${r.status} ${await r.text()}`);
  return r.json();
}

async function pbList(col, filter = '') {
  let qs = 'perPage=200';
  if (filter) qs += `&filter=${encodeURIComponent(filter)}`;
  const r = await fetch(`${BASE}/api/collections/${col}/records?${qs}`, {
    headers: { Authorization: token },
  });
  if (!r.ok) throw new Error(`list ${col} ${r.status}`);
  return (await r.json()).items || [];
}

function text(name, required = false, max = 0) {
  return { name, type: 'text', required, max: max || undefined };
}
function num(name, required = false) {
  return { name, type: 'number', required };
}
function bool(name) {
  return { name, type: 'bool', required: false };
}
function sel(name, values, required = true) {
  return { name, type: 'select', required, maxSelect: 1, values };
}
function date(name, required = false) {
  return { name, type: 'date', required };
}
function json(name) {
  return { name, type: 'json', required: false };
}
function rel(name, collectionId, required = false) {
  return {
    name,
    type: 'relation',
    required,
    maxSelect: 1,
    collectionId,
    cascadeDelete: false,
  };
}
function autodate(name, onUpdate = false) {
  return { name, type: 'autodate', onCreate: true, onUpdate };
}

async function main() {
  await auth();

  const clientes = await getCol('clientes');
  const projetos = await getCol('projetos');
  if (!clientes || !projetos) throw new Error('clientes/projetos ausentes');

  let contas = await getCol('fin_contas');
  if (!contas) {
    console.log('[create] fin_contas');
    contas = await createCol({
      name: 'fin_contas',
      type: 'base',
      listRule: LEITURA,
      viewRule: LEITURA,
      createRule: ESCRITA,
      updateRule: ESCRITA,
      deleteRule: ESCRITA,
      fields: [
        text('nome', true, 100),
        sel('tipo', ['carteira', 'banco', 'cartao', 'caixa'], true),
        num('saldo_inicial'),
        num('saldo_atual'),
        bool('ativo'),
        text('cor', false, 20),
        text('icone', false, 60),
        bool('padrao'),
        autodate('created'),
        autodate('updated', true),
      ],
    });
  } else console.log('[ok] fin_contas existe');

  let cats = await getCol('fin_categorias');
  if (!cats) {
    console.log('[create] fin_categorias');
    cats = await createCol({
      name: 'fin_categorias',
      type: 'base',
      listRule: LEITURA,
      viewRule: LEITURA,
      createRule: ESCRITA,
      updateRule: ESCRITA,
      deleteRule: ESCRITA,
      fields: [
        text('nome', true, 100),
        sel('tipo', ['receita', 'despesa'], true),
        text('icone', false, 60),
        text('cor', false, 20),
        text('parent_id', false, 50),
        bool('arquivada'),
        bool('sistema'),
        autodate('created'),
        autodate('updated', true),
      ],
    });
  } else console.log('[ok] fin_categorias existe');

  let lanc = await getCol('fin_lancamentos');
  if (!lanc) {
    console.log('[create] fin_lancamentos');
    lanc = await createCol({
      name: 'fin_lancamentos',
      type: 'base',
      listRule: LEITURA,
      viewRule: LEITURA,
      createRule: ESCRITA,
      updateRule: ESCRITA,
      deleteRule: ESCRITA,
      indexes: [
        'CREATE INDEX idx_finlanc_data ON fin_lancamentos (data)',
        'CREATE INDEX idx_finlanc_status ON fin_lancamentos (status)',
        'CREATE INDEX idx_finlanc_conta ON fin_lancamentos (conta)',
        'CREATE INDEX idx_finlanc_cliente ON fin_lancamentos (cliente)',
        'CREATE INDEX idx_finlanc_serie ON fin_lancamentos (serie_id)',
      ],
      fields: [
        sel('tipo', ['receita', 'despesa'], true),
        text('descricao', true, 500),
        rel('categoria', cats.id, true),
        num('valor', true),
        rel('conta', contas.id, true),
        date('data', true),
        date('vencimento', false),
        sel('status', ['pago', 'pendente', 'previsto', 'em_atraso'], true),
        sel('recorrencia', ['unica', 'fixa', 'recorrente', 'parcelada'], true),
        sel('frequencia', ['mensal', 'semanal', 'quinzenal', 'anual'], false),
        num('parcela_atual'),
        num('parcelas_total'),
        text('serie_id', false, 40),
        sel('origem', ['manual', 'via_projeto', 'via_contrato', 'transferencia', 'ajuste'], true),
        rel('cliente', clientes.id, false),
        rel('projeto', projetos.id, false),
        text('forma_pagamento', false, 100),
        text('observacao', false, 1000),
        json('tags'),
        json('anexos'),
        autodate('created'),
        autodate('updated', true),
      ],
    });
  } else console.log('[ok] fin_lancamentos existe');

  // seed categorias
  const seedCats = [
    { nome: 'Serviços de clientes', tipo: 'receita', sistema: true },
    { nome: 'Mensalidade / retainer', tipo: 'receita', sistema: true },
    { nome: 'Outras receitas', tipo: 'receita', sistema: true },
    { nome: 'Salários e pró-labore', tipo: 'despesa', sistema: true },
    { nome: 'Ferramentas e software', tipo: 'despesa', sistema: true },
    { nome: 'Impostos e taxas', tipo: 'despesa', sistema: true },
    { nome: 'Marketing e anúncios', tipo: 'despesa', sistema: true },
    { nome: 'Freelancers / terceiros', tipo: 'despesa', sistema: true },
    { nome: 'Transferência', tipo: 'despesa', sistema: true },
    { nome: 'Transferência recebida', tipo: 'receita', sistema: true },
    { nome: 'Ajuste de saldo', tipo: 'receita', sistema: true },
    { nome: 'Ajuste de saldo (saída)', tipo: 'despesa', sistema: true },
  ];
  const existentes = await pbList('fin_categorias');
  const nomes = new Set(existentes.map((c) => `${c.tipo}|${c.nome}`));
  for (const s of seedCats) {
    const k = `${s.tipo}|${s.nome}`;
    if (nomes.has(k)) continue;
    await pbCreate('fin_categorias', { ...s, arquivada: false });
    console.log('[seed] categoria', s.nome);
  }

  const contasList = await pbList('fin_contas');
  if (!contasList.length) {
    await pbCreate('fin_contas', {
      nome: 'Caixa principal',
      tipo: 'caixa',
      saldo_inicial: 0,
      saldo_atual: 0,
      ativo: true,
      padrao: true,
      cor: '#8b5cf6',
    });
    console.log('[seed] conta Caixa principal');
  }

  console.log('=== setup financeiro OK ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
