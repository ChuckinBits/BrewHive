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
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const out = process.argv[2];
  const d = p.getByRole('dialog').last();
  await p.goto(BASE + '/#/more'); await p.waitForTimeout(500);
  ok(await until(async () => (await p.getByRole('combobox', { name: 'Currency' }).inputValue() === 'USD')), 'currency defaults to USD for en-US');

  const setCost = async (name, price, qty, unit) => {
    await p.goto(BASE + '/#/ingredients'); await p.waitForTimeout(300);
    await p.getByRole('link', { name: new RegExp(name) }).click(); await p.waitForSelector('form');
    await p.getByRole('textbox', { name: /^Price/ }).fill(price); await p.getByRole('textbox', { name: 'Amount' }).fill(qty);
    await p.locator('.cost-row').getByRole('combobox', { name: 'Unit' }).selectOption(unit);
  };
  await setCost('Wildflower honey', '24.99', '12', 'lb');
  ok(await until(async () => (await p.getByText('= $2.08 per lb. Used for batch and recipe costs.').count() === 1)), '24.99 for 12 lb is $2.08 per lb');
  await p.screenshot({ path: out + '/33-cost-form.png', fullPage: true });
  await p.getByRole('button', { name: 'Save ingredient' }).click(); await p.waitForURL(/#\/ingredients$/);
  await p.getByRole('link', { name: /Wildflower honey\s*\$/ }).waitFor({ timeout: 3000 }).catch(() => {});
  ok(await until(async () => (await p.getByRole('link', { name: /Wildflower honey\s*\$2\.08 \/ lb/ }).count() === 1)), 'the list shows $2.08 / lb');
  await setCost('Lalvin 71B', '1.50', '1', 'packet'); await p.getByRole('button', { name: 'Save ingredient' }).click(); await p.waitForURL(/#\/ingredients$/);

  // A batch: 1 gal, 3 lb honey, 1 packet yeast, 2 cinnamon sticks (no cost)
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Costed mead'); await p.getByRole('textbox', { name: 'Volume' }).fill('1');
  const add = async (pickName, qty) => {
    await p.getByRole('button', { name: /Add ingredient/ }).first().click();
    await d.getByRole('combobox', { name: 'Ingredient', exact: true }).fill(pickName);
    await d.getByRole('listbox').getByRole('button', { name: new RegExp('^' + pickName) }).click();
    await d.getByRole('textbox', { name: 'Quantity' }).fill(qty);
  };
  await add('Wildflower honey', '3');
  ok(await until(async () => (await d.getByText('= $6.25 in this batch.').count() === 1)), 'the batch ingredient sheet starts from your price: 3 lb is $6.25');
  await d.getByRole('button', { name: 'Add ingredient' }).click(); await d.waitFor({ state: 'detached' });
  await add('Lalvin 71B', '1'); await d.getByRole('button', { name: 'Add ingredient' }).click(); await d.waitFor({ state: 'detached' });
  await add('Cinnamon sticks', '2'); await d.getByRole('button', { name: 'Add ingredient' }).click(); await d.waitFor({ state: 'detached' });
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForURL(/#\/batches\/[^n]/); await p.waitForSelector('.hero');
  const batchUrl = p.url();
  const card = p.getByRole('region', { name: 'Ingredient cost' });
  const details = p.locator('section.card', { has: p.getByRole('heading', { name: 'Details' }) });
  const fact = (label) => details.locator('dt', { hasText: new RegExp('^' + label + '$') }).locator('xpath=following-sibling::dd[1]').textContent();
  ok(await until(async () => (await card.count() === 0)), 'batches have no separate cost card');
  ok(await until(async () => (await fact('Ingredient cost') === '$7.75')), 'Details: the batch costs $7.75 (6.25 + 1.50)');
  ok(await until(async () => (await fact('Per bottle') === '$1.54 (750 mL)' && await fact('Per gallon') === '$7.75')), 'Details: per bottle $1.54, per gallon $7.75');
  ok(await until(async () => (await details.getByText('No cost: Cinnamon sticks.').count() === 1)), 'cinnamon is listed as not counted');
  const heads = await p.locator('section.card h2').allTextContents();
  ok(heads.indexOf('Details') >= 0 && heads.indexOf('Details') === heads.indexOf('Ingredients') - 1, 'Details comes right before Ingredients: ' + heads.join(', '));
  await details.evaluate(e => e.scrollIntoView({ block: 'start' })); await p.evaluate(() => window.scrollBy(0, -80)); await p.waitForTimeout(3500); await p.screenshot({ path: out + '/33-card.png' });

  // A price change: the batch keeps its price; a recipe uses today's
  await setCost('Wildflower honey', '30', '12', 'lb'); await p.getByRole('button', { name: 'Save ingredient' }).click(); await p.waitForURL(/#\/ingredients$/);
  await p.goto(batchUrl); await p.waitForSelector('.hero');
  ok(await until(async () => (await fact('Ingredient cost') === '$7.75')), 'after the honey price goes up, the batch still costs $7.75');
  await p.getByRole('link', { name: 'Edit batch' }).click(); await p.waitForSelector('form'); await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await fact('Ingredient cost') === '$7.75')), 'and still does after saving the batch again');
  await p.getByRole('button', { name: /Save as recipe/ }).click(); await d.getByRole('button', { name: 'Save recipe' }).click(); await p.waitForURL(/#\/recipes\//); await p.waitForSelector('.hero');
  ok(await until(async () => (await card.locator('.cost-total').textContent() === '$9.00' && await card.getByText("At today's prices from your ingredients.").count() === 1)), 'the recipe costs $9.00 at today\'s prices (7.50 + 1.50)');

  // Units that don't convert
  await setCost('Wildflower honey', '30', '12', 'lb');
  await p.getByRole('button', { name: 'Save ingredient' }).click(); await p.waitForURL(/#\/ingredients$/);
  await p.goto(BASE + '/#/recipes/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Cups'); await add('Wildflower honey', '2'); await d.getByRole('combobox', { name: 'Unit' }).selectOption('cup');
  ok(await until(async () => (await d.getByText("Its cost is in lb, so this amount isn't priced.").count() === 1)), 'cups of honey priced by the pound are not guessed');

  // Currency
  await d.getByRole('button', { name: 'Close', exact: true }).click();
  await p.goto(BASE + '/#/more'); await p.waitForTimeout(300);
  await p.getByRole('combobox', { name: 'Currency' }).selectOption('EUR'); await p.waitForTimeout(300);
  await p.goto(batchUrl); await p.waitForSelector('.hero');
  ok(await until(async () => ((await fact('Ingredient cost')).includes('€'))), 'switching to EUR shows euros (' + await fact('Ingredient cost') + ')');
  ok(await until(async () => (await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))), 'no sideways scrolling');
  console.log(errors.length ? 'ERRORS ' + errors : 'no console errors'); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
