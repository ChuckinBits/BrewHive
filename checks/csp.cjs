// Visits every screen with the sample data, opening sheets and the backup download, and fails on any
// Content-Security-Policy violation the browser reports.
const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
// Waits for a condition that reads the page: the page can lag a moment behind a click or a save,
// longer on a slow machine. Polls until it holds or CHECK_WAIT ms (default 5000) pass.
const until = async (read, ms = Number(process.env.CHECK_WAIT || 5000)) => {
  const end = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (value || Date.now() > end) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
};
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, acceptDownloads: true });
    await ctx.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    const p = await ctx.newPage();
    const console_ = []; p.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) console_.push(m.text()); });
    const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    const violations = async () => [...(await p.evaluate(() => window.__csp)), ...console_];
    await p.goto(BASE + '/'); await p.waitForSelector('.empty');
    ok(await until(async () => ((await p.locator('meta[http-equiv="Content-Security-Policy"]').count()) === 1)), `${scheme}: the page carries the CSP`);
    await p.getByRole('button', { name: 'Load sample data' }).click(); await p.waitForSelector('.shelf-item');
    const count = Math.min(4, await p.locator('.shelf-item').count());
    for (let i = 0; i < count; i++) {
      await p.goto(BASE + '/'); await p.locator('.shelf-item').nth(i).click(); await p.waitForSelector('.hero');
      await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('dialog').waitFor();
      await p.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click();
    }
    for (const route of ['#/recipes', '#/cellar', '#/more', '#/ingredients', '#/batches/new', '#/recipes/new']) {
      await p.goto(BASE + '/' + route); await p.waitForTimeout(400);
    }
    await p.goto(BASE + '/#/recipes'); await p.locator('.shelf-item, .list-row').first().click(); await p.waitForTimeout(400);
    await p.goto(BASE + '/#/more');
    const save = p.getByRole('button', { name: /Save a backup|Export|Back up/ }).first();
    if (await save.count()) { const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), save.click()]); ok(dl !== null, `${scheme}: the backup still downloads`); }
    const v = await violations();
    ok(v.length === 0, `${scheme}: no CSP violations` + (v.length ? ': ' + v.join(' | ') : ''));
    ok(errors.length === 0, `${scheme}: no page errors ` + errors.join(' | '));
    await ctx.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
