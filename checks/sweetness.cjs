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
const tile = (p, label) => p.locator('.stat', { has: p.locator('.stat-label', { hasText: new RegExp('^' + label + '$') }) });
const val = async (p, label) => ((await tile(p, label).locator('.stat-value').textContent()) || '').trim();
const xtra = async (p, label) => ((await tile(p, label).locator('.stat-extra').textContent().catch(() => '')) || '').trim();
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const out = process.argv[2] || '/tmp';
  const d = p.getByRole('dialog').last();
  const add = async (type, opts = {}) => {
    await p.getByRole('button', { name: 'Add entry' }).click();
    await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel(type), exact: true }).click();
    if (opts.sg) await p.getByLabel(type === 'gravity' ? 'Specific gravity' : /^Gravity after adding/).fill(opts.sg);
    if (opts.ferment) await p.getByLabel('This will ferment').check();
    if (opts.when) await p.getByLabel('When').fill(opts.when);
    await p.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(300);
  };
  const newBatch = async (name, start) => {
    await p.goto(BASE + '/#/batches/new');
    await p.getByLabel('Name').fill(name); await p.getByLabel(/^Original gravity/).fill('1.100');
    if (start) await p.getByLabel('Start date').fill(start);
    await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  };

  // 1. Fermenting: the sweetness it would stop at sits under Gravity.
  await newBatch('Sweet Stop');
  await add('gravity', { sg: '1.030' });
  ok(await until(async () => (await val(p, 'Gravity') === '1.030' && await xtra(p, 'Gravity') === 'Sweet')), 'while fermenting, Gravity 1.030 says Sweet');
  ok(await until(async () => (await tile(p, 'Potential').count() === 1 && await tile(p, 'Now').count() === 0)), 'and the fourth tile is still Potential');
  ok(await until(async () => ((await p.locator('.stat-highlight .stat-label').textContent()) === 'ABV so far')), 'ABV so far is the highlighted tile');

  // 2. Stabilizing mid-ferment offers the move to Aging, with the final reading.
  await add('stabilize');
  ok(await until(async () => (await d.getByText(/Stabilizing stops fermentation, so Sweet Stop is done fermenting\. Move it to Aging and log the final reading\?/).count() === 1)), 'stabilizing in Primary offers to move to Aging and log the final reading');
  ok(await until(async () => (await d.getByRole('button', { name: 'Keep it in Primary' }).count() === 1)), 'or keep it in Primary');
  await p.screenshot({ path: `${out}/sweet-1-stabilized.png` });
  await d.getByRole('textbox', { name: 'Final gravity (optional)' }).fill('1.030');
  await d.getByRole('button', { name: 'Move to Aging' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => ((await p.locator('.step-on').textContent()) === 'Aging')), 'moved to Aging');
  ok(await until(async () => (await val(p, 'FG') === '1.030' && await val(p, 'Now') === '1.030' && await xtra(p, 'Now') === 'Sweet')), 'Aging: FG 1.030, and Now 1.030 Sweet in the fourth tile');
  ok(await until(async () => ((await p.locator('.timeline-entry', { hasText: 'Gravity reading' }).first().textContent()).includes('1.030 · Sweet'))), 'the final reading on the timeline says Sweet');

  // 3. Backsweetening after fermenting dry; ticking and unticking "This will ferment".
  await newBatch('Dry Then Sweet');
  await p.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Aging' }).click();
  await d.getByRole('textbox', { name: 'Final gravity (optional)' }).fill('1.000');
  await d.getByRole('button', { name: 'Move to Aging' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await val(p, 'FG') === '1.000' && await xtra(p, 'Now') === 'Dry' && await tile(p, 'Potential').count() === 0)), 'Aging, dry: FG 1.000, Now Dry, no Potential');
  await add('backsweeten', { sg: '1.015' });
  ok(await until(async () => (await val(p, 'FG') === '1.000' && await val(p, 'Now') === '1.015' && await xtra(p, 'Now') === 'Semi-sweet')), 'backsweetened to 1.015: FG stays 1.000, Now 1.015 Semi-sweet');
  ok(await until(async () => ((await p.locator('.timeline-entry', { hasText: 'Backsweetened' }).textContent()).includes('1.015 · Semi-sweet'))), 'the timeline says Backsweetened → 1.015 · Semi-sweet');
  await p.screenshot({ path: `${out}/sweet-2-backsweetened.png`, fullPage: true });
  const edit = async (tick) => {
    await p.getByRole('button', { name: /^Edit Backsweetened/ }).click();
    const box = p.getByLabel('This will ferment');
    if (tick) await box.check(); else await box.uncheck();
    await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForTimeout(300);
  };
  await edit(true);
  await d.getByRole('button', { name: 'Keep it here' }).click(); await p.waitForTimeout(200);
  ok(await until(async () => (await p.locator('.final-chip').count() === 0)), 'ticked: the 1.000 reading stops counting as final');
  await edit(false);
  ok(await until(async () => (await val(p, 'FG') === '1.000' && await p.locator('.final-chip').count() === 1)), 'unticked: FG is 1.000 again and the reading is Final again (the bug)');
  ok(await until(async () => (await val(p, 'ABV') === '13.1%')), 'and the ABV is back to 13.1%');

  // 4. Chart: a step feeding goes straight up on its day; fermentation slopes down.
  // Started 3 days ago; a reading 2 days ago, the feeding yesterday. The rise belongs to yesterday only.
  const pad = (n) => String(n).padStart(2, '0');
  const day = (n) => { const y = new Date(Date.now() - n * 86400000); return `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`; };
  await newBatch('Step Chart', day(3));
  await add('gravity', { sg: '1.040', when: day(2) + 'T09:00' });
  await add('feeding', { sg: '1.060', when: day(1) + 'T09:00' });
  await p.locator('.chart').screenshot({ path: `${out}/sweet-3-chart.png` });
  const verts = await p.locator('.chart-line').evaluate((el) => el.getAttribute('d').split(/[ML]/).filter(Boolean).map((s) => s.split(' ').map(Number)));
  const rises = verts.slice(1).map((v, i) => [verts[i], v]).filter(([a, v]) => v[1] < a[1] - 0.01);
  ok(rises.length === 1 && Math.abs(rises[0][0][0] - rises[0][1][0]) < 0.01, 'the chart rises only straight up (' + JSON.stringify(verts) + ')');
  ok(await until(async () => (await p.locator('.chart-dot').count() === 3)), 'with a dot for each reading only (OG, 1.040, 1.060)');

  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
