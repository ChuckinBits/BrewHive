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
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const dividers = (scope) => p.locator(`${scope} .stage-divider`).evaluateAll(hs => hs.map(h => h.textContent.replace(/Now$/, '').trim()));

  // Sample batch: dividers on the page and the timeline
  await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Load sample data' }).click();
  await p.getByRole('link', { name: /Orchard Cyser/ }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (JSON.stringify(await dividers('.staged-ingredients')) === JSON.stringify(['Primary ingredients', 'Secondary ingredients']))), '1: batch page shows Primary and Secondary ingredient dividers only');
  ok(await until(async () => (JSON.stringify(await dividers('.timeline-sections')) === JSON.stringify(['Secondary', 'Primary']))), '4: the timeline has Secondary and Primary dividers');
  const secondaryEntries = await p.locator('.timeline-sections > section').first().locator('.timeline-title > span').allTextContents();
  ok(secondaryEntries[secondaryEntries.length - 1] === 'Moved to Secondary', '4: "Moved to Secondary" sits at the bottom of the Secondary section');
  ok(await until(async () => (await p.locator('.staged-row-done', { hasText: 'Cinnamon stick' }).count() === 1)), '3: the logged cinnamon stick shows as done');
  await p.screenshot({ path: `${out}/1-cyser.png`, fullPage: true });

  // New batch: add ingredients through the pop-up
  await p.goto(BASE + '/#/batches/new');
  await p.getByLabel('Name').fill('Issue 10 Test');
  const addIngredient = async (name, qty, unit, stage) => {
    await p.getByRole('button', { name: 'Add ingredient' }).click();
    await p.getByRole('dialog').getByRole('combobox', { name: 'Ingredient', exact: true }).fill(name);
    if (qty) await p.getByRole('dialog').getByLabel('Quantity').fill(qty);
    if (unit !== undefined) await p.getByRole('dialog').getByLabel('Unit').first().selectOption(unit);
    if (stage) await p.getByRole('dialog').getByLabel(/^Stage/).selectOption(stage);
    await p.getByRole('dialog').getByRole('button', { name: 'Add ingredient' }).click();
    await p.getByRole('dialog').waitFor({ state: 'detached' });
  };
  await p.getByRole('button', { name: 'Add ingredient' }).click();
  const stages = await p.getByRole('dialog').getByLabel(/^Stage/).locator('option').allTextContents();
  ok(JSON.stringify(stages) === JSON.stringify(['Primary', 'Secondary', 'Aging', 'Bottling']), '1: Stage dropdown has Primary, Secondary, Aging, Bottling');
  await p.screenshot({ path: `${out}/2-ingredient-sheet.png` });
  await p.keyboard.press('Escape');
  await addIngredient('Clover honey', '3', 'lb', 'primary');
  await addIngredient('Priming sugar', '1', 'oz', 'bottling');
  await addIngredient('Lalvin 71B', '1', 'packet', 'primary');
  await addIngredient('Raspberries', '2', 'lb', 'secondary');
  ok(await until(async () => (JSON.stringify(await dividers('.staged-ingredients')) === JSON.stringify(['Primary ingredients', 'Secondary ingredients', 'Bottling ingredients']))), '1: the form groups ingredients Primary, Secondary, Bottling (no empty Aging)');
  ok(await until(async () => ((await p.locator('.staged-row', { hasText: 'Clover honey' }).textContent()).includes('3 lb'))), '1: amount reads "3 lb"');
  // edit one
  await p.locator('.staged-row', { hasText: 'Raspberries' }).click();
  ok(await until(async () => ((await p.getByRole('dialog').getByLabel('Quantity').inputValue()) === '2' && (await p.getByRole('dialog').getByLabel('Unit').first().inputValue()) === 'lb')), '1: tapping an ingredient opens it with its values');
  await p.getByRole('dialog').getByLabel('Quantity').fill('2.5'); await p.getByRole('dialog').getByRole('button', { name: 'Save ingredient' }).click();
  await p.screenshot({ path: `${out}/3-form.png`, fullPage: true });
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => ((await p.locator('.staged-row', { hasText: 'Raspberries' }).textContent()).includes('2.5 lb'))), '1: the edit was saved (2.5 lb)');

  // 3: tap current-stage ingredients to log them
  ok(await until(async () => (await p.locator('button.staged-row').count() === 2)), '3: only the 2 Primary ingredients are tappable');
  await p.getByRole('button', { name: 'Log Clover honey as added' }).click(); await p.getByRole('dialog').last().getByRole('button', { name: 'Add to timeline' }).click(); await p.getByRole('dialog').waitFor({ state: 'detached' }); await p.waitForTimeout(300);
  ok(await until(async () => (await p.locator('.staged-row-done', { hasText: 'Clover honey' }).count() === 1 && await p.getByRole('button', { name: 'Log Clover honey as added' }).count() === 0)), '3: once logged, Clover honey is no longer tappable');
  ok(await until(async () => ((await p.locator('.timeline-title > span').allTextContents()).includes('Added Clover honey 3 lb'))), '3: "Added Clover honey 3 lb" is on the timeline');
  await p.screenshot({ path: `${out}/4-logged.png`, fullPage: true });
  // delete the entry -> tappable again
  await p.getByRole('button', { name: /^Edit Added Clover honey/ }).click();
  await p.getByRole('button', { name: 'Remove entry' }).click(); await p.getByRole('button', { name: 'Remove', exact: true }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await p.getByRole('button', { name: 'Log Clover honey as added' }).count() === 1)), '3: removing the entry makes Clover honey tappable again');

  // 2: ingredient timeline entry adds to the list in the current stage
  await p.getByRole('button', { name: 'Secondary', exact: true }).click(); await p.waitForTimeout(300);
  // The sample data has vessels, so moving to Secondary offers racking into one (v0.3): not now.
  await p.getByRole('dialog', { name: 'Racked into a new vessel?' }).getByRole('button', { name: 'Not now' }).click(); await p.waitForTimeout(200);
  ok(await until(async () => (await p.getByRole('button', { name: 'Log Raspberries as added' }).count() === 1 && await p.getByRole('button', { name: 'Log Clover honey as added' }).count() === 1)), '3: in Secondary, Raspberries become tappable and Primary ones still are');
  await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('ingredient'), exact: true }).click(); await sugarAs(p, 'ingredient');
  ok(await until(async () => (await p.getByLabel(/^Add to batch ingredients/).isChecked())), '2: "Add to batch ingredients" is checked by default');
  ok(await until(async () => (await p.getByRole('dialog').getByRole('combobox', { name: 'Stage' }).inputValue() === 'secondary')), '2: its Stage is the one the batch is in now: Secondary');
  await p.getByRole('dialog').getByRole('combobox', { name: 'Ingredient', exact: true }).fill('Lemon zest'); await p.getByRole('dialog').getByLabel('Quantity').fill('1'); await p.getByRole('dialog').getByLabel('Unit').first().selectOption('');
  await p.screenshot({ path: `${out}/5-ingredient-entry.png` });
  await p.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(400);
  const secondary = p.locator('.staged-ingredients section', { has: p.locator('.stage-divider', { hasText: 'Secondary ingredients' }) });
  ok(await until(async () => (await secondary.locator('.staged-row-done', { hasText: 'Lemon zest' }).count() === 1)), '2: Lemon zest joins Secondary ingredients, already ticked off');
  // unchecked: not added to the list
  await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('ingredient'), exact: true }).click(); await sugarAs(p, 'ingredient');
  await p.getByLabel(/^Add to batch ingredients/).uncheck();
  await p.getByRole('dialog').getByRole('combobox', { name: 'Ingredient', exact: true }).fill('Tannin'); await p.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await p.locator('.staged-row', { hasText: 'Tannin' }).count() === 0 && (await p.locator('.timeline-title > span').allTextContents()).includes('Added Tannin'))), '2: unchecked, it goes on the timeline only');
  ok(await until(async () => (JSON.stringify(await dividers('.timeline-sections')) === JSON.stringify(['Secondary']))), '4: the new batch\'s timeline shows a Secondary section (Primary has no entries now that pitching is not automatic)');
  await p.screenshot({ path: `${out}/6-final.png`, fullPage: true });
  await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/7-dark.png`, fullPage: true });
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
