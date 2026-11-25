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
const out = process.argv[2];
const keepStage = async (p) => { const k = p.getByRole('button', { name: /^Keep it in / }); await k.waitFor({ timeout: 5000 }); await k.click(); await p.waitForTimeout(200); };
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('console', m => m.type() === 'error' && errors.push(m.text())); p.on('pageerror', e => errors.push(e.message));
  const stat = async (i) => (await p.locator('.stat-value').nth(i).textContent());
  await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Load sample data' }).click();

  // Sample: Orchard Cyser has a step feeding 1.018 -> 1.034
  await p.getByRole('link', { name: /Orchard Cyser/ }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => ((await p.locator('.stat-extra').first().textContent()) === '+16 pts fed')), 'OG bubble shows "+16 pts fed" for the sample feeding');
  ok(await until(async () => (await stat(2) === '13.4%')), 'ABV so far counts drops before and after the feeding: 13.4%');
  ok(await until(async () => (await stat(3) === '14.2%')), 'Potential rises to 14.2% with the feeding');
  ok(await until(async () => (await p.getByText('Step feeding').count() >= 1 && await p.locator('.timeline-value', { hasText: '→ 1.034' }).count() === 1)), 'the feeding shows "→ 1.034" on the timeline');
  await p.screenshot({ path: `${out}/1-cyser.png`, fullPage: true });

  // New batch, issue example: OG 1.100, ferments to 1.020, feeding back to 1.040
  await p.goto(BASE + '/#/batches/new');
  await p.getByLabel('Name').fill('Feeding Test'); await p.getByLabel(/^Original gravity/).fill('1.100');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await stat(3) === '13.1%')), 'new batch: Potential 13.1%');
  const add = async (type, sg, opts = {}) => {
    await p.getByRole('button', { name: 'Add entry' }).click();
    await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel(type), exact: true }).click();
    if (sg) await p.getByLabel(type === 'gravity' ? 'Specific gravity' : /^Gravity after adding/).fill(sg);
    if (opts.when) await p.getByLabel('When').fill(opts.when);
    if (opts.shot) await p.screenshot({ path: `${out}/${opts.shot}.png` });
    if (opts.check) await opts.check();
    await p.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(300);
  };
  const pad = (n) => String(n).padStart(2, '0');
  const t = (h) => { const d = new Date(Date.now() - 86400000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:00`; };
  await add('gravity', '1.020', { when: t(13) });
  ok(await until(async () => (await stat(2) === '10.5%')), 'after 1.020: ABV so far 10.5%');
  await add('feeding', '1.040', { when: t(14), shot: '2-feeding-sheet', check: async () => {
    ok(await until(async () => (await p.getByLabel('This will ferment').count() === 0)), 'step feeding: no checkbox, it always ferments');
  } });
  ok(await until(async () => (await stat(2) === '10.5%')), 'after feeding to 1.040: ABV so far stays 10.5%');
  ok(await until(async () => (await stat(3) === '15.8%')), 'after feeding: Potential rises to 15.8% (15.75%)');
  await add('gravity', '1.010', { when: t(15) });
  ok(await until(async () => (await stat(2) === '14.4%')), 'after fermenting down to 1.010: ABV so far 14.4%');

  // Wobble: a plain reading up by 0.002 is ignored
  await add('gravity', '1.012', { when: t(16) });
  ok(await until(async () => (await stat(3) === '15.8%' && await stat(2) === '14.4%')), 'a 0.002 rise on a plain reading changes nothing');

  // Stabilize, then backsweeten: not expected to ferment
  await add('stabilize', null, { when: t(17) }); await keepStage(p); // stabilized mid-ferment: offered Aging, kept in Primary
  await add('backsweeten', '1.020', { when: t(18), shot: '3-backsweeten-sheet', check: async () => {
    ok(await until(async () => (!(await p.getByLabel('This will ferment').isChecked()))), 'backsweetening after stabilizing: "This will ferment" is unchecked by default');
  } });
  ok(await until(async () => (await stat(3) === '15.8%' && await stat(2) === '14.4%')), 'stabilized backsweetening raises neither number');
  ok(await until(async () => (await p.getByText('Not expected to ferment').count() === 0)), 'no extra timeline line for backsweetening that will not ferment');

  // Override: tick "This will ferment"
  await p.getByRole('button', { name: /^Edit Backsweetened/ }).click();
  await p.getByLabel('This will ferment').check();
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForTimeout(300);
  ok(await until(async () => (await stat(3) === '17.1%')), 'ticking "This will ferment" counts the rise from 1.010 (the wobble was ignored): Potential 17.1%');
  await p.screenshot({ path: `${out}/4-test-batch.png`, fullPage: true });

  // Form ABV line counts the feeding
  await p.getByRole('link', { name: 'Edit batch' }).click(); await p.waitForSelector('form');
  ok(await until(async () => (await p.getByText('Potential 17.1%').count() === 1)), 'the edit form\'s Potential includes the added sugar');
  // Issue #26: moving to Aging in the form asks for the final reading, and the ABV line counts it.
  await p.getByRole('combobox', { name: 'Status' }).selectOption('aging'); await p.getByRole('textbox', { name: 'Final gravity (optional)' }).fill('1.002');
  ok(await until(async () => (await p.getByText('ABV 16.8% · Potential 17.1%').count() === 1)), 'the form\'s ABV with a final reading of 1.002 counts every drop (0.080 + 0.030 + 0.018): 16.8%');
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
