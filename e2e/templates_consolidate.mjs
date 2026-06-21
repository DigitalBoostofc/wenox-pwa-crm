/**
 * Consolidação de listas [TEMPLATES] em produção.
 * DRY-RUN por padrão — nenhuma mutação executada.
 * Use --apply para executar as mutações REAIS em produção (irreversível sem backup).
 *
 * Como rodar:
 *   export PB_ADMIN=adm@wenox.com.br
 *   export PB_ADMIN_SENHA=<senha>
 *   node e2e/templates_consolidate.mjs           # dry-run (seguro, só lê)
 *   node e2e/templates_consolidate.mjs --apply   # MUTA produção — usar com cautela
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT   = join(__dir, '..');
const APPLY  = process.argv.includes('--apply');

const BASE_API       = 'https://api.wenox.com.br';
const PB_ADMIN       = process.env.PB_ADMIN;
const PB_ADMIN_SENHA = process.env.PB_ADMIN_SENHA;

if (!PB_ADMIN || !PB_ADMIN_SENHA) {
  console.error('Defina PB_ADMIN e PB_ADMIN_SENHA no ambiente. Ex: PB_ADMIN=adm@wenox.com.br PB_ADMIN_SENHA=*** node e2e/templates_consolidate.mjs');
  process.exit(1);
}

// Prefixos canônicos (case-insensitive, após strip de não-alfa do início)
const CANONICOS_PREFIXOS = ['CALEND', 'OUTRAS', 'CRIATIV', 'RELAT'];
const CANONICOS_LABELS   = ['CALENDÁRIO DE POSTS', 'OUTRAS ATIVIDADES', 'CRIATIVOS', 'RELATÓRIOS'];

// Quadro/lista global de referência
const LISTA_GLOBAL_ID   = 'r0kkq42vsbch881';

// GRUPO A — listas ATIVAS com cards extras (arquivar lixo, manter 4 canônicos)
const GRUPO_A_LISTAS = [
  { id: 'seatu0wpvom6kug', label: 'Sotec Refrigeração'           },
  { id: '3lz92czzyoxw9ys', label: 'FT Fibra Telecom'             },
  { id: 'k69sz6u002vl5jp', label: 'GoldTech Impressoras (ativa)' },
];

// GRUPO B — quadro sem [TEMPLATES] → criar lista + clonar 4 canônicos
const GRUPO_B_QUADRO_ID = 'mpfbhvqn62n6q8u';
const GRUPO_B_LABEL     = 'Georgia Carine Psi';

// GRUPO C — listas [TEMPLATES] FECHADAS antigas → apagar cards + lista
const GRUPO_C_LISTAS = [
  { id: 'orb72svivhm10zt', label: 'GoldTech (fechada)'  },
  { id: 'z5u4gfseyaehw9f', label: 'Danilo Barata'       },
  { id: 'vo1p25o68fj7h9m', label: 'Depósito PAT'        },
  { id: 'euqimwks4grtw7z', label: 'Oxe Telecom #1'      },
  { id: 'v4b24a3gicvtgkv', label: 'Oxe Telecom #2'      },
  { id: 'p7hbtjbm91vo0xa', label: 'Pinheiro Melo'       },
  { id: 'gg9wwl1q5xbz6l2', label: 'Porto Prime'         },
  { id: '4550rf9oa0bys0k', label: 'Ultrasyst'           },
  { id: 'l6zal8nsv5yfd1x', label: 'Via Luxo'            },
];

let pbToken = null;

// ─── HTTP helpers ──────────────────────────────────────────────────────────────

async function authPB() {
  const r = await fetch(`${BASE_API}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_ADMIN, password: PB_ADMIN_SENHA }),
  });
  const d = await r.json();
  pbToken = d.token;
  if (!pbToken) throw new Error('PB auth failed: ' + JSON.stringify(d));
  console.log('[AUTH] ok token=' + pbToken.slice(0, 20) + '...');
}

async function apiGet(collection, id) {
  const r = await fetch(`${BASE_API}/api/collections/${collection}/records/${id}`, {
    headers: { Authorization: pbToken },
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`GET /${collection}/${id} → ${r.status}: ${txt.slice(0, 300)}`);
  }
  return r.json();
}

async function apiList(collection, filter = '') {
  const params = new URLSearchParams({ perPage: '500' });
  if (filter) params.set('filter', filter);
  const r = await fetch(`${BASE_API}/api/collections/${collection}/records?${params}`, {
    headers: { Authorization: pbToken },
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`LIST /${collection} [${filter}] → ${r.status}: ${txt.slice(0, 300)}`);
  }
  const d = await r.json();
  return d.items || [];
}

async function apiPatch(collection, id, body) {
  if (!APPLY) {
    console.log(`      [DRY] PATCH ${collection}/${id} ${JSON.stringify(body)}`);
    return;
  }
  const r = await fetch(`${BASE_API}/api/collections/${collection}/records/${id}`, {
    method: 'PATCH',
    headers: { Authorization: pbToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`PATCH ${collection}/${id} → ${r.status}: ${txt.slice(0, 300)}`);
  }
  return r.json();
}

async function apiPost(collection, body) {
  if (!APPLY) {
    const preview = JSON.stringify(body).slice(0, 200);
    console.log(`      [DRY] POST ${collection} ${preview}`);
    return { id: '(new-dry-run)' };
  }
  const r = await fetch(`${BASE_API}/api/collections/${collection}/records`, {
    method: 'POST',
    headers: { Authorization: pbToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`POST ${collection} → ${r.status}: ${txt.slice(0, 300)}`);
  }
  return r.json();
}

async function apiDelete(collection, id) {
  if (!APPLY) {
    console.log(`      [DRY] DELETE ${collection}/${id}`);
    return;
  }
  const r = await fetch(`${BASE_API}/api/collections/${collection}/records/${id}`, {
    method: 'DELETE',
    headers: { Authorization: pbToken },
  });
  if (!r.ok && r.status !== 404) {
    const txt = await r.text();
    throw new Error(`DELETE ${collection}/${id} → ${r.status}: ${txt.slice(0, 300)}`);
  }
}

// ─── Canonical matching ────────────────────────────────────────────────────────

function matchCanonicoIdx(nome) {
  // Strip leading non-alphabetic chars (↓↓, spaces, brackets, digits, etc.)
  const clean = nome.replace(/^[^a-zA-ZÀ-ÿ]+/, '').toUpperCase().trim();
  return CANONICOS_PREFIXOS.findIndex(p => clean.startsWith(p));
}

// ─── PLANNING PHASE (read-only) ───────────────────────────────────────────────

async function planGrupoA() {
  console.log('\n── GRUPO A: Limpeza de cards-lixo nas 3 listas customizadas ──');
  const plans = [];

  for (const target of GRUPO_A_LISTAS) {
    console.log(`\n  [${target.id}] ${target.label}`);
    const cards = await apiList('cartoes', `lista='${target.id}' && arquivado!=true`);
    const sorted = [...cards].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

    const filled  = new Set(); // canonical slots already claimed
    const toKeep  = [];
    const toArchive = [];

    for (const card of sorted) {
      const idx = matchCanonicoIdx(card.nome);
      if (idx >= 0 && !filled.has(idx)) {
        filled.add(idx);
        toKeep.push({ ...card, _canonico: CANONICOS_LABELS[idx] });
      } else {
        const motivo = idx >= 0
          ? `duplicata do canônico "${CANONICOS_LABELS[idx]}"`
          : 'não é canônico (nome não casa nenhum prefixo)';
        toArchive.push({ ...card, _motivo: motivo });
      }
    }

    console.log(`    Manter  (${toKeep.length}): ${toKeep.map(c => `"${c.nome}"`).join(' | ')}`);
    if (toArchive.length === 0) {
      console.log(`    Arquivar: nenhum — já OK`);
    } else {
      for (const c of toArchive) {
        console.log(`    ARQUIVAR: card ${c.id}  "${c.nome}"  ← ${c._motivo}`);
      }
    }
    console.log(`    → Resultado esperado: ${toKeep.length} cards ativos`);
    plans.push({ target, sorted, toKeep, toArchive });
  }
  return plans;
}

async function planGrupoB() {
  console.log(`\n── GRUPO B: Semeadura do quadro ${GRUPO_B_LABEL} (${GRUPO_B_QUADRO_ID}) ──`);

  const listas = await apiList('listas', `quadro='${GRUPO_B_QUADRO_ID}'`);
  const existingTemplates = listas.filter(l => l.nome === '[TEMPLATES]' && !l.fechada);
  const maxOrdem = listas.reduce((m, l) => Math.max(m, l.ordem ?? 0), 0);
  const novaOrdem = maxOrdem + 1;

  console.log(`  Listas existentes no quadro: ${listas.length}, maxOrdem=${maxOrdem}`);

  if (existingTemplates.length > 0) {
    const skipReason = `lista [TEMPLATES] ativa já existe: ${existingTemplates[0].id}`;
    console.log(`  [NO-OP] ${skipReason}`);
    return { skip: true, skipReason };
  }

  // Buscar cards canônicos da lista global
  const globalCards = await apiList('cartoes', `lista='${LISTA_GLOBAL_ID}' && arquivado!=true`);
  const canonicalCards = [...globalCards].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  console.log(`  Cards globais (${canonicalCards.length}): ${canonicalCards.map(c => `"${c.nome}"`).join(' | ')}`);
  console.log(`  → POST listas { nome:'[TEMPLATES]', quadro:'${GRUPO_B_QUADRO_ID}', fechada:false, ordem:${novaOrdem} }`);
  for (const c of canonicalCards) {
    console.log(`  → POST cartoes (clone de ${c.id}) "${c.nome}"`);
  }

  return { skip: false, novaOrdem, canonicalCards };
}

async function planGrupoC() {
  console.log(`\n── GRUPO C: Apagar listas [TEMPLATES] fechadas antigas (${GRUPO_C_LISTAS.length} alvos) ──`);
  const plans = [];

  for (const target of GRUPO_C_LISTAS) {
    let lista = null;

    try {
      lista = await apiGet('listas', target.id);
    } catch (e) {
      // 404 = já apagada → no-op
      if (e.message.includes('404') || e.message.includes('not found') ||
          e.message.includes('404') || e.message.match(/→ 404/)) {
        console.log(`  [NO-OP] ${target.id} (${target.label}): não encontrada — já apagada`);
        plans.push({ target, skip: true, skipReason: 'não encontrada (404)' });
        continue;
      }
      throw e;
    }

    // Trava de segurança: confirmar fechada=true E nome='[TEMPLATES]'
    if (!lista.fechada || lista.nome !== '[TEMPLATES]') {
      const reason = `fechada=${lista.fechada}, nome="${lista.nome}"`;
      console.warn(`  [AVISO] PULANDO ${target.id} (${target.label}): ${reason} — DIVERGE DO ESPERADO`);
      plans.push({ target, lista, skip: true, skipReason: reason });
      continue;
    }

    // Buscar TODOS os cards (ativos + arquivados) da lista para deletar
    const cards = await apiList('cartoes', `lista='${target.id}'`);
    console.log(`\n  [${target.id}] ${target.label}: fechada=true, ${cards.length} card(s)`);
    for (const c of cards) {
      const estado = c.arquivado ? '[arq]' : '[ativo]';
      console.log(`    DELETE cartoes/${c.id} ${estado} "${c.nome}"`);
    }
    console.log(`    DELETE listas/${target.id}  ← após apagar todos os cards acima`);

    plans.push({ target, lista, skip: false, cards });
  }
  return plans;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

const modeTag = APPLY ? '⚡ APPLY — MUTAÇÕES REAIS' : '🔍 DRY-RUN — apenas simulação';
console.log(`\n${'='.repeat(60)}`);
console.log(`CONSOLIDAÇÃO [TEMPLATES] — ${modeTag}`);
console.log(`${'='.repeat(60)}\n`);

await authPB();

// ── Planning (sem mutações) ────────────────────────────────────────────────────
const planA = await planGrupoA();
const planB = await planGrupoB();
const planC = await planGrupoC();

// ── Contagens do plano ─────────────────────────────────────────────────────────
const nArchive      = planA.reduce((s, p) => s + p.toArchive.length, 0);
const nCloneCards   = planB.skip ? 0 : planB.canonicalCards.length;
const nDeleteCards  = planC.filter(p => !p.skip).reduce((s, p) => s + p.cards.length, 0);
const nDeleteLists  = planC.filter(p => !p.skip).length;
const nSkippedC     = planC.filter(p => p.skip).length;

console.log(`\n${'─'.repeat(60)}`);
console.log('RESUMO DO PLANO:');
console.log(`  Grupo A: ${nArchive} card(s) a arquivar nas 3 listas customizadas`);
if (planB.skip) {
  console.log(`  Grupo B: SKIP — ${planB.skipReason}`);
} else {
  console.log(`  Grupo B: 1 lista + ${nCloneCards} cards a criar para ${GRUPO_B_LABEL}`);
}
console.log(`  Grupo C: ${nDeleteCards} card(s) + ${nDeleteLists} lista(s) a deletar`);
if (nSkippedC > 0) {
  console.log(`           ${nSkippedC} lista(s) serão puladas (não existem ou divergem)`);
  for (const p of planC.filter(p => p.skip)) {
    console.log(`             SKIP ${p.target.id} (${p.target.label}): ${p.skipReason}`);
  }
}
console.log(`${'─'.repeat(60)}`);

if (!APPLY) {
  console.log('\n[DRY-RUN] Plano acima é apenas simulação. Nenhuma mutação foi feita.');
  console.log('[DRY-RUN] Rode com --apply para executar as operações reais.\n');
  process.exit(0);
}

// ══════════════════════════════════════════════════════════════════════════════
// APPLY MODE — tudo abaixo só roda com --apply
// ══════════════════════════════════════════════════════════════════════════════

// Gravar backup ANTES de qualquer mutação
const ts = Date.now();
const backupPath = join(ROOT, 'backups', `templates-consolidate-${ts}.json`);
const backup = {
  timestamp: ts,
  date: new Date().toISOString(),
  grupo_a_cards_to_archive: planA.flatMap(p =>
    p.toArchive.map(c => ({ ...c, _lista: p.target.id, _label: p.target.label }))
  ),
  grupo_c_lists_to_delete: planC
    .filter(p => !p.skip)
    .map(p => ({ lista: p.lista, cards: p.cards })),
};

mkdirSync(dirname(backupPath), { recursive: true });
writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf-8');
console.log(`\n[BACKUP] Gravado em: ${backupPath}`);

let totalArchived     = 0;
let totalCreatedListas = 0;
let totalCreatedCards  = 0;
let totalDeletedCards  = 0;
let totalDeletedLists  = 0;

// ── GRUPO A ───────────────────────────────────────────────────────────────────
console.log('\n── EXECUTANDO GRUPO A ──');
for (const p of planA) {
  if (p.toKeep.length !== 4) throw new Error('ABORT: lista ' + p.target.id + ' ficaria com ' + p.toKeep.length + ' canônicos (esperado 4)');
  if (p.toArchive.length === 0) {
    console.log(`  [NO-OP] ${p.target.label}: nenhum card a arquivar`);
    continue;
  }
  console.log(`  Lista ${p.target.id} (${p.target.label}):`);
  for (const card of p.toArchive) {
    console.log(`    PATCH cartoes/${card.id} arquivado=true  "${card.nome}"`);
    await apiPatch('cartoes', card.id, { arquivado: true });
    totalArchived++;
  }
}

// ── GRUPO B ───────────────────────────────────────────────────────────────────
console.log('\n── EXECUTANDO GRUPO B ──');
if (planB.skip) {
  console.log(`  [NO-OP] ${planB.skipReason}`);
} else {
  const novaLista = await apiPost('listas', {
    nome:    '[TEMPLATES]',
    quadro:  GRUPO_B_QUADRO_ID,
    fechada: false,
    ordem:   planB.novaOrdem,
  });
  totalCreatedListas++;
  console.log(`  POST listas → ${novaLista.id} (ordem=${planB.novaOrdem})`);

  for (const src of planB.canonicalCards) {
    const cardBody = {
      nome:       src.nome,
      lista:      novaLista.id,
      quadro:     GRUPO_B_QUADRO_ID,
      ordem:      src.ordem,
      concluido:  false,
      arquivado:  false,
      membros:    [],
      membros_ids: [],
    };
    // Copiar campos opcionais se presentes na fonte
    if (src.descricao  != null && src.descricao  !== '') cardBody.descricao  = src.descricao;
    if (src.etiquetas  != null)                          cardBody.etiquetas  = src.etiquetas;
    if (src.checklists != null)                          cardBody.checklists = src.checklists;
    if (src.anexos     != null)                          cardBody.anexos     = src.anexos;
    if (src.formato    != null && src.formato    !== '') cardBody.formato    = src.formato;
    if (src.redes      != null && src.redes      !== '') cardBody.redes      = src.redes;
    // etapas_card: omitido intencionalmente

    const novoCard = await apiPost('cartoes', cardBody);
    totalCreatedCards++;
    console.log(`  POST cartoes → ${novoCard.id}  "${src.nome}"`);
  }
}

// ── GRUPO C ───────────────────────────────────────────────────────────────────
console.log('\n── EXECUTANDO GRUPO C ──');
for (const p of planC) {
  if (p.skip) {
    console.log(`  [SKIP] ${p.target.id} (${p.target.label}): ${p.skipReason}`);
    continue;
  }

  // Apagar cards primeiro
  for (const card of p.cards) {
    console.log(`  DELETE cartoes/${card.id}  "${card.nome}"`);
    await apiDelete('cartoes', card.id);
    totalDeletedCards++;
  }

  // Depois apagar a lista
  console.log(`  DELETE listas/${p.target.id}  (${p.target.label})`);
  await apiDelete('listas', p.target.id);
  totalDeletedLists++;
}

// ── RESUMO FINAL ──────────────────────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log('RESUMO FINAL (APPLY concluído):');
console.log(`  Cards arquivados (Grupo A):   ${totalArchived}`);
console.log(`  Listas criadas   (Grupo B):   ${totalCreatedListas}`);
console.log(`  Cards clonados   (Grupo B):   ${totalCreatedCards}`);
console.log(`  Cards deletados  (Grupo C):   ${totalDeletedCards}`);
console.log(`  Listas deletadas (Grupo C):   ${totalDeletedLists}`);
console.log(`  Backup em: ${backupPath}`);
console.log(`${'='.repeat(60)}\n`);
