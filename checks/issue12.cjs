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
  const goBatch = async (name) => { await p.goto(BASE + '/#/'); await p.getByRole('button', { name: /^All/ }).click(); await p.getByRole('link', { name: new RegExp(name) }).first().click(); await p.waitForSelector('.hero'); };
  await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Load sample data' }).click(); await p.waitForSelector('.shelf-item');

  // Save a batch with no recipe
  await goBatch('Winter Spice');
  ok(await until(async () => (await p.getByRole('button', { name: 'Save as recipe' }).count() === 1)), 'a batch without a recipe shows "Save as recipe"');
  await p.getByRole('button', { name: 'Save as recipe' }).click();
  ok(await until(async () => ((await p.getByLabel('Recipe name').inputValue()) === 'Winter Spice')), 'the name is filled in from the batch');
  await p.screenshot({ path: `${out}/1-save-sheet.png` });
  await p.getByRole('button', { name: 'Save recipe' }).click(); await p.waitForURL(/#\/recipes\//); await p.waitForSelector('.hero');
  console.log('    now at ' + p.url().split('#')[1] + ' titled ' + JSON.stringify(await p.locator('.topbar-title').textContent()));
  ok(await until(async () => ((await p.locator('.topbar-title').textContent()) === 'Winter Spice' && p.url().includes('#/recipes/'))), 'saving opens the new recipe');
  console.log('    stats: ' + (await p.locator('.stat-value').allTextContents()).join(' '));
  ok(await until(async () => ((await p.locator('.stat-value').allTextContents()).join(' ') === '1.105 1.002 13.5%')), 'recipe has target OG 1.105 and FG 1.002 (the batch\'s final gravity)');
  ok(await until(async () => (await p.getByText('Wildflower honey', { exact: true }).count() === 1 && await p.getByText('Go easy on the cloves next time.').count() === 1)), 'ingredients and batch notes were copied');
  ok(await until(async () => (/Updated from Winter Spice on \w+ \d+/.test(await p.locator('.hero-note').textContent()))), '2: the recipe says "Updated from Winter Spice on …"');
  await p.screenshot({ path: `${out}/2-new-recipe.png`, fullPage: true });

  // Up to date
  await p.locator('.hero-note a').click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await p.getByRole('button', { name: 'Update recipe' }).count() === 1)), 'the batch button now reads "Update recipe"');
  await p.getByRole('button', { name: 'Update recipe' }).click();
  ok(await until(async () => (await p.getByText('The recipe already matches this batch.').count() === 1 && await p.getByRole('dialog').getByRole('button', { name: 'Update recipe' }).isDisabled())), 'with nothing changed, it says the recipe already matches');
  await p.keyboard.press('Escape');

  // Change the batch, then update
  await p.getByRole('link', { name: 'Edit batch' }).click(); await p.waitForSelector('form');
  await p.getByLabel(/^Original gravity/).fill('1.110');
  await p.getByRole('button', { name: 'Add ingredient' }).click();
  await p.getByRole('dialog').getByRole('combobox', { name: 'Ingredient', exact: true }).fill('Vanilla bean'); await p.getByRole('dialog').getByLabel('Quantity').fill('1');
  await p.getByRole('dialog').getByLabel('Unit').first().selectOption(''); await p.getByRole('dialog').getByLabel(/^Stage/).selectOption('aging');
  await p.getByRole('dialog').getByRole('button', { name: 'Add ingredient' }).click();
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForSelector('.hero');
  await p.getByRole('button', { name: 'Update recipe' }).click();
  const changes = await p.locator('.change-list li').allTextContents();
  console.log('    changes: ' + changes.join(' | '));
  ok(changes.includes('Target OG 1.105 → 1.110') && changes.includes('Added Vanilla bean (1, Aging)'), 'the update lists "Target OG 1.105 → 1.110" and the added vanilla bean');
  ok(await until(async () => (await p.locator('.warning').count() === 0)), 'no warning when no other batch uses the recipe');
  await p.screenshot({ path: `${out}/3-update-sheet.png` });
  await p.getByRole('dialog').getByRole('button', { name: 'Update recipe' }).click(); await p.waitForTimeout(400);
  await p.getByRole('link', { name: 'Winter Spice' }).last().click(); await p.waitForSelector('.hero');
  ok(await until(async () => ((await p.locator('.stat-value').first().textContent()) === '1.110' && await p.getByText('Vanilla bean', { exact: true }).count() === 1)), 'the recipe now has OG 1.110 and the vanilla bean');
  ok(await until(async () => (await p.getByText('Go easy on the cloves next time.').count() === 1 && (await p.locator('.topbar-title').textContent()) === 'Winter Spice')), 'its name and notes stayed the same');

  // 1: warning when other batches use the recipe
  await p.getByRole('link', { name: 'Start a batch' }).click(); await p.waitForSelector('form');
  await p.getByLabel('Name').fill('Winter Spice #2'); await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  await goBatch('Winter Spice(?! #2)');
  await p.getByRole('link', { name: 'Edit batch' }).click(); await p.getByLabel(/^Original gravity/).fill('1.112');
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForSelector('.hero');
  await p.getByRole('button', { name: 'Update recipe' }).click();
  ok(await until(async () => ((await p.locator('.warning').textContent()).includes('1 other batch was started from this recipe: Winter Spice #2'))), '1: updating warns that Winter Spice #2 came from this recipe');
  await p.screenshot({ path: `${out}/4-warning.png` });

  // Save as a new recipe instead
  await p.getByRole('button', { name: 'Save as a new recipe instead' }).click();
  await p.getByLabel('Recipe name').fill('Winter Spice Strong');
  await p.getByRole('button', { name: 'Save recipe' }).click(); await p.waitForURL(/#\/recipes\//); await p.waitForSelector('.hero');
  ok(await until(async () => ((await p.locator('.topbar-title').textContent()) === 'Winter Spice Strong' && (await p.locator('.stat-value').first().textContent()) === '1.112')), 'saving as new creates "Winter Spice Strong" with OG 1.112');
  await p.goto(BASE + '/#/recipes'); await p.getByRole('link', { name: /(^|\s)Winter Spice\b(?! Strong)/ }).first().click(); await p.waitForSelector('.hero');
  ok(await until(async () => ((await p.locator('.stat-value').first().textContent()) === '1.110')), 'the original Winter Spice recipe is unchanged (1.110)');
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
