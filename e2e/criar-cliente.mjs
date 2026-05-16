import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE ?? 'https://app.wenox.com.br';
const EMAIL = process.env.E2E_EMAIL ?? 'leonardo@wenox.com.br';
const SENHA = process.env.E2E_SENHA ?? 'TrocarNoPrimeiroLogin#2026';
const NOME = 'E2E Cliente ' + Date.now();

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
});
const ctx = await browser.newContext();
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) =>
  logs.push(`[reqfailed] ${r.method()} ${r.url()} :: ${r.failure()?.errorText}`)
);
page.on('response', async (r) => {
  if (r.url().includes('/api/') && r.status() >= 400) {
    let body = '';
    try { body = await r.text(); } catch {}
    logs.push(`[api ${r.status()}] ${r.request().method()} ${r.url()} :: ${body.slice(0, 300)}`);
  }
});

const out = (s) => console.log(s);

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });

  // Login
  await page.fill('#email', EMAIL);
  await page.fill('#senha', SENHA);
  await page.click('button:has-text("Entrar")');

  // Espera a lista de clientes
  await page.waitForURL(/\/clientes/, { timeout: 15000 });
  await page.waitForSelector('text=Clientes', { timeout: 10000 });
  out('LOGIN_OK -> ' + page.url());

  // Abre o formulário
  await page.click('button:has-text("Novo cliente")');
  await page.waitForURL(/\/novo-cliente/, { timeout: 10000 });
  await page.waitForSelector('#nf', { timeout: 10000 });
  out('FORM_OK -> ' + page.url());

  // Preenche e salva
  await page.fill('#nf', NOME);
  await page.fill('#tel', '11955554444');
  await page.click('button:has-text("Salvar")');

  // Resultado: ou volta pra lista, ou mostra erro
  const res = await Promise.race([
    page.waitForURL((u) => /\/clientes$/.test(u.pathname ?? String(u)), { timeout: 12000 }).then(() => 'NAV_LISTA'),
    page.waitForSelector('p.text-destructive', { timeout: 12000 }).then(() => 'ERRO_VISIVEL'),
  ]).catch(() => 'TIMEOUT');

  out('RESULTADO: ' + res);

  if (res === 'ERRO_VISIVEL') {
    const txt = await page.locator('p.text-destructive').first().innerText().catch(() => '(sem texto)');
    out('MSG_ERRO: ' + txt);
  }

  if (res === 'NAV_LISTA') {
    const ok = await page
      .waitForSelector(`text=${NOME}`, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    out('CLIENTE_NA_LISTA: ' + ok);
    if (!ok) {
      const itens = await page.locator('tbody tr td p.font-medium').allInnerTexts().catch(() => []);
      out('ITENS_VISIVEIS: ' + JSON.stringify(itens.slice(0, 10)));
    }
  }
} catch (e) {
  out('EXCECAO: ' + (e?.message ?? String(e)));
} finally {
  out('--- LOGS ---');
  out(logs.join('\n') || '(sem logs relevantes)');
  await browser.close();
}
