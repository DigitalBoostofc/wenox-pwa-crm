// E2E: criar uma tarefa pelo painel inline (formulário completo que
// expande na lista de Tarefas).
import { chromium } from 'playwright';
const BASE = process.env.E2E_BASE ?? 'https://app.wenox.com.br';
const EMAIL = process.env.E2E_EMAIL ?? 'leonardo@wenox.com.br';
const SENHA = process.env.E2E_SENHA ?? 'TrocarNoPrimeiroLogin#2026';
const NOME = 'E2E Tarefa ' + Date.now();

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
  await p.waitForURL(/\/(clientes|dashboard)/, { timeout: 15000 });
  await p.goto(BASE + '/tarefas', { waitUntil: 'networkidle' });
  await p.waitForSelector('button:has-text("Nova tarefa")', { timeout: 10000 });
  console.log('LISTA_TAREFAS_OK -> ' + p.url());

  // Abre a linha de cadastro na grade e preenche o nome na célula.
  await p.click('button:has-text("Nova tarefa")');
  await p.click('button:has-text("Sem nome")');
  await p.waitForTimeout(300);
  await p.keyboard.type(NOME);
  console.log('NOME_DIGITADO');
  await p.click('button[aria-label="Salvar tarefa"]');

  // A tarefa entra na lista (vê em "Todas").
  await p.waitForTimeout(2000);
  await p.click('button:has-text("Todas")').catch(() => {});
  const ok = await p.waitForSelector(`text=${NOME}`, { timeout: 10000 })
    .then(() => true).catch(() => false);
  console.log('TAREFA_NA_LISTA: ' + ok);

  const erro = await p.locator('p.text-destructive').first().innerText().catch(() => '');
  if (erro) console.log('MSG_ERRO: ' + erro);
} catch (e) {
  console.log('EXC: ' + e?.message);
} finally {
  console.log('--- LOGS ---'); console.log(logs.join('\n') || '(sem logs)');
  await b.close();
}
