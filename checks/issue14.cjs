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
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Load sample data' }).click(); await p.waitForSelector('.chips');
  // Make sure defaults are gal and °F
  await p.goto(BASE + '/#/more'); await p.waitForTimeout(300);
  await p.getByRole('button', { name: /gal/i }).first().click().catch(() => {}); await p.getByRole('button', { name: /°F|Fahrenheit/ }).first().click().catch(() => {});
  await p.goto(BASE + '/#/batches'); await p.waitForSelector('.chips');
  await p.getByRole('link', { name: /Winter Spice/ }).click(); await p.waitForSelector('.hero');
  await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('temperature'), exact: true }).click();
  const d = p.getByRole('dialog');
  ok(await until(async () => (await d.getByRole('button', { name: 'Fahrenheit' }).getAttribute('aria-pressed') === 'true')), 'temperature starts on the default °F');
  await d.getByRole('button', { name: 'Celsius' }).click();
  await d.getByRole('textbox', { name: 'Temperature' }).fill('20');
  ok(await until(async () => (await d.getByText('= 68 °F').count() === 1)), 'the °F value shows live under the field');
  await p.screenshot({ path: process.argv[2] + '/14-temp.png' });
  await d.getByRole('button', { name: /^(Save|Add)/ }).last().click(); await p.waitForTimeout(400);
  ok(await until(async () => (await p.getByText('20 °C (68 °F)').count() === 1)), 'timeline shows 20 °C (68 °F)');
  await p.getByRole('button', { name: /^Edit Temperature/ }).click();
  ok(await until(async () => (await d.getByRole('textbox', { name: 'Temperature' }).inputValue() === '20' && await d.getByRole('button', { name: 'Celsius' }).getAttribute('aria-pressed') === 'true')), 'editing keeps °C');
  await d.getByRole('button', { name: 'Close' }).click();
  // Batch volume in liters
  await p.getByRole('link', { name: 'Edit batch' }).click(); await p.waitForSelector('form');
  ok(await until(async () => (await p.getByRole('button', { name: 'Gallons' }).getAttribute('aria-pressed') === 'true')), 'volume starts on gal');
  await p.getByRole('button', { name: 'Liters' }).click();
  await p.getByRole('textbox', { name: 'Volume' }).fill('19');
  await p.screenshot({ path: process.argv[2] + '/14-form.png' });
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await p.getByText('19 L (5.02 gal)').count() === 1)), 'batch page shows 19 L (5.02 gal)');
  await p.getByRole('link', { name: 'Edit batch' }).click(); await p.waitForSelector('form');
  ok(await until(async () => (await p.getByRole('textbox', { name: 'Volume' }).inputValue() === '19' && await p.getByRole('button', { name: 'Liters' }).getAttribute('aria-pressed') === 'true')), 'the batch remembers liters');
  // Recipe
  await p.goto(BASE + '/#/recipes/new'); await p.waitForSelector('form');
  ok(await until(async () => (await p.getByRole('group', { name: 'Batch size unit' }).count() === 1)), 'recipe form has the gal / L switch');
  console.log(errors.length ? 'ERRORS ' + errors : 'no console errors'); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
