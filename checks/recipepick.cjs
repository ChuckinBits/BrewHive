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
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
// Update recipe: every change has a checkbox, all ticked; unticked ones stay as the recipe has them.
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const d = p.getByRole('dialog');
  await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Load sample data' }).click(); await p.waitForSelector('.shelf-item');
  await p.getByRole('button', { name: /^All/ }).click(); await p.getByRole('link', { name: /Winter Spice/ }).first().click(); await p.waitForSelector('.hero');
  const batchUrl = p.url();
  await p.getByRole('button', { name: 'Save as recipe' }).click(); await p.getByRole('button', { name: 'Save recipe' }).click(); await p.waitForURL(/#\/recipes\//); await p.waitForSelector('.hero');
  const recipeUrl = p.url();

  // Change the batch three ways: OG, a new ingredient, the rating.
  await p.goto(batchUrl); await p.waitForSelector('.hero');
  await p.getByRole('link', { name: 'Edit batch' }).click(); await p.waitForSelector('form');
  await p.getByLabel(/^Original gravity/).fill('1.110');
  await p.getByRole('button', { name: 'Add ingredient' }).click();
  await d.getByRole('combobox', { name: 'Ingredient', exact: true }).fill('Vanilla bean'); await d.getByLabel('Quantity').fill('1');
  await d.getByLabel('Unit').first().selectOption(''); await d.getByLabel(/^Stage/).selectOption('aging');
  await d.getByRole('button', { name: 'Add ingredient' }).click();
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForSelector('.hero');
  await p.locator('.rating-card').getByRole('button', { name: 'Change' }).click();
  await d.getByRole('slider', { name: 'Rating' }).fill('9'); await d.getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(300);

  await p.getByRole('button', { name: 'Update recipe' }).click();
  const boxes = d.locator('.change-picks input[type=checkbox]');
  ok(await until(async () => (await boxes.count() === 3)), 'three changes, each with a checkbox: ' + (await d.locator('.change-picks li').allTextContents()).join(' | '));
  ok(await until(async () => (await boxes.evaluateAll(bs => bs.every(b => b.checked)))), 'all ticked by default');
  ok(await until(async () => (await d.getByRole('heading', { name: 'Ingredients' }).count() === 1)), 'ingredient changes have their own heading');
  await d.getByLabel('Rating 8.5 → 9').uncheck();
  ok(await until(async () => (await d.getByRole('button', { name: 'Update recipe with 2 changes' }).count() === 1)), 'unticking the rating: "Update recipe with 2 changes"');
  await p.screenshot({ path: `${process.argv[2] || '/tmp'}/recipe-pick.png` });

  // Nothing ticked: it asks for at least one
  await d.getByLabel('Target OG 1.105 → 1.110').uncheck(); await d.getByLabel(/^Added Vanilla bean/).uncheck();
  await d.getByRole('button', { name: /^Update recipe/ }).click();
  ok(await until(async () => (await d.getByRole('alert').getByText('Tick at least one change').count() === 1)), 'with nothing ticked, it asks for at least one change');
  await d.getByLabel('Target OG 1.105 → 1.110').check(); await d.getByLabel(/^Added Vanilla bean/).check();
  await d.getByRole('button', { name: 'Update recipe with 2 changes' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await p.getByText('Recipe updated with 2 changes').count() === 1)), 'it says it updated with 2 changes');

  await p.goto(recipeUrl); await p.waitForSelector('.rating-card');
  ok(await until(async () => ((await p.locator('.stat-value').first().textContent()) === '1.110' && await p.getByText('Vanilla bean', { exact: true }).count() === 1)), 'the recipe took the OG and the vanilla bean');
  ok(await until(async () => ((await p.locator('.rating-card .rating').getAttribute('aria-label')) === 'Rated 8.5 out of 10')), 'and kept its 8.5 rating, which was unticked');

  // Next time, only the rating is left to update
  await p.goto(batchUrl); await p.waitForSelector('.hero');
  await p.getByRole('button', { name: 'Update recipe' }).click();
  ok(await until(async () => (JSON.stringify(await d.locator('.change-picks li').allTextContents()) === '["Rating 8.5 → 9"]')), 'the next update offers just the rating');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
