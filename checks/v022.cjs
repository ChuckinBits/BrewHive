const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
const ENTRY_LABELS = { gravity: 'Gravity reading', ingredient: 'Ingredient', tasting: 'Tasting', note: 'Note', status: 'Stage change', rack: 'Racked', feeding: 'Step feeding', backsweeten: 'Backsweetened', stabilize: 'Stabilized', temperature: 'Temperature', ph: 'pH', moved: 'Relocate', estimate: 'Estimated ABV', fining: 'Fining', nutrient: 'Nutrients', pitch: 'Yeast pitched' };
const entryLabel = (arg) => (typeof arg === 'string' ? (ENTRY_LABELS[arg] ?? arg) : arg.label);
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
const pad = (n) => String(n).padStart(2, '0');
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const d = p.getByRole('dialog').last();
  const details = p.locator('section.card', { has: p.getByRole('heading', { name: 'Details' }) });
  const fact = async (label) => { const dt = details.locator('dt', { hasText: new RegExp('^' + label + '$') }); return (await dt.count()) ? (await dt.locator('xpath=following-sibling::dd[1]').textContent()).trim() : null; };
  const status = async () => (await p.getByRole('group', { name: 'Status' }).getByRole('button', { pressed: true }).textContent()).trim();
  // The batch saves just after the sheet closes: wait for the stage to settle before reading it.
  const statusBecomes = async (want) => { await p.getByRole('group', { name: 'Status' }).getByRole('button', { pressed: true, name: want }).waitFor({ timeout: 3000 }).catch(() => {}); return status(); };
  const addEntry = async (type) => { await p.getByRole('button', { name: 'Add entry' }).click(); await d.waitFor(); await d.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel({ label: type }), exact: true }).click(); };
  const chartDots = () => p.locator('.chart-dot').count();

  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Progress mead'); await p.getByLabel('Start date').fill(day(-10));
  await p.getByRole('textbox', { name: 'Original gravity' }).fill('1.100');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  ok(await fact('Attenuation') === null && await fact('Fermentation rate') === null, 'no attenuation or rate with only the OG');

  // A reading 6 days in: 1.040
  await addEntry('Gravity reading');
  await d.getByRole('textbox', { name: 'Specific gravity' }).fill('1.040'); await d.getByLabel('When', { exact: true }).fill(`${day(-4)}T00:00`);
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  await details.locator('dt', { hasText: /^Attenuation$/ }).waitFor({ timeout: 4000 });
  ok(await fact('Attenuation') === '60%', 'attenuation 60%: ' + await fact('Attenuation'));
  ok(await fact('Fermentation rate') === '10 pts/day', 'rate 10 pts/day over 6 days: ' + await fact('Fermentation rate'));
  ok(await fact('To 1.000') === 'About 4 days', 'about 4 days to 1.000: ' + await fact('To 1.000'));
  await details.scrollIntoViewIfNeeded(); await p.screenshot({ path: out + '/v022-details.png' });

  // Backsweetening: sweetness shows; unticked stays off the chart
  const dotsBefore = await chartDots();
  await addEntry('Backsweetened');
  const sg = d.getByRole('textbox', { name: 'Gravity after adding (optional)' });
  await sg.fill('1.005'); ok((await d.locator('.sweetness').textContent()).startsWith('Dry'), 'typing 1.005: Dry');
  await sg.fill('1.018'); ok((await d.locator('.sweetness').textContent()).startsWith('Semi-sweet'), '1.018: Semi-sweet');
  await sg.fill('1.030'); ok((await d.locator('.sweetness').textContent()).startsWith('Sweet (1.025–1.050)'), '1.030: Sweet (1.025–1.050)');
  await p.screenshot({ path: out + '/v022-sweetness.png' });
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  ok(await chartDots() === dotsBefore, 'unticked backsweetening is not charted');
  await p.locator('.timeline-entry', { hasText: 'Backsweetened' }).click(); await d.waitFor();
  await d.getByRole('checkbox', { name: 'This will ferment' }).check(); await d.getByRole('button', { name: 'Save changes' }).click(); await d.waitFor({ state: 'detached' });
  ok(await chartDots() === dotsBefore + 1, 'ticked "This will ferment", it is charted');
  await p.locator('.timeline-entry', { hasText: 'Backsweetened' }).click(); await d.waitFor();
  await d.getByRole('button', { name: 'Remove entry' }).click(); await d.getByRole('button', { name: 'Remove', exact: true }).click(); await d.waitFor({ state: 'detached' });

  // Relocate
  await addEntry('Relocate');
  await d.getByRole('textbox', { name: /Where/ }).fill('Basement');
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  ok(await p.locator('.timeline-entry', { hasText: 'Relocated to Basement' }).count() === 1, 'Relocate shows "Relocated to Basement"');

  // Stage change, backdated: only history
  await addEntry('Stage change');
  ok((await d.getByRole('combobox', { name: 'Move to' }).locator('option').allTextContents()).join() === 'Planned,Primary,Secondary,Aging,Bottled', 'Stage change offers the stages');
  await d.getByRole('combobox', { name: 'Move to' }).selectOption('secondary');
  await d.getByLabel('When', { exact: true }).fill(`${day(-2)}T09:00`);
  ok(await d.getByText('The batch moves to this stage.').count() === 1, 'newest: it says the batch moves');
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  ok(await statusBecomes('Secondary') === 'Secondary', 'a newest stage change moves the batch to Secondary');
  await addEntry('Stage change');
  await d.getByRole('combobox', { name: 'Move to' }).selectOption('primary');
  await d.getByLabel('When', { exact: true }).fill(`${day(-10)}T08:00`);
  ok(await d.getByText(/only records when it happened/).count() === 1, 'backdated: it says it only records history');
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  ok(await status() === 'Secondary', 'and the batch stays in Secondary');
  ok(await p.locator('.timeline-entry', { hasText: 'Moved to Primary' }).count() === 1, 'with "Moved to Primary" on the timeline');

  // Stage change to Aging asks for the final reading
  await addEntry('Stage change');
  await d.getByRole('combobox', { name: 'Move to' }).selectOption('aging');
  ok(await d.getByRole('heading', { name: 'Final reading' }).count() === 1, 'a stage change to Aging asks for the final reading');
  await d.getByRole('textbox', { name: 'Final gravity (optional)' }).fill('0.998');
  await p.screenshot({ path: out + '/v022-stage.png' });
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  await p.locator('.final-chip').waitFor({ timeout: 5000 }).catch(() => {});
  ok(await status() === 'Aging' && await p.locator('.final-chip').count() === 1, 'Aging, with the final reading 0.998');
  ok(await fact('Fermentation rate') === null && await fact('To 1.000') === null && await fact('Attenuation') === '102%', 'aging: no rate or days left; attenuation ' + await fact('Attenuation'));
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
