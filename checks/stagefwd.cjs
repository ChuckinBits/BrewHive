const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
const ENTRY_LABELS = { gravity: 'Gravity reading', ingredient: 'Ingredient', tasting: 'Tasting', note: 'Note', status: 'Stage change', rack: 'Racked', feeding: 'Step feeding', backsweeten: 'Backsweetened', stabilize: 'Stabilized', temperature: 'Temperature', ph: 'pH', moved: 'Relocate', estimate: 'Estimated ABV', fining: 'Fining', nutrient: 'Nutrients', pitch: 'Yeast pitched' };
const entryLabel = (arg) => (typeof arg === 'string' ? (ENTRY_LABELS[arg] ?? arg) : arg.label);
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
const pad = (n) => String(n).padStart(2, '0');
const day = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const d = p.getByRole('dialog').last();
  const status = async () => (await p.getByRole('group', { name: 'Status' }).getByRole('button', { pressed: true }).textContent()).trim();
  const dividers = () => p.locator('.timeline-sections .stage-divider').evaluateAll((hs) => hs.map((h) => h.textContent.replace(/Now$/, '').trim()));
  const openStage = async () => { await p.getByRole('button', { name: 'Add entry' }).click(); await d.waitFor(); await d.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel({ label: 'Stage change' }), exact: true }).click(); };
  const moveTo = () => d.getByRole('combobox', { name: 'Move to' });

  // A past brew logged as Bottled, with OG and FG.
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Past brew'); await p.getByLabel('Start date').fill(day(-90));
  await p.getByRole('textbox', { name: 'Original gravity' }).fill('1.100');
  await p.locator('select:has(option[value=bottled])').first().selectOption('bottled');
  await p.getByRole('textbox', { name: 'Final gravity (optional)' }).fill('1.000');
  await p.getByRole('button', { name: /^(Start batch|Save batch|Add batch)$/ }).click(); await p.waitForSelector('.hero');
  ok(await status() === 'Bottled', 'the batch is Bottled');

  await openStage();
  ok(await moveTo().inputValue() === 'secondary', 'only Primary on the timeline: Stage change starts on Secondary');
  await d.getByLabel('When', { exact: true }).fill(day(-60) + 'T09:00');
  ok(await d.getByText(/already in Bottled, so this only records/).count() === 1, 'it says the batch stays in Bottled');
  await p.screenshot({ path: out + '/stagefwd.png' });
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  ok(await status() === 'Bottled', 'saving Secondary leaves the batch in Bottled');

  await openStage();
  ok(await moveTo().inputValue() === 'aging', 'Secondary on the timeline: the next starts on Aging');
  await d.getByLabel('When', { exact: true }).fill(day(-30) + 'T09:00');
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  ok(await status() === 'Bottled', 'and Aging leaves it in Bottled too');

  await openStage();
  ok(await moveTo().inputValue() === 'bottled', 'then Bottled');
  await d.getByLabel('When', { exact: true }).fill(day(-5) + 'T09:00');
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  await p.locator('.timeline-sections .stage-divider', { hasText: 'Bottled' }).waitFor({ timeout: 3000 }).catch(() => {});
  const secs = await dividers();
  ok(JSON.stringify(secs) === JSON.stringify(['Bottled', 'Aging', 'Secondary', 'Primary']), 'timeline reads Bottled, Aging, Secondary, Primary: ' + secs.join(' | '));

  // The stage buttons still move it back.
  await p.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Aging' }).click();
  await p.waitForTimeout(300);
  ok(await status() === 'Aging', 'the stage buttons move it back to Aging');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
