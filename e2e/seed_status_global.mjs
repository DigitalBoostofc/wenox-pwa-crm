/**
 * seed_status_global.mjs
 *
 * PREPARAÇÃO — NÃO rodar em produção sem revisão do orquestrador.
 *
 * Cria o registro `status_global` em `configuracoes` e faz backfill de
 * `status_opcao` em `tarefas` e `cartoes`. Idempotente: só preenche campos
 * vazios, nunca sobrescreve dado existente.
 *
 * Flags:
 *   --dry-run   Conta e loga sem escrever nada no PocketBase.
 *
 * Como rodar:
 *   PB_ADMIN_SENHA=<senha> node e2e/seed_status_global.mjs [--dry-run]
 */

const BASE_API = 'https://api.wenox.com.br';
const PB_ADMIN_EMAIL = process.env.PB_ADMIN ?? 'adm@wenox.com.br';
const PB_ADMIN_SENHA = process.env.PB_ADMIN_SENHA ?? '';
const DRY_RUN = process.argv.includes('--dry-run');

if (!PB_ADMIN_SENHA) {
  console.error('[erro] Defina PB_ADMIN_SENHA como variável de ambiente.');
  process.exit(1);
}

// ─── DEFAULT_STATUS_GLOBAL (espelho exato de src/tarefas/status.ts) ───────────

const SEED_GRUPO = {
  aFazer:    'g_a_fazer',
  andamento: 'g_andamento',
  concluido: 'g_concluido',
};

const SEED_OPCAO = {
  naoIniciado: 'op_nao_iniciado',
  emProducao:  'op_em_producao',
  emAndamento: 'op_em_andamento',
  aguardando:  'op_aguardando',
  emAlteracao: 'op_em_alteracao',
  agendar:     'op_agendar',
  concluido:   'op_concluido',
  agendado:    'op_agendado',
  postado:     'op_postado',
};

const DEFAULT_STATUS_GLOBAL = {
  versao: 1,
  grupos: [
    { id: SEED_GRUPO.aFazer,    nome: 'A fazer',      cor: 'cinza', ordem: 0 },
    { id: SEED_GRUPO.andamento, nome: 'Em andamento', cor: 'azul',  ordem: 1 },
    { id: SEED_GRUPO.concluido, nome: 'Concluído',    cor: 'verde', ordem: 2 },
  ],
  opcoes: [
    { id: SEED_OPCAO.naoIniciado, grupo: SEED_GRUPO.aFazer,    nome: 'Não iniciado',         cor: 'cinza',    ordem: 0 },
    { id: SEED_OPCAO.emProducao,  grupo: SEED_GRUPO.aFazer,    nome: 'Em produção',          cor: 'cinza',    ordem: 1 },
    { id: SEED_OPCAO.emAndamento, grupo: SEED_GRUPO.andamento, nome: 'Em andamento',         cor: 'azul',     ordem: 0 },
    { id: SEED_OPCAO.aguardando,  grupo: SEED_GRUPO.andamento, nome: 'Aguardando aprovação', cor: 'ambar',    ordem: 1 },
    { id: SEED_OPCAO.emAlteracao, grupo: SEED_GRUPO.andamento, nome: 'Em alteração',         cor: 'vermelho', ordem: 2 },
    { id: SEED_OPCAO.agendar,     grupo: SEED_GRUPO.andamento, nome: 'Agendar',              cor: 'azul',     ordem: 3 },
    { id: SEED_OPCAO.concluido,   grupo: SEED_GRUPO.concluido, nome: 'Concluído',            cor: 'verde',    ordem: 0 },
    { id: SEED_OPCAO.agendado,    grupo: SEED_GRUPO.concluido, nome: 'Agendado',             cor: 'verde',    ordem: 1 },
    { id: SEED_OPCAO.postado,     grupo: SEED_GRUPO.concluido, nome: 'Postado',              cor: 'verde',    ordem: 2 },
  ],
};

// ─── MAPAS LEGADO → opcao id ──────────────────────────────────────────────────

