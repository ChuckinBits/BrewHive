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
// The rating on recipe and bottle pages: shown on the page, changed only in its sheet.
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Load sample data' }).click(); await p.waitForSelector('.shelf-item');
  const card = p.locator('.rating-card');
  for (const [tab, what] of [['/recipes', 'recipe'], ['/cellar', 'bottle']]) {
    await p.goto(BASE + '/#' + tab); await p.locator('.shelf-item').first().click(); await p.waitForSelector('.rating-card');
    const name = (await p.locator('.topbar h1, .topbar-title').first().textContent()).trim();
    const before = await card.locator('.rating').getAttribute('aria-label').catch(() => null);
    ok(await card.locator('input[type=range]').count() === 0, `${what}: no slider on the page`);
    await card.getByRole('button', { name: /^(Rate|Change)$/ }).click();
    const d = p.getByRole('dialog', { name: `Rate ${name}` });
    ok(await until(async () => (await d.count() === 1)), `${what}: the sheet is titled "Rate ${name}"`);
    await d.getByRole('slider', { name: 'Rating' }).fill('2.5');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(await until(async () => ((await card.locator('.rating').getAttribute('aria-label').catch(() => null)) === before)), `${what}: closing the sheet without Save changes nothing`);
    await card.getByRole('button', { name: /^(Rate|Change)$/ }).click();
    await d.getByRole('slider', { name: 'Rating' }).fill('9');
    await d.getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(300);
    ok(await until(async () => ((await card.locator('.rating').getAttribute('aria-label')) === 'Rated 9 out of 10')), `${what}: Save sets it to 9`);
    await p.reload(); await p.waitForSelector('.rating-card');
    ok(await until(async () => ((await card.locator('.rating').getAttribute('aria-label')) === 'Rated 9 out of 10')), `${what}: and it's kept after a reload`);
  }
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
