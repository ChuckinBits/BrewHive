const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Load sample data' }).click(); await p.waitForSelector('.chips');
  await p.goto(BASE + '/#/cellar'); await p.waitForSelector('.chips');
  const chip = (n) => p.getByRole('group', { name: 'Filter cellar' }).getByRole('button', { name: new RegExp('^' + n) });
  ok(await chip('In cellar').getAttribute('aria-pressed') === 'true', 'cellar opens on In cellar');
  const emptyBefore = Number(await chip('Empty').locator('.chip-count').textContent());
  await p.getByRole('link', { name: /First Traditional/ }).click(); await p.waitForSelector('.hero');
  const pour = async (n) => { await p.getByRole('button', { name: 'Log a pour' }).click(); await p.getByRole('textbox', { name: 'Bottles' }).fill(String(n)); await p.getByRole('button', { name: 'Save pour' }).click(); await p.waitForTimeout(400); };
  await pour(1);
  ok(await p.getByRole('dialog', { name: 'Archive the batch?' }).count() === 0, 'no prompt while bottles are left');
  await pour(2);
  ok(await p.getByText('That was the last bottle of First Traditional. Archive the batch?').count() === 1, 'pouring the last bottle asks to archive');
  await p.screenshot({ path: process.argv[2] + '/19-prompt.png' });
  await p.getByRole('button', { name: 'Not now' }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /^Edit Drank 2 bottles/ }).click();
  await p.getByRole('textbox', { name: 'Bottles' }).fill('2'); await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForTimeout(400);
  ok(await p.getByRole('dialog', { name: 'Archive the batch?' }).count() === 0, 'after Not now, it does not ask again while still empty');
  await p.getByRole('button', { name: /^Edit Drank 2 bottles/ }).click();
  await p.getByRole('textbox', { name: 'Bottles' }).fill('1'); await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForTimeout(400);
  ok(await p.locator('.stat-value').first().textContent() === '1', 'editing the pour brings a bottle back');
  await pour(1);
  ok(await p.getByRole('dialog', { name: 'Archive the batch?' }).count() === 1, 'running out again asks again');
  await p.getByRole('dialog').getByRole('button', { name: 'Archive' }).click(); await p.waitForTimeout(400);
  await p.getByRole('link', { name: 'First Traditional' }).click(); await p.waitForSelector('.hero');
  ok(await p.locator('.archived-note').count() === 1, 'Archive archives the batch');
  await p.goto(BASE + '/#/cellar'); await p.waitForSelector('.chips');
  ok(await p.getByRole('link', { name: /First Traditional/ }).count() === 0, 'the empty entry is hidden under In cellar');
  ok(Number(await chip('Empty').locator('.chip-count').textContent()) === emptyBefore + 1, 'Empty count goes up by one');
  await chip('Empty').click();
  ok(await p.getByRole('link', { name: /First Traditional/ }).count() === 1, 'and listed under Empty');
  await p.screenshot({ path: process.argv[2] + '/19-empty.png' });
  // Pour everything that's left: In cellar then says so
  await chip('In cellar').click();
  while (await p.locator('.shelf-item a, .collection a, a.shelf-link').count() === 0 && false) {}
  for (let i = 0; i < 6; i++) {
    const link = p.getByRole('group', { name: 'Filter cellar' }); // keep page context
    const first = p.locator('main a[href^="#/cellar/"]:not([href$="/new"])').first();
    if (await first.count() === 0) break;
    await first.click(); await p.waitForSelector('.hero');
    const left = await p.locator('.stat-value').first().textContent();
    await pour(left);
    if (await p.getByRole('button', { name: 'Not now' }).count()) { await p.getByRole('button', { name: 'Not now' }).click(); await p.waitForTimeout(200); }
    await p.goto(BASE + '/#/cellar'); await p.waitForSelector('.chips');
  }
  ok(await p.getByText('Every bottle has been enjoyed.').count() === 1, 'with nothing left, In cellar says every bottle has been enjoyed');
  await p.screenshot({ path: process.argv[2] + '/19-all-gone.png' });
  await p.getByRole('button', { name: 'See empty bottles' }).click();
  ok(await chip('Empty').getAttribute('aria-pressed') === 'true', 'the link switches to Empty');
  console.log(errors.length ? 'ERRORS ' + errors : 'no console errors'); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
