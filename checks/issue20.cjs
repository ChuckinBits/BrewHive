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
  await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Load sample data' }).click(); await p.waitForSelector('.chips');
  await p.getByRole('link', { name: /Winter Spice/ }).click(); await p.waitForSelector('.hero');
  await p.getByRole('button', { name: 'Bottle this batch' }).click();
  const d = p.getByRole('dialog');
  const line = (i) => d.getByRole('group', { name: `Bottle size ${i}` });
  const count = (i) => line(i).getByRole('textbox', { name: 'Bottles filled' });
  const size = (i) => line(i).getByRole('textbox', { name: /^Size/ });
  const unit = (i) => line(i).getByRole('combobox', { name: 'Unit' });
  ok(await until(async () => (await count(1).inputValue() === '5' && await size(1).inputValue() === '750' && await unit(1).inputValue() === 'ml')), '1 gal batch starts at 5 × 750 mL');
  ok(await until(async () => ((await d.locator('.bottle-total').textContent()).startsWith('Total: 3.75 L of 3.79 L'))), 'running total against the batch volume');
  await size(1).fill('375');
  ok(await until(async () => (await count(1).inputValue() === '10')), 'changing the size recalculates the count');
  await count(1).fill('2'); await size(1).fill('750');
  ok(await until(async () => (await count(1).inputValue() === '2')), 'a typed count stays put');
  await d.getByRole('button', { name: 'Add another size' }).click();
  ok(await until(async () => (await count(2).inputValue() === '3')), 'the next line suggests what is left (1 gal minus 2 × 750 mL = 3 more)');
  await size(2).fill('500'); 
  ok(await until(async () => (await count(2).inputValue() === '4')), 'and follows its own size');
  await count(2).fill('3');
  await d.getByRole('button', { name: 'Add another size' }).click();
  await size(3).fill('375'); await count(3).fill('2');
  ok(await until(async () => ((await d.locator('.bottle-total').textContent()).startsWith('Total: 3.75 L of 3.79 L'))), 'total for 2 × 750, 3 × 500, 2 × 375');
  await d.getByRole('button', { name: 'Add another size' }).click();
  await unit(4).selectOption('other');
  ok(await until(async () => (await line(4).getByRole('textbox', { name: 'Size (mL)' }).count() === 1)), 'Other asks for size in mL');
  await d.getByRole('button', { name: 'Add to cellar' }).click();
  ok(await until(async () => (await d.getByText('Name the container, such as Growler.').count() === 1)), 'Other needs a container name');
  await line(4).getByRole('button', { name: 'Remove this size' }).click();
  ok(await until(async () => (await line(4).count() === 0)), 'a line can be removed');
  await d.getByRole('button', { name: 'Add another size' }).click();
  await unit(4).selectOption('floz');
  ok(await until(async () => (await size(4).inputValue() === '12')), 'fluid ounce starts at 12');
  await line(4).getByRole('button', { name: 'Remove this size' }).click();
  await p.screenshot({ path: process.argv[2] + '/20-sheet.png', fullPage: false });
  await d.getByRole('button', { name: 'Add to cellar' }).click();
  ok(await until(async () => p.url().endsWith('#/cellar')), 'several sizes go to the cellar list');
  const links = () => p.getByRole('link', { name: /Winter Spice/ }).count();
  ok(await until(async () => (await links()) === 3), 'one cellar entry per size (' + (await links()) + ')');
  await p.goto(BASE + '/#/batches'); await p.waitForSelector('.chips');
  await p.getByRole('button', { name: /^Bottled/ }).click();
  await p.getByRole('link', { name: /Winter Spice/ }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await p.getByText('2 × 750 mL, 3 × 500 mL, 2 × 375 mL').count() === 1)), 'one Bottled entry lists every line');
  console.log(errors.length ? 'ERRORS ' + errors : 'no console errors'); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