// tarefas.status (nome textual) → status_opcao id
const STATUS_NOME_PARA_OPCAO = {
  'Não iniciado':         SEED_OPCAO.naoIniciado,
  'Em andamento':         SEED_OPCAO.emAndamento,
  'Aguardando aprovação': SEED_OPCAO.aguardando,
  'Em alteração':         SEED_OPCAO.emAlteracao,
  'Concluído':            SEED_OPCAO.concluido,
};

// cartoes.status_post (valor legado) → status_opcao id
const STATUS_POST_PARA_OPCAO = {
  'em_producao':  SEED_OPCAO.emProducao,
  'agendar':      SEED_OPCAO.agendar,
  'agendado':     SEED_OPCAO.agendado,
  'postado':      SEED_OPCAO.postado,
  'em_alteracao': SEED_OPCAO.emAlteracao,
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
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
  if (!pbToken) throw new Error('Token não retornado: ' + JSON.stringify(data).slice(0, 200));
  console.log('[auth] superuser autenticado');
}

// ─── HTTP HELPERS ─────────────────────────────────────────────────────────────
async function pbGet(path, qs = '') {
  const url = `${BASE_API}${path}${qs ? '?' + qs : ''}`;
  const r = await fetch(url, { headers: { Authorization: pbToken } });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`GET ${path} → ${r.status}: ${txt.slice(0, 300)}`);
  }
  return r.json();
}

async function pbPost(path, body) {
  const r = await fetch(`${BASE_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: pbToken },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`POST ${path} → ${r.status}: ${txt.slice(0, 300)}`);
  }
  return r.json();
}

async function pbPatch(path, body) {
  const r = await fetch(`${BASE_API}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: pbToken },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`PATCH ${path} → ${r.status}: ${txt.slice(0, 300)}`);
  }
  return r.json();
}

// Busca TODAS as páginas de uma coleção (paginação automática)
async function fetchAll(col, filter = '', fields = '') {
  const PAGE_SIZE = 500;
  let page = 1;
  let total = Infinity;
  const all = [];

  while (all.length < total) {
    let qs = `perPage=${PAGE_SIZE}&page=${page}&skipTotal=0`;
    if (fields) qs += `&fields=${encodeURIComponent(fields)}`;
    if (filter) qs += `&filter=${encodeURIComponent(filter)}`;

    const d = await pbGet(`/api/collections/${col}/records`, qs);
    const items = d.items ?? [];
    total = d.totalItems ?? items.length;
    all.push(...items);

    if (items.length < PAGE_SIZE) break;
    page++;
  }

  return all;
}

// ─── STEP 1: configuracoes chave=status_global ────────────────────────────────
async function seedConfiguracoes() {
  console.log('[1] Verificando configuracoes chave=status_global...');

  const qs = `perPage=1&filter=${encodeURIComponent('chave="status_global"')}`;
  const d = await pbGet('/api/collections/configuracoes/records', qs);
  const existente = (d.items ?? [])[0] ?? null;

  if (existente) {
    console.log(`    → Já existe (id=${existente.id}) — não sobrescreve.`);
    return { criado: 0, pulado: 1 };
  }

  if (DRY_RUN) {
    console.log('    [dry-run] Criaria configuracoes chave=status_global (versao=1, 3 grupos, 9 opções)');
    return { criado: 1, pulado: 0 };
  }

  const rec = await pbPost('/api/collections/configuracoes/records', {
    chave: 'status_global',
    valor: DEFAULT_STATUS_GLOBAL,
  });
  console.log(`    → Criado id=${rec.id} versao=${DEFAULT_STATUS_GLOBAL.versao} grupos=${DEFAULT_STATUS_GLOBAL.grupos.length} opcoes=${DEFAULT_STATUS_GLOBAL.opcoes.length}`);
  return { criado: 1, pulado: 0 };
}

