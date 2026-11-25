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
  await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Load sample data' }).click(); await p.waitForSelector('.chips');
  const stat = async (label) => (await p.locator('.stat', { has: p.locator('.stat-label', { hasText: new RegExp('^' + label + '$') }) }).locator('.stat-value').textContent()).trim();
  const d = p.getByRole('dialog');

  // The form has no checkbox or FG field
  await p.getByRole('link', { name: /Bramble Melomel/ }).first().click(); await p.waitForSelector('.hero');
  const bramble = p.url();
  await p.getByRole('link', { name: 'Edit batch' }).click(); await p.waitForSelector('form');
  ok(await until(async () => (await p.getByText('Fermentation completed').count() === 0 && await p.getByRole('textbox', { name: /^Final gravity/ }).count() === 0)), 'the form has no Fermentation completed box or FG field');
  ok(await until(async () => (await p.getByRole('textbox', { name: 'Target', exact: true }).count() === 1)), 'Target final gravity is always there');
  await p.getByRole('combobox', { name: 'Status' }).selectOption('aging');
  ok(await until(async () => (await p.getByRole('textbox', { name: 'Final gravity (optional)' }).count() === 1)), 'choosing Aging in the form asks for the final reading');
  await p.getByRole('combobox', { name: 'Status' }).selectOption('secondary');
  ok(await until(async () => (await p.getByRole('textbox', { name: 'Final gravity (optional)' }).count() === 0)), 'and not for Secondary');
  await p.goto(bramble); await p.waitForSelector('.hero');

  // Primary -> Aging via the stage buttons asks for the final reading
  ok(await until(async () => (await p.locator('.stat-label', { hasText: 'ABV so far' }).count() === 1)), 'while fermenting it says ABV so far');
  await p.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Aging' }).click();
  ok(await until(async () => (await d.getByText('Moving to Aging means fermentation is done.').count() === 1)), 'tapping Aging asks for the final reading');
  await d.getByRole('textbox', { name: 'Final gravity (optional)' }).fill('1.010');
  await p.screenshot({ path: out + '/26-finish.png' });
  await d.getByRole('button', { name: 'Move to Aging' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await p.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Aging' }).getAttribute('aria-pressed') === 'true')), 'the batch is in Aging');
  ok(await until(async () => (await p.locator('.timeline-title', { hasText: 'Gravity reading' }).locator('.final-chip').count() === 1)), 'the final gravity is a timeline reading marked Final');
  ok(await until(async () => (await stat('FG') === '1.010' && await p.locator('.stat-label', { hasText: /^ABV$/ }).count() === 1)), 'FG 1.010 shows, labelled ABV (not "so far")');
  const abvAfter = await stat('ABV');

  // Ticked backsweetening while Aging offers Secondary
  await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('backsweeten'), exact: true }).click();
  await d.getByRole('textbox', { name: /Gravity after adding/ }).fill('1.030');
  await d.getByLabel(/This will ferment/).check();
  await d.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await d.getByText(/is fermenting again\. Move it back to Secondary\?/).count() === 1)), 'ticked backsweetening while Aging offers Secondary');
  ok(await until(async () => (await stat('ABV') === abvAfter)), 'and the ABV does not jump without a later reading');
  await d.getByRole('button', { name: 'Move to Secondary' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await p.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Secondary' }).getAttribute('aria-pressed') === 'true')), 'Move to Secondary moves it back');

  // The ticked backsweetening came after the final reading, so its Final tag is gone and bottling asks again
  ok(await until(async () => (await p.locator('.final-chip').count() === 0)), 'ticked backsweetening after the final reading removed the Final tag');
  await p.getByRole('button', { name: 'Bottle this batch' }).click();
  ok(await until(async () => (await d.getByRole('textbox', { name: 'Final gravity (optional)' }).count() === 1)), 'so bottling asks for a final reading again');
  await d.getByRole('button', { name: 'Close' }).click(); await p.waitForTimeout(300);

  // Bottling straight from Primary with an estimate, on a batch with no final reading
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Quick bottle'); await p.getByRole('textbox', { name: 'Original gravity' }).fill('1.100');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForURL(/#\/batches\/[^n]/); await p.waitForSelector('.hero');
  const quick = p.url();
  const addReading = async (sg, isFinal = false) => {
    await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('gravity'), exact: true }).click();
    await d.getByRole('textbox', { name: 'Specific gravity' }).fill(sg); if (isFinal) await d.getByLabel('Final gravity reading').check();
    await d.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(400);
  };
  await addReading('1.010');
  await p.getByRole('button', { name: 'Bottle this batch' }).click();
  ok(await until(async () => (await d.getByRole('textbox', { name: 'Final gravity (optional)' }).count() === 1)), 'bottling from Primary with no final reading asks for it');
  await d.getByRole('button', { name: 'No reading? Enter an estimated ABV' }).click();
  ok(await until(async () => (await d.getByRole('textbox', { name: 'Estimated ABV (%)' }).inputValue() === '11.8')), 'the estimate starts at the ABV so far (11.8)');
  await d.getByRole('textbox', { name: 'Estimated ABV (%)' }).fill('13');
  await p.screenshot({ path: out + '/26-bottle.png' });
  await d.getByRole('button', { name: 'Add to cellar' }).click(); await p.waitForURL(/#\/cellar\//); await p.waitForSelector('.hero');
  ok(await until(async () => (await stat('ABV') === '≈ 13.0%' || (await stat('ABV')).startsWith('≈ 13'))), 'the bottles show the estimate with ≈ (' + await stat('ABV') + ')');
  await p.goto(quick); await p.waitForSelector('.hero');
  ok(await until(async () => ((await stat('ABV')).startsWith('≈ 13'))), 'the batch shows ≈ 13%');
  ok(await until(async () => (await p.locator('.timeline-title', { hasText: 'Estimated ABV' }).count() === 1)), 'the estimate is a timeline entry');
  // Deleting the estimate entry removes the estimate
  await p.getByRole('button', { name: /^Edit Estimated ABV/ }).click();
  await d.getByRole('button', { name: /^Delete|^Remove/ }).first().click(); await p.waitForTimeout(200);
  if (await d.getByRole('button', { name: /^Delete|^Remove/ }).count()) { await d.getByRole('button', { name: /^Delete|^Remove/ }).last().click(); }
  await p.waitForTimeout(400);
  ok(await until(async () => (!(await stat('ABV')).startsWith('≈'))), 'deleting the Estimated ABV entry removes the estimate (' + await stat('ABV') + ')');
  // Add one by hand again, then a later reading replaces it
  await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('button', { name: 'No reading? Enter an estimated ABV' }).click();
  await d.getByRole('textbox', { name: 'Estimated ABV (%)' }).fill('13'); await d.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => ((await stat('ABV')).startsWith('≈ 13'))), 'an Estimated ABV entry can be added by hand');
  // A later reading replaces the estimate
  await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('gravity'), exact: true }).click();
  await d.getByRole('textbox', { name: 'Specific gravity' }).fill('1.000'); await d.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await stat('ABV') === '13.1%')), 'a later reading replaces the estimate (' + await stat('ABV') + ')');

  // The Final gravity checkbox on gravity readings
  await p.goto(BASE + '/#/batches'); await p.waitForSelector('.chips');
  await p.getByRole('link', { name: /Orchard Cyser/ }).first().click(); await p.waitForSelector('.hero');
  const orchard = p.url();
  await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('gravity'), exact: true }).click();
  ok(await until(async () => (!(await d.getByLabel('Final gravity reading').isChecked()))), 'gravity readings have a Final gravity reading box, off by default');
  await d.getByRole('textbox', { name: 'Specific gravity' }).fill('1.004'); await d.getByLabel('Final gravity reading').check();
  ok(await until(async () => (await d.getByText(/Moving to Aging or bottling won't ask for it again/).count() === 1)), 'ticked with no final yet: explains it');
  await d.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await p.locator('.final-chip').count() === 1)), 'the reading shows the Final chip on the timeline');
  await p.screenshot({ path: out + '/26-chip.png' });
  await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('gravity'), exact: true }).click();
  await d.getByText(/This batch already has a final gravity reading/).waitFor({ timeout: 3000 }).catch(() => {});
  ok(await until(async () => (await d.getByText(/This batch already has a final gravity reading: 1\.004/).count() === 1)), 'a later reading says the batch already has one');
  await d.getByRole('textbox', { name: 'Specific gravity' }).fill('1.002'); await d.getByLabel('Final gravity reading').check();
  ok(await until(async () => (await d.getByText(/This reading will become your new final gravity, replacing 1\.004/).count() === 1)), 'ticked: it will become the new final gravity');
  await p.screenshot({ path: out + '/26-replace.png' });
  await d.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await p.locator('.final-chip').count() === 1 && (await p.locator('.timeline-title', { has: p.locator('.final-chip') }).textContent()).includes('1.002'))), 'only one Final: the new 1.002');
  await p.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Aging' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await d.count() === 0 && await p.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Aging' }).getAttribute('aria-pressed') === 'true')), 'with a final reading, Aging moves straight away without asking');
  ok(await until(async () => (await stat('FG') === '1.002')), 'FG shows the final reading');
  const settled = await stat('ABV');
  await addReading('0.990');
  ok(await until(async () => (await stat('ABV') === settled && await stat('FG') === '1.002')), 'a later lower reading does not change the ABV or FG (' + settled + ')');
  await addReading('1.012');
  ok(await until(async () => (await stat('ABV') === settled)), 'nor does a later higher one');
  // A step feeding after the final reading warns, then takes the Final tag away
  await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('feeding'), exact: true }).click();
  await d.getByText(/This will remove the Final tag/).waitFor({ timeout: 3000 }).catch(() => {});
  ok(await until(async () => (await d.getByText(/This will remove the Final tag from the 1\.002 gravity reading/).count() === 1)), 'a step feeding after the final reading warns it will remove the Final tag');
  await p.screenshot({ path: out + '/26-warn.png' });
  await d.getByRole('textbox', { name: /Gravity after adding/ }).fill('1.030'); await d.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(400);
  if (await d.getByRole('button', { name: 'Keep it here' }).count()) { await d.getByRole('button', { name: 'Keep it here' }).click(); await p.waitForTimeout(200); }
  ok(await until(async () => (await p.locator('.final-chip').count() === 0)), 'saving it removes the Final tag');

  // A new batch entered as Bottled (an old batch) asks for the final reading
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Old batch');
  await p.getByRole('combobox', { name: 'Status' }).selectOption('bottled');
  ok(await until(async () => (await p.getByText('This batch is past fermentation.').count() === 1)), 'a new batch entered as Bottled asks for the final reading');
  await p.getByRole('button', { name: 'No reading? Enter an estimated ABV' }).click();
  await p.getByRole('textbox', { name: 'Estimated ABV (%)' }).fill('11.5');
  await p.screenshot({ path: out + '/26-form.png', fullPage: true });
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForURL(/#\/batches\/[^n]/); await p.waitForSelector('.hero');
  ok(await until(async () => (await stat('ABV') === '≈ 11.5%')), 'it shows ≈ 11.5%');
  console.log(errors.length ? 'ERRORS ' + errors : 'no console errors'); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
