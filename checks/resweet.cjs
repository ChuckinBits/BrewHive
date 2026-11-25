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
const ENTRY_LABELS = { gravity: 'Gravity reading', ingredient: 'Ingredient', tasting: 'Tasting', note: 'Note', status: 'Stage change', rack: 'Racked', feeding: 'Step feeding', backsweeten: 'Backsweetened', stabilize: 'Stabilized', temperature: 'Temperature', ph: 'pH', moved: 'Relocate', estimate: 'Estimated ABV', fining: 'Fining', nutrient: 'Nutrients', pitch: 'Yeast pitched' };
const entryLabel = (arg) => (typeof arg === 'string' ? (ENTRY_LABELS[arg] ?? arg) : arg.label);
const keepStage = async (p) => { const k = p.getByRole('button', { name: /^Keep it in / }); await k.waitFor({ timeout: 5000 }); await k.click(); await p.waitForTimeout(200); };
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const potential = async () => p.locator('.stat', { has: p.locator('.stat-label', { hasText: /^Potential$/ }) }).locator('.stat-value').textContent();
  const add = async (type, opts = {}) => {
    await p.getByRole('button', { name: 'Add entry' }).click();
    await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel(type), exact: true }).click();
    if (opts.sg) await p.getByLabel(type === 'gravity' ? 'Specific gravity' : /^Gravity after adding/).fill(opts.sg);
    if (opts.ferment) await p.getByLabel('This will ferment').check();
    await p.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(300);
  };
  // Flow A: move to Aging with a final reading (issue #26), stabilize, backsweeten with the box ticked
  await p.goto(BASE + '/#/batches/new');
  await p.getByLabel('Name').fill('Resweeten A'); await p.getByLabel(/^Original gravity/).fill('1.100');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  await p.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Aging' }).click();
  await p.getByRole('textbox', { name: 'Final gravity (optional)' }).fill('1.000');
  await p.getByRole('button', { name: 'Move to Aging' }).click(); await p.waitForTimeout(400);
  const hasPotential = () => p.locator('.stat-label', { hasText: /^Potential$/ }).count();
  ok(await until(async () => ((await p.locator('.stat-highlight .stat-label').textContent()) === 'ABV' && await p.locator('.stat-highlight .stat-value').textContent() === '13.1%')), 'A: in Aging the ABV tile (13.1%) is the highlighted one');
  ok(await until(async () => (await hasPotential() === 0)), 'A: no Potential tile once fermentation is done');
  await add('stabilize');
  await add('backsweeten', { sg: '1.015' });
  ok(await until(async () => (await hasPotential() === 0)), 'A: backsweetened after stabilizing, box left unticked: still no Potential');
  await p.getByRole('button', { name: /^Edit Backsweetened/ }).click();
  await p.getByLabel('This will ferment').check();
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForTimeout(300);
  // Ticking it while Aging offers a move back to Secondary (issue #26); fermenting again, the Potential comes back.
  await p.getByRole('dialog').getByRole('button', { name: 'Move to Secondary' }).click(); await p.waitForTimeout(300);
  ok(await until(async () => (await potential() === '15.1%')), 'A: box ticked and back in Secondary: Potential is back, at 15.1%');
  ok(await until(async () => ((await p.locator('.stat-value').nth(2).textContent()) === '13.1%')), 'A: ABV stays 13.1% until it ferments again');

  // Flow B: backsweeten without a gravity, then a separate reading
  await p.goto(BASE + '/#/batches/new');
  await p.getByLabel('Name').fill('Resweeten B'); await p.getByLabel(/^Original gravity/).fill('1.100');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  await add('gravity', { sg: '1.000' }); await add('stabilize'); await keepStage(p); await add('backsweeten', { ferment: true }); await add('gravity', { sg: '1.015' });
  ok(await until(async () => (await potential() === '15.1%')), 'B: backsweetened (box ticked, no gravity) then a 1.015 reading: Potential 15.1%');
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
