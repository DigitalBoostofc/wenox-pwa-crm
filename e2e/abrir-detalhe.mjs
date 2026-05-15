import { chromium } from 'playwright';
const BASE = process.env.E2E_BASE ?? 'https://app.wenox.com.br';
const EMAIL = 'leonardo@wenox.com.br';
const SENHA = 'TrocarNoPrimeiroLogin#2026';
const NOME = 'Detalhe Teste ' + Date.now();
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newContext().then((c) => c.newPage());
const logs = [];
p.on('console', (m) => logs.push(`[c.${m.type()}] ${m.text()}`));
p.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
p.on('response', async (r) => {
  if (r.url().includes('/api/') && r.status() >= 400) {
    let body = ''; try { body = await r.text(); } catch {}
    logs.push(`[api ${r.status()}] ${r.request().method()} ${r.url()} :: ${body.slice(0,300)}`);
  }
});
try {
  await p.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await p.fill('#email', EMAIL); await p.fill('#senha', SENHA);
  await p.click('button:has-text("Entrar")');
  await p.waitForURL(/\/clientes/, { timeout: 15000 });
  // cria um cliente
  await p.click('button:has-text("Novo cliente")'); await p.waitForSelector('#nf');
  await p.fill('#nf', NOME); await p.fill('#tel', '11955551234');
  await p.click('button:has-text("Salvar")');
  await p.waitForSelector(`text=${NOME}`, { timeout: 12000 });
  console.log('CRIADO_OK');
  // clica no cliente
  await p.click(`main button:has-text("${NOME}")`);
  await p.waitForTimeout(6000);
  console.log('URL:', p.url());
  const txt = (await p.locator('body').innerText().catch(() => '')).slice(0, 200);
  console.log('TEXTO:', txt.replace(/\n/g, ' | '));
  const carregando = await p.locator('text=Carregando').count();
  console.log('STUCK_CARREGANDO:', carregando > 0);
} catch (e) {
  console.log('EXC:', e?.message);
} finally {
  console.log('--- LOGS ---'); console.log(logs.join('\n') || '(nenhum)');
  await b.close();
}
