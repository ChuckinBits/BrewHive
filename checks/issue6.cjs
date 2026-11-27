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
const out = process.argv[2];
const keepStage = async (p) => { const k = p.getByRole('button', { name: /^Keep it in / }); await k.waitFor({ timeout: 5000 }); await k.click(); await p.waitForTimeout(200); };
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const potential = async () => p.locator('.stat', { has: p.locator('.stat-label', { hasText: /^Potential$/ }) }).locator('.stat-value').textContent();
  const titles = () => p.locator('.timeline-entry strong').allTextContents();
  await p.goto(BASE + '/');
  await p.getByRole('button', { name: 'Load sample data' }).click(); await p.waitForSelector('.shelf-item');
  // 9: stars
  ok(await until(async () => (await p.locator('.shelf-item .rating svg path').count() >= 1)), '9: ratings above the carboys are drawn as stars');
  await p.getByRole('button', { name: /^All/ }).click(); await p.waitForTimeout(3000);
  await p.screenshot({ path: `${out}/1-shelf-stars.png` });

  await p.goto(BASE + '/#/batches/new');
  await p.getByLabel('Name').fill('Issue 6 Test'); await p.getByLabel(/^Original gravity/).fill('1.100');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');

  // 6: order
  await p.getByRole('button', { name: 'Add entry' }).click();
  const grid = p.getByRole('radiogroup', { name: 'What happened?' });
  const opts = await grid.getByRole('radio').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  ok(JSON.stringify(opts) === JSON.stringify(['Gravity reading', 'Ingredient', 'Tasting', 'Note', 'Stage change', 'Racked', 'Sugar added', 'Stabilized', 'Carbonated', 'Temperature', 'pH', 'Relocate']), '6: the grid starts with the most used: ' + opts.join(', '));
  ok(await until(async () => (await grid.getByRole('radio', { name: 'Gravity reading' }).getAttribute('aria-checked') === 'true')), '6: Gravity reading is the default');
  ok(await until(async () => (await grid.getByRole('radio', { name: /Fining|Nutrients|Yeast pitched/ }).count() === 0)), '6: Fining, Nutrients and Yeast pitched are Ingredient entries now');
  await p.getByLabel('Specific gravity').fill('1.020'); await p.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(300);

  const open = async (type) => { await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel(type), exact: true }).click(); await sugarAs(p, type); };
  const save = async () => { await p.getByRole('button', { name: /Save entry|Save changes/ }).click(); await p.waitForTimeout(300); };

  // Sugar added: one button for step feeding and backsweetening. While fermenting it starts as a step feed.
  await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: 'Sugar added', exact: true }).click();
  ok(await until(async () => (await p.getByLabel(/^This will ferment \(step feed\)/).isChecked())), 'Sugar added in Primary starts ticked, as a step feeding');
  await p.getByRole('button', { name: 'Close' }).first().click(); await p.waitForTimeout(300);
  await open('feeding');
  ok(await until(async () => (await p.getByLabel(/^This will ferment/).isChecked())), '2: a step feeding is Sugar added, ticked to ferment');
  await p.getByLabel(/^Gravity after adding/).fill('1.040'); await save();
  ok(await until(async () => (await potential() === '15.8%')), '2: step feeding still raises the Potential (15.8%)');

  // 1 + 3: backsweetening unchecked by default, no timeline line
  await open('backsweeten');
  ok(await until(async () => (!(await p.getByLabel('This will ferment').isChecked()))), '1: backsweetening "This will ferment" is unchecked by default (not stabilized)');
  await p.getByLabel(/^Gravity after adding/).fill('1.045');
  await p.screenshot({ path: `${out}/2-backsweeten.png` });
  await save();
  ok(await until(async () => (await potential() === '15.8%')), '1: unticked backsweetening leaves the Potential alone');
  ok(await until(async () => (await p.getByText('Not expected to ferment').count() === 0 && await p.getByText('Expected to ferment').count() === 0)), '3: no extra line for the usual case');
  await p.getByRole('button', { name: /^Edit Backsweetened/ }).click(); await p.getByLabel('This will ferment').check(); await save();
  ok(await until(async () => (await p.getByText('Expected to ferment', { exact: true }).count() === 1)), '3: ticked backsweetening says "Expected to ferment"');
  ok(await until(async () => (await potential() === '16.4%')), '3: and raises the Potential to 16.4%');

  // 4: pH once
  await open('ph'); await p.getByRole('textbox', { name: 'pH' }).fill('3.6'); await save();
  const ph = (await titles()).find(t => t.startsWith('pH'));
  ok(ph === 'pH 3.60', '4: pH entry reads "pH 3.60", not "pH pH 3.60": ' + ph);

  // 5: stabilized method
  await open('stabilize');
  const methods = await p.getByLabel('Method').locator('option').allTextContents();
  ok(JSON.stringify(methods) === JSON.stringify(['Chemical', 'Pasteurization', 'Filtration', 'Nagardo', 'Other']), '5: Method dropdown: ' + methods.join(', '));
  await p.getByLabel('Method').selectOption('Pasteurization'); await save(); await keepStage(p);
  ok(await until(async () => ((await titles()).includes('Stabilized Pasteurization'))), '5: the timeline shows "Stabilized Pasteurization"');

  // 7: ingredient
  await open('ingredient');
  await p.getByRole('button', { name: /Save entry/ }).click();
  ok(await until(async () => (await p.getByText('Enter what you added').count() === 1)), '7: an ingredient needs a name');
  await p.getByRole('combobox', { name: 'Ingredient', exact: true }).fill('Oak cubes'); await p.getByRole('dialog').getByLabel('Quantity').fill('1'); await p.getByRole('dialog').getByLabel('Unit').selectOption('oz');
  await p.screenshot({ path: `${out}/3-ingredient.png` });
  await save();
  ok(await until(async () => ((await titles()).includes('Added Oak cubes 1 oz'))), '7: the timeline shows "Added Oak cubes 1 oz"');

  // 8: tasting copies rating to an unrated batch
  ok(await until(async () => (await p.locator('.hero .rating-none').count() === 1)), '8: the batch starts unrated');
  await open('tasting');
  ok(await until(async () => (await p.getByLabel('Set as the batch rating').count() === 1)), '8 (now #8): the tasting has a "Set as the batch rating" checkbox');
  await p.getByRole('dialog').getByRole('slider', { name: 'Rating' }).fill('8'); await p.waitForTimeout(100);
  await p.screenshot({ path: `${out}/4-tasting.png` });
  await save();
  ok(await until(async () => ((await p.locator('.hero .rating').getAttribute('aria-label')) === 'Rated 8 out of 10')), '8: the batch is now rated 8');
  ok(await until(async () => (await p.locator('.timeline-entry .rating[aria-label="Rated 8 out of 10"]').count() === 1)), '8: the tasting shows its star in the timeline');
  await open('tasting');
  await p.getByRole('dialog').getByRole('slider', { name: 'Rating' }).fill('6');
  await p.getByLabel('Set as the batch rating').uncheck(); await save();
  ok(await until(async () => ((await p.locator('.hero .rating').getAttribute('aria-label')) === 'Rated 8 out of 10')), '8: a later tasting of 6, unticked, leaves the batch at 8');
  ok(await until(async () => (await p.locator('.timeline-entry .rating[aria-label="Rated 6 out of 10"]').count() === 1)), '8: and shows 6 only in the timeline');
  await p.screenshot({ path: `${out}/5-detail.png`, fullPage: true });
  await p.emulateMedia({ colorScheme: 'dark' }); await p.goto(BASE + '/#/'); await p.waitForSelector('.shelf-item'); await p.waitForTimeout(3000);
  await p.screenshot({ path: `${out}/6-shelf-dark.png` });
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
