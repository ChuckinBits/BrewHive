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
const out = process.argv[2];
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const dividers = () => p.locator('.staged-ingredients .stage-divider').evaluateAll(hs => hs.map(h => h.textContent.replace(/Now$/, '').trim()));
  await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Load sample data' }).click();

  // Unit list and Stage hint (batch form)
  await p.goto(BASE + '/#/batches/new');
  await p.getByRole('button', { name: 'Add ingredient' }).click();
  const units = await p.getByRole('dialog').getByLabel('Unit').first().locator('option').allTextContents();
  console.log('    units: ' + units.join(' | '));
  ok(units[0] === 'No unit (a count)' && units.includes('Pound (lb)') && units.includes('Fluid ounce (fl oz)') && units.includes('Cup'), 'units are spelled out with the short form in brackets');
  const names = units.slice(1);
  ok(JSON.stringify(names) === JSON.stringify([...names].sort((a, c) => a.localeCompare(c))), 'units are A to Z');
  ok(await until(async () => (await p.getByText('What stage this ingredient goes in.').count() === 1 && await p.getByText(/priming sugar/).count() === 0)), 'Stage hint reads "What stage this ingredient goes in."');
  await p.screenshot({ path: `${out}/1-batch-sheet.png` });
  await p.keyboard.press('Escape');

  // Recipe page: grouped, read-only
  await p.goto(BASE + '/#/recipes');
  await p.getByRole('link', { name: /Orchard Cyser/ }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (JSON.stringify(await dividers()) === JSON.stringify(['Primary ingredients', 'Secondary ingredients']))), 'recipe page groups ingredients under stage dividers');
  ok(await until(async () => (await p.locator('button.staged-row').count() === 0 && await p.locator('.stage-now').count() === 0)), 'recipe ingredients are not tappable and have no "Now"');
  await p.screenshot({ path: `${out}/2-recipe.png`, fullPage: true });

  // Recipe form: same pop-up
  await p.getByRole('link', { name: 'Edit recipe' }).click(); await p.waitForSelector('form');
  ok(await until(async () => (JSON.stringify(await dividers()) === JSON.stringify(['Primary ingredients', 'Secondary ingredients']))), 'recipe form groups ingredients the same way');
  await p.getByRole('button', { name: 'Add ingredient' }).click();
  ok(await until(async () => (await p.getByRole('dialog').getByLabel('Unit').count() === 1 && await p.getByText('What stage this ingredient goes in.').count() === 1)), 'recipe form uses the same ingredient pop-up');
  await p.getByRole('dialog').getByRole('combobox', { name: 'Ingredient', exact: true }).fill('Vanilla bean');
  await p.getByRole('dialog').getByLabel('Quantity').fill('1');
  await p.getByRole('dialog').getByLabel(/^Stage/).selectOption('aging');
  await p.getByRole('dialog').getByRole('button', { name: 'Add ingredient' }).click();
  await p.locator('.staged-row', { hasText: 'Orange blossom honey' }).click();
  ok(await until(async () => ((await p.getByRole('dialog').getByLabel('Quantity').inputValue()) === '1.5' && (await p.getByRole('dialog').getByLabel('Unit').inputValue()) === 'lb')), 'an older recipe amount "1.5 lb" opens as 1.5 and Pound');
  await p.keyboard.press('Escape');
  await p.screenshot({ path: `${out}/3-recipe-form.png`, fullPage: true });
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (JSON.stringify(await dividers()) === JSON.stringify(['Primary ingredients', 'Secondary ingredients', 'Aging ingredients']))), 'the saved recipe shows the new Aging ingredient');

  // Start a batch from the recipe: stages carry over
  await p.getByRole('link', { name: 'Start a batch' }).click(); await p.waitForSelector('form');
  ok(await until(async () => (JSON.stringify(await dividers()) === JSON.stringify(['Primary ingredients', 'Secondary ingredients', 'Aging ingredients']))), 'a batch started from the recipe keeps each ingredient\'s stage');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await p.getByRole('button', { name: 'Log Orange blossom honey as added' }).count() === 1 && await p.getByRole('button', { name: /Log Vanilla bean/ }).count() === 0)), 'on the new batch, Primary ingredients are tappable and Aging ones are not');
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
