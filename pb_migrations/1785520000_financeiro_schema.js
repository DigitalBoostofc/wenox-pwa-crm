// ATENÇÃO: este repo NÃO aplica migrations no CI automaticamente.
// Preferir: `node e2e/setup_financeiro.mjs` (superuser) OU import no admin PB.
// Hooks em pb_hooks/fin_* são deployados pelo CI (docker cp).

/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  function tryFind(name) {
    try { return app.findCollectionByNameOrId(name); } catch (_) { return null; }
  }

  const clientes = tryFind('clientes');
  const projetos = tryFind('projetos');
  if (!clientes || !projetos) {
    throw new Error('financeiro: collections clientes/projetos precisam existir antes');
  }

  // Leitura: time interno (não Cliente). Escrita: Owner/Admin/Gestor.
  const LEITURA =
    '@request.auth.id != "" && @request.auth.role != "Cliente"';
  const ESCRITA =
    '@request.auth.id != "" && (@request.auth.role = "Owner" || @request.auth.role = "Admin" || @request.auth.role = "Gestor")';

  // ── fin_contas ──────────────────────────────────────────────────────────
  if (!tryFind('fin_contas')) {
    const c = new Collection({
      name: 'fin_contas',
      type: 'base',
      listRule: LEITURA,
      viewRule: LEITURA,
      createRule: ESCRITA,
      updateRule: ESCRITA,
      deleteRule: ESCRITA,
      fields: [
        { name: 'nome', type: 'text', required: true, max: 100 },
        {
          name: 'tipo', type: 'select', required: true, maxSelect: 1,
          values: ['carteira', 'banco', 'cartao', 'caixa'],
        },
        { name: 'saldo_inicial', type: 'number', required: false },
        { name: 'saldo_atual', type: 'number', required: false },
        { name: 'ativo', type: 'bool', required: false },
        { name: 'cor', type: 'text', required: false, max: 20 },
        { name: 'icone', type: 'text', required: false, max: 60 },
        { name: 'padrao', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    });
    app.save(c);
  }

  const contas = app.findCollectionByNameOrId('fin_contas');

  // ── fin_categorias ──────────────────────────────────────────────────────
  if (!tryFind('fin_categorias')) {
    const c = new Collection({
      name: 'fin_categorias',
      type: 'base',
      listRule: LEITURA,
      viewRule: LEITURA,
      createRule: ESCRITA,
      updateRule: ESCRITA,
      deleteRule: ESCRITA,
      fields: [
        { name: 'nome', type: 'text', required: true, max: 100 },
        {
          name: 'tipo', type: 'select', required: true, maxSelect: 1,
          values: ['receita', 'despesa'],
        },
        { name: 'icone', type: 'text', required: false, max: 60 },
        { name: 'cor', type: 'text', required: false, max: 20 },
        { name: 'parent_id', type: 'text', required: false, max: 50 },
        { name: 'arquivada', type: 'bool', required: false },
        { name: 'sistema', type: 'bool', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    });
    app.save(c);
  }

  const cats = app.findCollectionByNameOrId('fin_categorias');

  // ── fin_lancamentos ─────────────────────────────────────────────────────
  if (!tryFind('fin_lancamentos')) {
    const c = new Collection({
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
        {
          name: 'tipo', type: 'select', required: true, maxSelect: 1,
          values: ['receita', 'despesa'],
        },
        { name: 'descricao', type: 'text', required: true, max: 500 },
        {
          name: 'categoria', type: 'relation', required: true, maxSelect: 1,
          collectionId: cats.id, cascadeDelete: false,
        },
        { name: 'valor', type: 'number', required: true, min: 0 },
        {
          name: 'conta', type: 'relation', required: true, maxSelect: 1,
          collectionId: contas.id, cascadeDelete: false,
        },
        { name: 'data', type: 'date', required: true },
        { name: 'vencimento', type: 'date', required: false },
        {
          name: 'status', type: 'select', required: true, maxSelect: 1,
          values: ['pago', 'pendente', 'previsto', 'em_atraso'],
        },
        {
          name: 'recorrencia', type: 'select', required: true, maxSelect: 1,
          values: ['unica', 'fixa', 'recorrente', 'parcelada'],
        },
        {
          name: 'frequencia', type: 'select', required: false, maxSelect: 1,
          values: ['mensal', 'semanal', 'quinzenal', 'anual'],
        },
        { name: 'parcela_atual', type: 'number', required: false, min: 1 },
        { name: 'parcelas_total', type: 'number', required: false, min: 1 },
        { name: 'serie_id', type: 'text', required: false, max: 40 },
        {
          name: 'origem', type: 'select', required: true, maxSelect: 1,
          values: ['manual', 'via_projeto', 'via_contrato', 'transferencia', 'ajuste'],
        },
        {
          name: 'cliente', type: 'relation', required: false, maxSelect: 1,
          collectionId: clientes.id, cascadeDelete: false,
        },
        {
          name: 'projeto', type: 'relation', required: false, maxSelect: 1,
          collectionId: projetos.id, cascadeDelete: false,
        },
        { name: 'forma_pagamento', type: 'text', required: false, max: 100 },
        { name: 'observacao', type: 'text', required: false, max: 1000 },
        { name: 'tags', type: 'json', required: false },
        { name: 'anexos', type: 'json', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    });
    app.save(c);
  }
}, (app) => {
  for (const name of ['fin_lancamentos', 'fin_categorias', 'fin_contas']) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
});
