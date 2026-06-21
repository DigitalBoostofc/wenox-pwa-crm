/**
 * Auditoria READ-ONLY das listas [TEMPLATES] de todos os quadros em produção.
 * Apenas requisições GET — nenhuma mutação.
 *
 * Como rodar:
 *   export PB_ADMIN=adm@wenox.com.br
 *   export PB_ADMIN_SENHA=<senha>
 *   node e2e/templates_audit.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const BASE_API = 'https://api.wenox.com.br';
const PB_ADMIN = process.env.PB_ADMIN;
const PB_ADMIN_SENHA = process.env.PB_ADMIN_SENHA;

if (!PB_ADMIN || !PB_ADMIN_SENHA) {
  console.error('Defina PB_ADMIN e PB_ADMIN_SENHA no ambiente. Ex: PB_ADMIN=adm@wenox.com.br PB_ADMIN_SENHA=*** node e2e/templates_audit.mjs');
  process.exit(1);
}

const QUADRO_GLOBAL_ID = 'b0e8uwu4pfvauni';
const LISTA_TEMPLATES_GLOBAL_ID = 'r0kkq42vsbch881';

// Cards canônicos (match por prefixo case-insensitive)
const CANONICOS_PREFIXOS = ['CALEND', 'OUTRAS', 'CRIATIV', 'RELAT'];
const CANONICOS_LABELS = ['CALENDÁRIO DE POSTS', 'OUTRAS ATIVIDADES', 'CRIATIVOS', 'RELATÓRIOS'];

let pbToken = null;

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

async function pbGet(path, qs = '') {
  const url = `${BASE_API}${path}${qs ? '?' + qs : ''}`;
  const r = await fetch(url, { headers: { Authorization: pbToken } });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`GET ${path} → ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json();
}

async function pbList(col, filter = '', fields = 'id') {
  const qs = `perPage=500&fields=${encodeURIComponent(fields)}` +
    (filter ? `&filter=${encodeURIComponent(filter)}` : '');
  const d = await pbGet(`/api/collections/${col}/records`, qs);
  return d.items || [];
}

// Busca todos os quadros (id, nome, cliente)
async function listarQuadros() {
  const items = await pbList('quadros', '', 'id,nome,cliente');
  console.log(`[QUADROS] total encontrados: ${items.length}`);
  return items;
}

// Busca listas [TEMPLATES] de um quadro — ativas e fechadas
async function buscarListasTemplates(quadroId) {
  // Todas as listas com nome=[TEMPLATES] nesse quadro (sem filtro de fechada)
  const todas = await pbList(
    'listas',
    `quadro = '${quadroId}' && nome = '[TEMPLATES]'`,
    'id,nome,fechada,quadro'
  );
  return todas;
}

// Busca cards de uma lista — ativos e arquivados separadamente
async function buscarCards(listaId, quadroId) {
  // Ativos
  const ativos = await pbList(
    'cartoes',
    `lista = '${listaId}' && arquivado != true`,
    'id,nome,ordem,arquivado'
  );
  // Arquivados
  const arquivados = await pbList(
    'cartoes',
    `lista = '${listaId}' && arquivado = true`,
    'id,nome,ordem,arquivado'
  );

  const sortByOrdem = (arr) => [...arr].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  return {
    ativos: sortByOrdem(ativos),
    arquivados: sortByOrdem(arquivados),
  };
}

// Verifica se nome bate com prefixo canônico (case-insensitive).
// Trata o prefixo ↓↓ e outros caracteres não-letra no início.
function matchCanonicoIdx(nome) {
  const clean = nome.replace(/^[^a-zA-ZÀ-ÿ]+/, '').toUpperCase().trim();
  return CANONICOS_PREFIXOS.findIndex(p => clean.startsWith(p));
}

// Classifica um conjunto de cards ativos contra o conjunto canônico
function classificarCards(nomesAtivos) {
  const matched = new Set();
  const extras = [];

  for (const nome of nomesAtivos) {
    const idx = matchCanonicoIdx(nome);
    if (idx >= 0) {
      matched.add(idx);
    } else {
      extras.push(nome);
    }
  }

  const faltando = CANONICOS_PREFIXOS.filter((_, i) => !matched.has(i)).map((_, i) => CANONICOS_LABELS[i]);
  return { matched, extras, faltando };
}

// Classifica o quadro dado suas listas [TEMPLATES]
function classificarQuadro(listasComCards) {
  const ativas = listasComCards.filter(l => !l.fechada);
  const fechadas = listasComCards.filter(l => l.fechada);

  if (ativas.length === 0) {
    return { status: 'SEM_TEMPLATES', detalhe: 'Nenhuma lista [TEMPLATES] ativa.' + (fechadas.length ? ` (${fechadas.length} fechada(s))` : '') };
  }

  if (ativas.length >= 2) {
    return { status: 'DUPLICADA', detalhe: `${ativas.length} listas [TEMPLATES] ativas.` };
  }

  // Exatamente 1 ativa
  const lista = ativas[0];
  const nomesAtivos = lista.cardsAtivos.map(c => c.nome);
  const { matched, extras, faltando } = classificarCards(nomesAtivos);

  if (faltando.length > 0 && extras.length === 0) {
    return { status: 'INCOMPLETA', detalhe: `Faltando: ${faltando.join(', ')}` };
  }

  if (extras.length > 0) {
    return { status: 'CUSTOMIZADA', detalhe: `Cards extras/renomeados: ${extras.join(', ')}` + (faltando.length ? `; Faltando: ${faltando.join(', ')}` : '') };
  }

  // Todos os 4 canônicos presentes, nenhum extra
  return { status: 'OK', detalhe: 'Todos os 4 cards canônicos presentes.' };
}

// Propõe ação de consolidação
function proposta(quadro, listasComCards, classif) {
  const ativas = listasComCards.filter(l => !l.fechada);
  const fechadas = listasComCards.filter(l => l.fechada);

  switch (classif.status) {
    case 'OK':
      return 'Nenhuma ação necessária.';

    case 'DUPLICADA': {
      if (ativas.length < 2) return 'Revisar manualmente.';
      // Escolher a lista com mais cards canônicos como principal
      const scored = ativas.map(l => {
        const { matched } = classificarCards(l.cardsAtivos.map(c => c.nome));
        return { l, score: matched.size };
      }).sort((a, b) => b.score - a.score);
      const principal = scored[0].l;
      const duplicadas = scored.slice(1).map(s => s.l);
      const manter = `manter lista ${principal.id} (${principal.cardsAtivos.length} cards ativos)`;
      const arquivar = duplicadas.map(d => `arquivar lista ${d.id} (${d.cardsAtivos.length} cards ativos)`).join('; ');
      return `${manter}; ${arquivar}. Verificar se cards únicos nas duplicadas precisam ser migrados antes de arquivar.`;
    }

    case 'INCOMPLETA': {
      const listaId = ativas[0]?.id || '?';
      return `Completar lista ${listaId} com os cards faltantes a partir do quadro global (lista ${LISTA_TEMPLATES_GLOBAL_ID}): ${classif.detalhe.replace('Faltando: ', '')}.`;
    }

    case 'CUSTOMIZADA': {
      return `Revisar manualmente a lista ${ativas[0]?.id || '?'}: ${classif.detalhe}. Confirmar se customização é intencional antes de qualquer alteração.`;
    }

    case 'SEM_TEMPLATES': {
      return `Criar lista [TEMPLATES] clonando do quadro global (lista ${LISTA_TEMPLATES_GLOBAL_ID}) com os 4 cards canônicos.`;
    }

    default:
      return 'Revisar manualmente.';
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
console.log('=== AUDITORIA DE [TEMPLATES] — PRODUÇÃO ===');
console.log('Data: ' + new Date().toISOString());
console.log('');

await authPB();

const todosQuadros = await listarQuadros();

// Separar quadro global dos de cliente
const quadroGlobal = todosQuadros.find(q => q.id === QUADRO_GLOBAL_ID);
const quadrosCliente = todosQuadros.filter(q => q.id !== QUADRO_GLOBAL_ID);

console.log(`[INFO] Quadros de cliente: ${quadrosCliente.length}`);
console.log(`[INFO] Quadro global: ${quadroGlobal ? quadroGlobal.nome : 'NÃO ENCONTRADO'}`);
console.log('');

// Auditar quadro global primeiro
async function auditarQuadro(q) {
  const listas = await buscarListasTemplates(q.id);
  const listasComCards = [];

  for (const lista of listas) {
    const { ativos, arquivados } = await buscarCards(lista.id, q.id);
    listasComCards.push({
      id: lista.id,
      fechada: !!lista.fechada,
      cardsAtivos: ativos,
      cardsArquivados: arquivados,
    });
  }

  const classif = classificarQuadro(listasComCards);
  const acao = proposta(q, listasComCards, classif);

  return { quadro: q, listasComCards, classif, acao };
}

// Auditar todos os quadros de cliente
console.log('[AUDITANDO] Processando quadros de cliente...');
const resultados = [];

for (const q of quadrosCliente) {
  process.stdout.write(`  • ${q.nome || q.id}... `);
  try {
    const r = await auditarQuadro(q);
    resultados.push(r);
    console.log(r.classif.status);
  } catch (e) {
    console.log(`ERRO: ${e.message}`);
    resultados.push({
      quadro: q,
      listasComCards: [],
      classif: { status: 'SEM_TEMPLATES', detalhe: 'Erro ao buscar: ' + e.message },
      acao: 'Investigar erro de API.',
    });
  }
}

// Auditar quadro global (para referência)
let globalResult = null;
if (quadroGlobal) {
  console.log('\n[AUDITANDO] Quadro global...');
  globalResult = await auditarQuadro(quadroGlobal);
  console.log(`  • ${quadroGlobal.nome}: ${globalResult.classif.status}`);
  if (globalResult.listasComCards.length > 0) {
    const gl = globalResult.listasComCards[0];
    console.log(`    Lista ID: ${gl.id} | Cards ativos: ${gl.cardsAtivos.map(c => c.nome).join(' | ')}`);
  }
}

// ─── CONTAGENS ────────────────────────────────────────────────────────────────
const contagem = { OK: 0, DUPLICADA: 0, INCOMPLETA: 0, CUSTOMIZADA: 0, SEM_TEMPLATES: 0 };
for (const r of resultados) {
  contagem[r.classif.status] = (contagem[r.classif.status] || 0) + 1;
}

// ─── RELATÓRIO STDOUT ─────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log('RESUMO');
console.log('='.repeat(60));
console.log(`Total quadros de cliente: ${quadrosCliente.length}`);
console.log(`  OK:           ${contagem.OK}`);
console.log(`  DUPLICADA:    ${contagem.DUPLICADA}`);
console.log(`  INCOMPLETA:   ${contagem.INCOMPLETA}`);
console.log(`  CUSTOMIZADA:  ${contagem.CUSTOMIZADA}`);
console.log(`  SEM_TEMPLATES: ${contagem.SEM_TEMPLATES}`);
console.log('');

const grupos = ['DUPLICADA', 'INCOMPLETA', 'CUSTOMIZADA', 'SEM_TEMPLATES', 'OK'];
for (const status of grupos) {
  const grupo = resultados.filter(r => r.classif.status === status);
  if (grupo.length === 0) continue;
  console.log(`\n── ${status} (${grupo.length}) ──`);
  for (const r of grupo) {
    const nome = r.quadro.nome || r.quadro.id;
    console.log(`  [${r.quadro.id}] ${nome}`);
    console.log(`    Detalhe: ${r.classif.detalhe}`);
    for (const l of r.listasComCards) {
      const estado = l.fechada ? 'FECHADA' : 'ATIVA';
      const cardNomes = l.cardsAtivos.map(c => c.nome).join(' | ');
      const arquivNomes = l.cardsArquivados.map(c => c.nome).join(' | ');
      console.log(`    Lista ${l.id} [${estado}]: ativos=[${cardNomes}]` + (arquivNomes ? ` arquivados=[${arquivNomes}]` : ''));
    }
    console.log(`    Ação: ${r.acao}`);
  }
}

// ─── GERAR MARKDOWN ───────────────────────────────────────────────────────────
const dataHoje = new Date().toISOString().slice(0, 10);

let md = `# Auditoria de [TEMPLATES] — ${dataHoje}\n\n`;
md += `> Gerado em ${new Date().toISOString()} (apenas leitura — nenhuma mutação)\n\n`;

md += `## Quadro de Referência (Global)\n\n`;
if (quadroGlobal && globalResult) {
  const gl = globalResult.listasComCards[0];
  md += `| Campo | Valor |\n|---|---|\n`;
  md += `| ID | \`${quadroGlobal.id}\` |\n`;
  md += `| Nome | ${quadroGlobal.nome} |\n`;
  md += `| Lista [TEMPLATES] ID | \`${gl?.id ?? 'N/A'}\` |\n`;
  md += `| Cards Canônicos | ${gl?.cardsAtivos.map(c => c.nome).join(' ↦ ') ?? 'N/A'} |\n\n`;
} else {
  md += `Quadro global não encontrado!\n\n`;
}

md += `## Resumo\n\n`;
md += `| Status | Quantidade |\n|---|---|\n`;
md += `| Total de quadros cliente | **${quadrosCliente.length}** |\n`;
md += `| OK | ${contagem.OK} |\n`;
md += `| DUPLICADA | ${contagem.DUPLICADA} |\n`;
md += `| INCOMPLETA | ${contagem.INCOMPLETA} |\n`;
md += `| CUSTOMIZADA | ${contagem.CUSTOMIZADA} |\n`;
md += `| SEM_TEMPLATES | ${contagem.SEM_TEMPLATES} |\n\n`;

md += `## Tabela por Status\n\n`;
md += `| Status | Quadro | ID | Listas [TEMPLATES] |\n|---|---|---|---|\n`;
for (const r of resultados.sort((a, b) => {
  const ordem = { DUPLICADA: 0, INCOMPLETA: 1, CUSTOMIZADA: 2, SEM_TEMPLATES: 3, OK: 4 };
  return (ordem[a.classif.status] ?? 5) - (ordem[b.classif.status] ?? 5);
})) {
  const nListas = r.listasComCards.length;
  const nAtivas = r.listasComCards.filter(l => !l.fechada).length;
  md += `| **${r.classif.status}** | ${r.quadro.nome} | \`${r.quadro.id}\` | ${nAtivas} ativa(s), ${nListas - nAtivas} fechada(s) |\n`;
}
md += '\n';

md += `## Detalhe por Quadro\n\n`;
for (const status of grupos) {
  const grupo = resultados.filter(r => r.classif.status === status);
  if (grupo.length === 0) continue;

  md += `### ${status} (${grupo.length})\n\n`;

  for (const r of grupo) {
    const nome = r.quadro.nome || r.quadro.id;
    md += `#### ${nome}\n\n`;
    md += `- **ID do Quadro:** \`${r.quadro.id}\`\n`;
    md += `- **Status:** ${r.classif.status}\n`;
    md += `- **Detalhe:** ${r.classif.detalhe}\n`;

    if (r.listasComCards.length === 0) {
      md += `- **Listas [TEMPLATES]:** nenhuma encontrada\n`;
    } else {
      md += `- **Listas [TEMPLATES]:**\n`;
      for (const l of r.listasComCards) {
        const estado = l.fechada ? 'FECHADA' : 'ATIVA';
        md += `  - Lista \`${l.id}\` [${estado}]\n`;
        if (l.cardsAtivos.length > 0) {
          md += `    - Cards ativos (${l.cardsAtivos.length}): ${l.cardsAtivos.map(c => `"${c.nome}"`).join(', ')}\n`;
        } else {
          md += `    - Cards ativos: nenhum\n`;
        }
        if (l.cardsArquivados.length > 0) {
          md += `    - Cards arquivados (${l.cardsArquivados.length}): ${l.cardsArquivados.map(c => `"${c.nome}"`).join(', ')}\n`;
        }
      }
    }

    md += `- **Ação Proposta:** ${r.acao}\n\n`;
  }
}

// Escrever markdown
const reportPath = '/home/leonardo-groff/projetos/wenox-pwa-crm/docs/auditoria-templates.md';
try {
  mkdirSync(dirname(reportPath), { recursive: true });
} catch {}
writeFileSync(reportPath, md, 'utf-8');
console.log(`\n[RELATÓRIO] Gravado em: ${reportPath}`);

// ─── STRUCTURED OUTPUT para handoff ──────────────────────────────────────────
const structured = {
  reportPath,
  totals: {
    quadrosCliente: quadrosCliente.length,
    OK: contagem.OK,
    DUPLICADA: contagem.DUPLICADA,
    INCOMPLETA: contagem.INCOMPLETA,
    CUSTOMIZADA: contagem.CUSTOMIZADA,
    SEM_TEMPLATES: contagem.SEM_TEMPLATES,
  },
  quadros: resultados.map(r => ({
    quadroId: r.quadro.id,
    nome: r.quadro.nome || '',
    status: r.classif.status,
    listasTemplates: r.listasComCards.map(l => ({
      listaId: l.id,
      fechada: l.fechada,
      cards: l.cardsAtivos.map(c => c.nome),
    })),
    acaoProposta: r.acao,
  })),
};

console.log('\n[STRUCTURED OUTPUT]');
console.log(JSON.stringify(structured, null, 2));

console.log('\n=== FIM ===');
