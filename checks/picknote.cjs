const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
const ENTRY_LABELS = { gravity: 'Gravity reading', ingredient: 'Ingredient', tasting: 'Tasting', note: 'Note', status: 'Stage change', rack: 'Racked', feeding: 'Step feeding', backsweeten: 'Backsweetened', stabilize: 'Stabilized', temperature: 'Temperature', ph: 'pH', moved: 'Relocate', estimate: 'Estimated ABV', fining: 'Fining', nutrient: 'Nutrients', pitch: 'Yeast pitched' };
const entryLabel = (arg) => (typeof arg === 'string' ? (ENTRY_LABELS[arg] ?? arg) : arg.label);
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const out = process.argv[2];
  const d = p.getByRole('dialog').last();
  const note = d.locator('.ingredient-note');
  // Batch Edit / new batch
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('button', { name: /Add ingredient/ }).first().click();
  const field = d.getByRole('combobox', { name: 'Ingredient', exact: true });
  ok(await note.count() === 0, 'no note before anything is picked');
  await field.fill('D47');
  ok(await note.count() === 0, 'no note while the list is open');
  await d.getByRole('listbox').getByRole('button', { name: /^Lalvin D47/ }).click();
  ok((await note.textContent()).startsWith('Gives a round, full body'), 'picking Lalvin D47 shows its note');
  ok(await field.getAttribute('aria-describedby') === await note.getAttribute('id'), 'the field is described by the note, for screen readers');
  await p.waitForTimeout(300); await p.screenshot({ path: out + '/picknote-batch.png' });
  await field.fill('Lalvin D4');
  await d.getByRole('button', { name: 'Close list' }).click();
  ok(await note.count() === 0, 'a name that no longer matches hides the note');
  await field.fill('My mystery spice'); await d.getByRole('button', { name: 'Close list' }).click();
  ok(await note.count() === 0, 'an ingredient not in the list has no note');
  await d.getByRole('button', { name: 'Close', exact: true }).click();
  // Timeline entry, on a sample batch
  await p.goto(BASE + '/#/more'); await p.getByRole('button', { name: 'Add sample data' }).click(); await p.waitForTimeout(900);
  await p.goto(BASE + '/#/batches'); await p.getByRole('link', { name: /Winter Spice/ }).first().click(); await p.waitForSelector('.hero');
  await p.getByRole('button', { name: 'Add entry' }).click(); await d.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('ingredient'), exact: true }).click();
  await d.getByRole('combobox', { name: 'Ingredient', exact: true }).fill('star an');
  await d.getByRole('listbox').getByRole('button', { name: /^Star anise/ }).click();
  ok((await note.textContent()).startsWith('Potent and licorice-like'), 'the timeline entry shows the note too (Star anise)');
  await p.waitForTimeout(300); await p.screenshot({ path: out + '/picknote-entry.png' });
  await d.getByRole('button', { name: 'Close', exact: true }).click();
  // Editing an ingredient already on a batch shows its note straight away
  await p.getByRole('link', { name: 'Edit batch' }).click(); await p.waitForSelector('form');
  await p.locator('.staged-row', { hasText: 'Cinnamon sticks' }).click();
  ok((await note.textContent()).startsWith('Warm and sweet'), 'opening an ingredient already on the batch shows its note');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
