const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
const ENTRY_LABELS = { gravity: 'Gravity reading', ingredient: 'Ingredient', tasting: 'Tasting', note: 'Note', status: 'Stage change', rack: 'Racked', feeding: 'Step feeding', backsweeten: 'Backsweetened', stabilize: 'Stabilized', temperature: 'Temperature', ph: 'pH', moved: 'Relocate', estimate: 'Estimated ABV', fining: 'Fining', nutrient: 'Nutrients', pitch: 'Yeast pitched' };
const entryLabel = (arg) => (typeof arg === 'string' ? (ENTRY_LABELS[arg] ?? arg) : arg.label);
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const potential = async () => p.locator('.stat-projected .stat-value').textContent();
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
  ok(await potential() === '13.1%', 'A: final reading 1.000, Potential 13.1%');
  await add('stabilize');
  await add('backsweeten', { sg: '1.015' });
  ok(await potential() === '13.1%', 'A: backsweetened after stabilizing, box left unticked: Potential stays 13.1%');
  await p.getByRole('button', { name: /^Edit Backsweetened/ }).click();
  await p.getByLabel('This will ferment').check();
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForTimeout(300);
  // Ticking it while Aging offers a move back to Secondary (issue #26); keep it in Aging here.
  if (await p.getByRole('button', { name: 'Keep it here' }).count()) { await p.getByRole('button', { name: 'Keep it here' }).click(); await p.waitForTimeout(200); }
  ok(await potential() === '15.1%', 'A: box ticked: Potential rises to 15.1%');
  ok((await p.locator('.stat-value').nth(2).textContent()) === '13.1%', 'A: ABV stays 13.1% until it ferments again');

  // Flow B: backsweeten without a gravity, then a separate reading
  await p.goto(BASE + '/#/batches/new');
  await p.getByLabel('Name').fill('Resweeten B'); await p.getByLabel(/^Original gravity/).fill('1.100');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  await add('gravity', { sg: '1.000' }); await add('stabilize'); await add('backsweeten', { ferment: true }); await add('gravity', { sg: '1.015' });
  ok(await potential() === '15.1%', 'B: backsweetened (box ticked, no gravity) then a 1.015 reading: Potential 15.1%');
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