// ─── STEP 2: backfill tarefas.status_opcao ───────────────────────────────────
async function backfillTarefas() {
  console.log('[2] Backfill tarefas.status_opcao...');

  // Filtra client-side: se status_opcao não é campo de schema, não virá na resposta
  // e ficará undefined — tratado como vazio pelo !t.status_opcao abaixo.
  const tarefas = await fetchAll('tarefas', '', 'id,status,status_opcao');
  console.log(`    → ${tarefas.length} tarefas carregadas`);

  const pendentes = tarefas.filter(t => !t.status_opcao);
  const jaPreenchidos = tarefas.length - pendentes.length;
  console.log(`    → ${pendentes.length} com status_opcao vazio, ${jaPreenchidos} já preenchidos (pulados)`);

  let atualizados = 0;
  let semMatch = 0;

  for (const t of pendentes) {
    const nomeStatus = t.status ?? '';
    const opcaoId = STATUS_NOME_PARA_OPCAO[nomeStatus];

    if (!opcaoId) {
      console.log(`    [sem-match] tarefa id=${t.id} status="${nomeStatus}" → op_nao_iniciado`);
      semMatch++;
    }

    if (!DRY_RUN) {
      await pbPatch(`/api/collections/tarefas/records/${t.id}`, {
        status_opcao: opcaoId ?? SEED_OPCAO.naoIniciado,
      });
      atualizados++;
    }
  }

  if (DRY_RUN) {
    console.log(`    [dry-run] Atualizaria ${pendentes.length} tarefas (${semMatch} sem match legado → op_nao_iniciado)`);
  } else {
    console.log(`    → Atualizados: ${atualizados} | sem match legado: ${semMatch}`);
  }

  return {
    total: tarefas.length,
    atualizados: DRY_RUN ? 0 : atualizados,
    pulados: jaPreenchidos,
    semMatch,
  };
}

// ─── STEP 3: backfill cartoes.status_opcao ───────────────────────────────────
async function backfillCartoes() {
  console.log('[3] Backfill cartoes.status_opcao...');

  const cartoes = await fetchAll('cartoes', '', 'id,status_post,status_opcao');
  console.log(`    → ${cartoes.length} cartões carregados`);

  const pendentes = cartoes.filter(c => !c.status_opcao);
  const jaPreenchidos = cartoes.length - pendentes.length;
  console.log(`    → ${pendentes.length} com status_opcao vazio, ${jaPreenchidos} já preenchidos (pulados)`);

  let atualizados = 0;
  let semStatusPost = 0; // sem status_post legado (não-posts) → NÃO força default; deixa vazio
  let semMatch = 0;      // tem status_post, mas valor desconhecido → loga e pula

  for (const c of pendentes) {
    const statusPost = c.status_post ?? '';
    if (!statusPost) { semStatusPost++; continue; } // card sem status_post (não é post) → pula
    const opcaoId = STATUS_POST_PARA_OPCAO[statusPost];
    if (!opcaoId) {
      console.log(`    [sem-match] cartao id=${c.id} status_post="${statusPost}" → pulado (deixa vazio)`);
      semMatch++;
      continue;
    }
    if (!DRY_RUN) {
      await pbPatch(`/api/collections/cartoes/records/${c.id}`, { status_opcao: opcaoId });
    }
    atualizados++;
  }

  const aplicar = atualizados; // qtd que recebe status_opcao (posts reais)
  if (DRY_RUN) {
    console.log(`    [dry-run] Atualizaria ${aplicar} cartões (posts com status_post). ` +
      `Pulados: ${semStatusPost} sem status_post (não-posts) + ${semMatch} valor desconhecido.`);
  } else {
    console.log(`    → Atualizados: ${aplicar} | pulados sem status_post: ${semStatusPost} | valor desconhecido: ${semMatch}`);
  }

  return {
    total: cartoes.length,
    atualizados: aplicar,
    puladosJaPreenchidos: jaPreenchidos,
    puladosSemStatusPost: semStatusPost,
    semMatch,
  };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== SEED STATUS GLOBAL ===');
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (sem escrita)' : 'ESCRITA'}`);
  console.log('');

  await authPB();

  const r1 = await seedConfiguracoes();
  const r2 = await backfillTarefas();
  const r3 = await backfillCartoes();

  console.log('');
  console.log('='.repeat(60));
  console.log('CONTADORES FINAIS');
  console.log('='.repeat(60));
  console.log(JSON.stringify({
    dryRun: DRY_RUN,
    configuracoes: r1,
    tarefas: r2,
    cartoes: r3,
  }, null, 2));
  console.log('');
  console.log(`=== FIM${DRY_RUN ? ' (dry-run — nenhuma mutação foi feita)' : ''} ===`);
}

main().catch((err) => { console.error('[erro]', err.message); process.exit(1); });
