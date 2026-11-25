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
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const out = process.argv[2];
  const d = p.getByRole('dialog');
  const extra = async (label) => (await p.locator('.stat', { has: p.locator('.stat-label', { hasText: new RegExp('^' + label + '$') }) }).locator('.stat-extra').innerText()).trim().replace(/\s*\n\s*/g, ' · ');
  const noSideScroll = () => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const target = () => p.getByRole('textbox', { name: 'Target', exact: true });
  await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Load sample data' }).click(); await p.waitForSelector('.chips');

  // New batch aiming for an ABV
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Strong Pyment'); await p.getByRole('textbox', { name: 'Original gravity' }).fill('1.080');
  await target().fill('1.010');
  ok(await until(async () => (await p.getByText('≈ 9.2% ABV. Step feeding raises this.').count() === 1)), 'aiming for an FG shows the ABV it gives');
  await p.getByRole('button', { name: 'Target ABV' }).click();
  ok(await until(async () => (await target().inputValue() === '9.2')), 'switching to ABV fills in the ABV from the FG (9.2)');
  await target().fill('14');
  ok(await until(async () => (await p.getByText('More than this OG can reach (11.8% even at 0.990). It needs about 17–27 more points of sugar: 17 if it finishes at 0.990, 27 to finish at 1.000.').count() === 1)), '14% from 1.080 says it needs about 17–27 more points');
  await target().fill('11.2');
  ok(await until(async () => (await p.getByText('Finishes around 0.995, drier than most meads get; about 5 more points would let it finish at 1.000.').count() === 1)), '11.2% from 1.080: drier than most, about 5 more points to finish at 1.000');
  await target().fill('9');
  ok(await until(async () => (await p.getByText(/Finishes around 1\.011/).count() === 1)), 'a reachable 9% shows where it finishes (1.011)');
  await target().fill('14');
  await p.screenshot({ path: out + '/27-form.png' });
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForURL(/#\/batches\/[^n]/); await p.waitForSelector('.hero');
  const page = p.url();
  ok(await until(async () => (await extra('Potential') === 'Target 14.0% · needs · 17–27 pts')), 'the batch page shows it needs 17–27 more points (' + await extra('Potential') + ')');
  ok(await until(async () => (await noSideScroll() && await p.locator('.stat').last().evaluate((el) => [...el.querySelectorAll('.stat-extra')].every((x) => x.scrollWidth <= el.clientWidth)))), 'the range fits inside its tile on a phone');
  await p.screenshot({ path: out + '/27-range.png', clip: { x: 0, y: 300, width: 390, height: 260 } });
  const before = await extra('Potential');

  // Step feeding: the target stays at 14%, the FG it finishes at rises
  const add = async (type, sg) => {
    await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel(type), exact: true }).click();
    await d.getByRole('textbox', { name: type === 'gravity' ? 'Specific gravity' : /Gravity after adding/ }).fill(sg);
    await d.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(400);
  };
  await add('gravity', '1.020'); await add('feeding', '1.040');
  const after = await extra('Potential');
  ok(after === 'Target 14.0% · FG 0.993', 'after feeding 20 points it can reach 14% at 0.993 (' + after + ')');
  await add('feeding', '1.060');
  ok(await until(async () => (await extra('Potential') === 'Target 14.0% · FG 1.013')), 'another 20 points (40 in all): aiming for 14% finishes around 1.013, as in the issue (' + await extra('Potential') + ')');
  ok(await until(async () => (await p.getByText('Target reached.').count() === 0)), 'no Target reached yet');
  await add('gravity', '0.995');
  ok(await until(async () => (await p.getByText('Target reached.').count() === 1)), 'past 14% the batch page says Target reached');
  ok(await until(async () => (await noSideScroll())), 'the batch page does not scroll sideways on a phone');
  await p.locator('.target-reached').scrollIntoViewIfNeeded(); await p.waitForTimeout(3500);
  await p.screenshot({ path: out + '/27-reached.png', fullPage: false });

  // A target FG below 1.000: the potential follows it
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Bone dry'); await p.getByRole('textbox', { name: 'Original gravity' }).fill('1.100');
  await target().fill('0.995');
  ok(await until(async () => (await p.getByText('Potential 13.8% (at 0.995)').count() === 1)), 'the form shows Potential 13.8% (at 0.995), with no separate target');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForURL(/#\/batches\/[^n]/); await p.waitForSelector('.hero');
  ok(await until(async () => (await extra('Potential') === 'at 0.995')), 'the batch page shows Potential at 0.995 (' + await extra('Potential') + ')');
  await p.goto(page); await p.waitForSelector('.hero');

  // Save as a recipe keeps the ABV target; a batch from it keeps it too
  await p.getByRole('button', { name: /Save as recipe/ }).click(); await d.getByRole('button', { name: 'Save recipe' }).click();
  await p.waitForURL(/#\/recipes\//); await p.waitForSelector('.hero');
  ok(await until(async () => (await p.locator('.stat-label', { hasText: 'Target ABV' }).count() === 1)), 'the recipe shows Target ABV');
  await p.getByRole('link', { name: 'Start a batch' }).click(); await p.waitForSelector('form');
  ok(await until(async () => (await p.getByRole('button', { name: 'Target ABV' }).getAttribute('aria-pressed') === 'true' && await target().inputValue() === '14')), 'a batch from the recipe aims for 14% too');

  // Recipe form has the switch
  await p.goto(BASE + '/#/recipes/new'); await p.waitForSelector('form');
  ok(await until(async () => (await p.getByRole('group', { name: 'Target unit' }).count() === 1)), 'the recipe form has the FG / ABV switch');
  console.log(errors.length ? 'ERRORS ' + errors : 'no console errors'); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
