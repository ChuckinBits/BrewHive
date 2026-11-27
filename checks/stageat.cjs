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
const ENTRY_LABELS = { gravity: 'Gravity reading', ingredient: 'Ingredient', tasting: 'Tasting', note: 'Note', status: 'Stage change', rack: 'Racked', feeding: 'Sugar added', backsweeten: 'Sugar added', stabilize: 'Stabilized', temperature: 'Temperature', ph: 'pH', moved: 'Relocate', estimate: 'Estimated ABV', fining: 'Fining', nutrient: 'Nutrients', pitch: 'Yeast pitched' };
// Step feeding and backsweetening are one Sugar added button; its "This will ferment" box picks which.
const sugarAs = async (p, type) => { if (type !== 'feeding' && type !== 'backsweeten') return; const box = p.getByLabel(/^This will ferment/); if (type === 'feeding') await box.check(); else await box.uncheck(); };
const entryLabel = (arg) => (typeof arg === 'string' ? (ENTRY_LABELS[arg] ?? arg) : arg.label);
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
const pad = (n) => String(n).padStart(2, '0');
const day = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const d = p.getByRole('dialog').last();
  // A past brew logged as Bottled, with its stage history added afterwards.
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Old brew'); await p.getByLabel('Start date').fill(day(-60));
  await p.locator('select:has(option[value=bottled])').first().selectOption('bottled');
  await p.getByRole('button', { name: /^(Start batch|Save batch|Add batch)$/ }).click(); await p.waitForSelector('.hero');
  const addStage = async (to, date) => {
    await p.getByRole('button', { name: 'Add entry' }).click(); await d.waitFor();
    await d.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel({ label: 'Stage change' }), exact: true }).click(); await sugarAs(p, { label: 'Stage change' });
    await d.getByRole('combobox', { name: 'Move to' }).selectOption(to);
    await d.getByLabel('When', { exact: true }).fill(date + 'T09:00');
    await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  };
  await addStage('secondary', day(-40)); await addStage('bottled', day(-10));
  const addIngredient = async (name, date) => {
    await p.getByRole('button', { name: 'Add entry' }).click(); await d.waitFor();
    await d.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('ingredient'), exact: true }).click(); await sugarAs(p, 'ingredient');
    await d.getByRole('combobox', { name: 'Ingredient', exact: true }).fill(name); await d.getByLabel('Quantity').fill('1');
    await d.getByLabel('When', { exact: true }).fill(date + 'T12:00');
  };
  await addIngredient('Early honey', day(-55));
  ok(await until(async () => (await d.getByRole('combobox', { name: 'Stage' }).inputValue() === 'primary')), 'dated in Primary: Stage is Primary, not Bottling');
  await d.getByLabel('When', { exact: true }).fill(day(-20) + 'T12:00');
  ok(await until(async () => (await d.getByRole('combobox', { name: 'Stage' }).inputValue() === 'secondary')), 'moving the date into Secondary follows it');
  await d.getByLabel('When', { exact: true }).fill(day(-55) + 'T12:00');
  await p.screenshot({ path: out + '/stageat.png' });
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  const group = (label) => p.locator('.staged-ingredients section', { has: p.locator('.stage-divider', { hasText: label }) });
  ok(await until(async () => (await group('Primary ingredients').getByText('Early honey').count() === 1)), 'Early honey lands in Primary ingredients');
  // Picking a stage wins over the date.
  await addIngredient('Oak cubes', day(-55));
  await d.getByRole('combobox', { name: 'Stage' }).selectOption('aging');
  await d.getByLabel('When', { exact: true }).fill(day(-50) + 'T12:00');
  ok(await until(async () => (await d.getByRole('combobox', { name: 'Stage' }).inputValue() === 'aging')), 'a picked stage stays when the date changes');
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  ok(await until(async () => (await group('Aging ingredients').getByText('Oak cubes').count() === 1)), 'Oak cubes land in Aging ingredients');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
