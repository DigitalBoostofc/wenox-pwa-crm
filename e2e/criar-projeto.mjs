// E2E: criar um projeto e validar que aparece na lista /projetos.
import { chromium } from 'playwright';
const BASE = process.env.E2E_BASE ?? 'https://app.wenox.com.br';
const EMAIL = process.env.E2E_EMAIL ?? 'leonardo@wenox.com.br';
const SENHA = process.env.E2E_SENHA ?? 'TrocarNoPrimeiroLogin#2026';
const NOME = 'E2E Projeto ' + Date.now();

const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const p = await b.newContext({ viewport: { width: 1400, height: 900 } }).then((c) => c.newPage());
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
  await p.goto(BASE + '/projetos', { waitUntil: 'networkidle' });
  await p.waitForSelector('text=Projetos', { timeout: 10000 });
  console.log('LISTA_PROJETOS_OK -> ' + p.url());

  await p.click('button:has-text("Novo projeto")');
  await p.waitForSelector('#nome', { timeout: 10000 });
  console.log('FORM_OK -> ' + p.url());

  await p.fill('#nome', NOME);
  // Espera o select de clientes ter pelo menos 1 opção real (além do placeholder)
  await p.waitForFunction(() => {
    const sel = document.querySelector('#cli');
    return sel && sel.options.length > 1;
  }, null, { timeout: 10000 });
  const opts = await p.locator('#cli option').elementHandles();
  const val = await opts[1].getAttribute('value');
  if (val) await p.selectOption('#cli', val);
  await p.click('button:has-text("Salvar")');

  const res = await Promise.race([
    p.waitForURL((u) => /\/projetos$/.test(u.pathname ?? String(u)), { timeout: 12000 }).then(() => 'NAV_LISTA'),
    p.waitForSelector('p.text-destructive', { timeout: 12000 }).then(() => 'ERRO_VISIVEL'),
  ]).catch(() => 'TIMEOUT');

  console.log('RESULTADO: ' + res);

  if (res === 'ERRO_VISIVEL') {
    const txt = await p.locator('p.text-destructive').first().innerText().catch(() => '?');
    console.log('MSG_ERRO: ' + txt);
  }

  if (res === 'NAV_LISTA') {
    const ok = await p.waitForSelector(`text=${NOME}`, { timeout: 10000 }).then(() => true).catch(() => false);
    console.log('PROJETO_NA_LISTA: ' + ok);
  }
} catch (e) {
  console.log('EXC: ' + e?.message);
} finally {
  console.log('--- LOGS ---'); console.log(logs.join('\n') || '(sem logs)');
  await b.close();
}
