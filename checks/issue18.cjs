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
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const left = async () => p.locator('.stat-value').first().textContent();
  await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Load sample data' }).click();
  await p.goto(BASE + '/#/cellar'); await p.getByRole('link', { name: /First Traditional/ }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await left() === '3')), 'First Traditional starts with 3 bottles left');
  await p.getByRole('button', { name: /^Edit Drank 1 bottle/ }).click();
  ok(await until(async () => ((await p.getByRole('textbox', { name: 'Bottles' }).inputValue()) === '1' && (await p.getByLabel('Tasting note (optional)').inputValue()).startsWith('Dry and floral'))), 'tapping a pour opens it with its values');
  await p.getByRole('textbox', { name: 'Bottles' }).fill('5'); await p.getByRole('button', { name: 'Save changes' }).click();
  ok(await until(async () => (await p.getByText('Only 4 bottles available for this pour.').count() === 1)), 'editing is limited to bottles left plus what the pour used (4)');
  await p.getByRole('textbox', { name: 'Bottles' }).fill('2'); await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForTimeout(300);
  ok(await until(async () => (await left() === '2')), 'changing the pour from 1 to 2 bottles leaves 2');
  await p.getByRole('button', { name: /^Edit Drank 2 bottles/ }).click();
  await p.getByRole('textbox', { name: 'Bottles' }).fill('4'); await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Not now' }).click(); await p.waitForTimeout(200);
  ok(await until(async () => (await left() === '0' && (await p.locator('.hero-sub').textContent()).includes('All gone'))), 'using up every bottle shows "All gone"');
  await p.getByRole('button', { name: /^Edit Drank 4 bottles/ }).click();
  await p.screenshot({ path: process.argv[2] + '/18-edit-pour.png' });
  await p.getByRole('button', { name: 'Remove pour' }).click(); await p.getByRole('button', { name: 'Remove', exact: true }).click(); await p.waitForTimeout(300);
  ok(await until(async () => (await left() === '4' && await p.getByRole('button', { name: /^Edit Drank/ }).count() === 0)), 'removing the pour puts its 4 bottles back');
  ok(await until(async () => (!(await p.locator('.hero-sub').textContent()).includes('All gone') && await p.getByRole('button', { name: 'Log a pour' }).isEnabled())), 'the entry is back in the cellar');
  console.log(errors.length ? 'ERRORS ' + errors : 'no console errors'); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
