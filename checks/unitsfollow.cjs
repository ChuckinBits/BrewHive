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
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const unit = async (name) => (await p.locator('.library-row', { has: p.locator('.library-name', { hasText: new RegExp('^' + name + '$') }) }).locator('.muted').textContent()).trim();
  const list = async () => { await p.goto(BASE + '/#/ingredients'); await p.waitForTimeout(500); };
  const setVolume = async (u) => {
    await p.goto(BASE + '/#/more'); await p.waitForTimeout(400);
    await p.getByRole('group', { name: 'Volume and weight units' }).getByRole('button', { name: u === 'L' ? 'Metric' : 'US' }).click(); await p.waitForTimeout(500);
  };
  await list();
  ok(await until(async () => (await unit('Wildflower honey') === 'lb' && await unit('Hibiscus') === 'oz')), 'US units to start: honey in lb, hibiscus in oz');
  // My edits: Clover honey's unit changed; Buckwheat honey opened and saved with no changes; my own ingredient in lb
  await p.getByRole('link', { name: /^Clover honey/ }).click(); await p.waitForSelector('form');
  await p.getByRole('combobox', { name: 'Default unit' }).selectOption('oz'); await p.getByRole('button', { name: 'Save ingredient' }).click(); await p.waitForURL(/#\/ingredients$/);
  await p.getByRole('link', { name: /^Buckwheat honey/ }).click(); await p.waitForSelector('form');
  await p.getByRole('button', { name: 'Save ingredient' }).click(); await p.waitForURL(/#\/ingredients$/);
  await p.getByRole('link', { name: 'Add ingredient' }).click(); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Prickly pear'); await p.getByRole('combobox', { name: 'Default unit' }).selectOption('lb');
  await p.getByRole('button', { name: 'Add ingredient' }).click(); await p.waitForURL(/#\/ingredients$/);

  await setVolume('L');
  await p.screenshot({ path: process.argv[2] + '/units-setting.png' });
  await list();
  ok(await until(async () => (await unit('Wildflower honey') === 'kg' && await unit('Hibiscus') === 'g')), 'metric: honey in kg, hibiscus in g');
  ok(await until(async () => (await unit('Apple juice') === 'L' && await unit('Maple syrup') === 'mL')), 'juice in L, maple syrup in mL');
  ok(await until(async () => (await unit('Lalvin 71B') === 'packet' && await unit('Pectic enzyme') === 'tsp')), 'packets and teaspoons stay');
  ok(await until(async () => (await unit('Clover honey') === 'oz')), 'Clover honey, which I changed, stays in oz');
  ok(await until(async () => (await unit('Buckwheat honey') === 'kg')), 'Buckwheat honey, saved with no changes, still follows');
  ok(await until(async () => (await unit('Prickly pear') === 'lb')), 'my own ingredient stays in lb');
  await p.reload(); await p.waitForTimeout(600);
  ok(await until(async () => (await unit('Wildflower honey') === 'kg')), 'and it stays after reopening');

  await setVolume('gal'); await list();
  ok(await until(async () => (await unit('Wildflower honey') === 'lb' && await unit('Apple juice') === 'gal' && await unit('Buckwheat honey') === 'lb' && await unit('Clover honey') === 'oz')), 'back to gallons: lb and gal again, Clover honey still oz');
  // Restore starter ingredients uses the chosen units
  await setVolume('L'); await list();
  await p.getByRole('link', { name: /^Wildflower honey/ }).click(); await p.waitForSelector('form');
  await p.getByRole('button', { name: 'Delete', exact: true }).click(); await p.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click(); await p.waitForURL(/#\/ingredients$/);
  await p.getByRole('button', { name: 'Restore starter ingredients' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await unit('Wildflower honey') === 'kg')), 'a restored starter comes back in the chosen units');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
