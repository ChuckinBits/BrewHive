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
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  const d = p.getByRole('dialog');
  const tap = (label) => d.locator('.icon-grid').getByRole('button', { name: label, exact: true }).click();
  const slotNames = () => d.locator('.icon-slot-pick .picked-name').allTextContents();
  await p.locator('.icon-picker-button').click();
  await tap('Cranberry');
  ok(await until(async () => (await slotNames()).join('|') === 'Cranberry · Main'), 'tapping an icon changes the main one');
  await tap('Apple');
  ok(await until(async () => (await slotNames()).join('|') === 'Green apple · Main'), 'tapping another changes it again');
  await d.getByRole('button', { name: '+ Add 2nd icon' }).click(); await tap('Cranberry');
  await d.getByRole('button', { name: '+ Add 3rd icon' }).click(); await tap('Cinnamon');
  ok(await until(async () => (await slotNames()).join('|') === 'Green apple · Main|Cranberry|Cinnamon'), 'Add 2nd and 3rd fill the next slots');
  ok((await d.getByRole('button', { name: /^\+ Add/ }).count()) === 0, 'three is the most: no Add chip');
  await p.screenshot({ path: process.argv[2] + '/16-sheet.png' });
  await d.getByRole('button', { name: 'Done' }).click();
  ok(await until(async () => ((await p.locator('.icon-picker-text strong').textContent()) === 'Green apple, Cranberry, Cinnamon')), 'picker shows all three, main first');
  ok(await until(async () => (await p.getByRole('textbox', { name: 'Name' }).inputValue() === 'Apple Cyser')), 'the name comes from the main icon');
  await p.getByLabel('Custom color').fill('#3366cc');
  ok(await until(async () => (await p.locator('.swatch-custom').getAttribute('style').then((s) => /51, 102, 204|3366cc/i.test(s ?? '')))), 'the custom circle shows the picked color');
  await p.getByRole('button', { name: 'Color #E8A33A' }).click();
  ok(await until(async () => (await p.locator('.swatch-custom.swatch-custom-set').count() === 1)), 'and keeps it after trying a swatch');
  await p.locator('.swatch-custom').evaluate((el) => el.querySelector('input').click());
  ok(await until(async () => (await p.locator('.swatch-custom.swatch-on').count() === 1)), 'tapping the custom circle brings the color back');
  await p.screenshot({ path: process.argv[2] + '/16-form.png' });
  await p.getByRole('button', { name: /Start batch|Save batch|Create batch/ }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await p.locator('.hero svg.vessel svg').count() === 3)), 'the batch page draws all three icons');
  ok(await until(async () => (await p.locator('.hero svg.vessel rect[fill="#3366cc"]').count() === 1)), 'the batch uses the custom color');
  await p.screenshot({ path: process.argv[2] + '/16-hero.png', clip: { x: 0, y: 0, width: 390, height: 330 } });
  // Save as recipe carries the icons
  await p.getByRole('button', { name: /Save as recipe/ }).click(); await d.getByRole('button', { name: 'Save recipe' }).click(); await p.waitForURL(/#\/recipes\//); await p.waitForSelector('.hero');
  ok(await until(async () => (await p.locator('.hero svg.vessel svg').count() === 3)), 'the recipe keeps all three icons');
  await p.goto(BASE + '/#/batches'); await p.waitForSelector('.chips');
  ok(await until(async () => (await p.getByRole('link', { name: /Apple Cyser/ }).locator('svg.vessel svg').count() === 3)), 'the shelf shows all three');
  await p.getByRole('button', { name: 'List view' }).click().catch(() => p.locator('.view-toggle button').nth(1).click());
  await p.waitForTimeout(200);
  ok(await until(async () => (await p.getByRole('link', { name: /Apple Cyser/ }).locator('.icon-tile svg svg').count() === 3)), 'list rows show all three');
  await p.screenshot({ path: process.argv[2] + '/16-list.png' });
  // Bottling carries them
  await p.getByRole('link', { name: /Apple Cyser/ }).click(); await p.waitForSelector('.hero');
  await p.getByRole('button', { name: 'Bottle this batch' }).click(); await d.getByRole('button', { name: 'Add to cellar' }).click(); await p.waitForURL(/#\/cellar\//); await p.waitForSelector('.hero');
  ok(await until(async () => (await p.locator('.hero svg.vessel svg').count() === 3)), 'bottles keep all three icons');
  console.log(errors.length ? 'ERRORS ' + errors : 'no console errors'); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
