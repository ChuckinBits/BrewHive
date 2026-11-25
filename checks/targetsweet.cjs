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
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const target = p.getByRole('textbox', { name: 'Target', exact: true });
  const sweet = () => p.locator('.sweetness-inline').textContent();
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await target.fill('1.000');
  ok(await until(async () => ((await sweet()) === 'Dry (below 1.010).')), 'target 1.000, no OG yet: Dry');
  await p.getByRole('textbox', { name: 'Original gravity' }).fill('1.110');
  await target.fill('1.015');
  ok(await until(async () => ((await sweet()) === 'Semi-sweet (1.010–1.025).')), 'target 1.015: Semi-sweet');
  ok(await until(async () => ((await p.locator('.sweetness-inline').locator('xpath=..').textContent()).includes('ABV. Step feeding raises this.'))), 'next to the ABV it gives');
  await target.fill('1.035'); ok(await until(async () => ((await sweet()).startsWith('Sweet'))), '1.035: Sweet');
  await p.locator('.sweetness-inline').scrollIntoViewIfNeeded(); await p.screenshot({ path: process.argv[2] + '/target-sweet.png' });
  // ABV target: from the FG it finishes at
  await p.getByRole('group', { name: /Target/ }).getByRole('button', { name: 'ABV' }).click();
  await target.fill('12');
  ok(await until(async () => ((await sweet()).startsWith('Semi-sweet'))), 'OG 1.110 aiming for 12% finishes ~1.019: Semi-sweet');
  await target.fill('14.5'); ok(await until(async () => ((await sweet()).startsWith('Dry'))), '14.5% finishes ~1.000: Dry');
  await target.fill('20'); ok(await until(async () => (await p.locator('.sweetness-inline').count() === 0)), 'an ABV out of reach: no sweetness');
  // Recipes too
  await p.goto(BASE + '/#/recipes/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Target', exact: true }).fill('1.020');
  ok(await until(async () => ((await sweet()) === 'Semi-sweet (1.010–1.025).')), 'recipes show it too');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
