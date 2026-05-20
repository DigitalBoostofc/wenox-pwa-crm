// Smoke E2E: abre /projetos, troca entre Cards/Kanban/Lista e valida renderização.
import { chromium } from 'playwright';
const BASE = process.env.E2E_BASE ?? 'https://app.wenox.com.br';
const EMAIL = process.env.E2E_EMAIL ?? 'leonardo@wenox.com.br';
const SENHA = process.env.E2E_SENHA ?? 'TrocarNoPrimeiroLogin#2026';

const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newContext({ viewport: { width: 1400, height: 900 } }).then((c) => c.newPage());
const logs = [];
p.on('console', (m) => logs.push(`[c.${m.type()}] ${m.text()}`));
p.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

try {
  await p.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await p.fill('#email', EMAIL); await p.fill('#senha', SENHA);
  await p.click('button:has-text("Entrar")');
  await p.waitForURL(/\/clientes/, { timeout: 15000 });
  await p.goto(BASE + '/projetos', { waitUntil: 'networkidle' });
  await p.waitForSelector('h1:has-text("Projetos")', { timeout: 10000 });

  for (const view of ['Cards', 'Kanban', 'Lista']) {
    await p.click(`button[aria-label="${view}"]`);
    await p.waitForTimeout(300);
    const pressed = await p.locator(`button[aria-label="${view}"]`).getAttribute('aria-pressed');
    console.log(view, '→ aria-pressed=', pressed);
  }
  // Volta pra Cards
  await p.click('button[aria-label="Cards"]');
  console.log('SMOKE_OK');
} catch (e) {
  console.log('EXC:', e?.message);
} finally {
  console.log('--- LOGS ---'); console.log(logs.join('\n') || '(sem logs)');
  await b.close();
}
