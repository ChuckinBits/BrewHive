const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const out = process.argv[2];
  const rows = () => p.locator('.library-row .library-name').allTextContents();
  const price = (name) => p.locator('.library-row', { has: p.locator('.library-name', { hasText: new RegExp('^' + name.replace(/[()]/g, '\\$&') + '$') }) }).locator('.muted').textContent();
  const toastText = async (text) => (await p.locator('.toast', { hasText: text }).count()) === 1 || (await p.locator('.toast', { hasText: text }).waitFor({ timeout: 3000 }).then(() => true, () => false));
  const open = async (hash) => { await p.goto(BASE + '/' + hash); await p.waitForTimeout(700); };

  await open('#/ingredients');
  const starters = (await rows()).length;
  ok(starters === 100, 'a fresh install has the 100 starter ingredients');

  // Delete a starter, price another, add one of my own
  await p.getByRole('link', { name: /^Wildflower honey/ }).click(); await p.waitForSelector('form');
  await p.getByRole('button', { name: 'Delete', exact: true }).click(); await p.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click(); await p.waitForURL(/#\/ingredients$/);
  await p.getByRole('link', { name: /^Clover honey/ }).click(); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: /^Price/ }).fill('20'); await p.getByRole('textbox', { name: 'Amount' }).fill('10');
  await p.locator('.cost-row').getByRole('combobox', { name: 'Unit' }).selectOption('lb');
  await p.getByRole('button', { name: 'Save ingredient' }).click(); await p.waitForURL(/#\/ingredients$/);
  await p.getByRole('link', { name: 'Add ingredient' }).click(); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Butterfly pea'); await p.getByRole('button', { name: 'Add ingredient' }).click(); await p.waitForURL(/#\/ingredients$/);
  ok(!(await rows()).includes('Wildflower honey') && (await rows()).includes('Butterfly pea'), 'Wildflower honey deleted, Butterfly pea added');

  // Restore starter ingredients
  await p.getByRole('button', { name: 'Restore starter ingredients' }).scrollIntoViewIfNeeded();
  await p.screenshot({ path: out + '/starters-restore.png' });
  await p.getByRole('button', { name: 'Restore starter ingredients' }).click();
  ok(await toastText('1 starter ingredient restored'), 'Restore: "1 starter ingredient restored"');
  ok((await rows()).includes('Wildflower honey') && (await price('Wildflower honey')).trim() === 'lb', 'Wildflower honey is back, unpriced');
  ok((await price('Clover honey')).includes('$2.00'), 'Clover honey keeps its price ($2.00 / lb)');
  ok((await rows()).includes('Butterfly pea'), 'Butterfly pea is left alone');
  await p.getByRole('button', { name: 'Restore starter ingredients' }).click();
  ok(await toastText('All starter ingredients are already in your list'), 'again: "All starter ingredients are already in your list"');
  await p.reload(); await p.waitForTimeout(700);
  ok((await rows()).filter((n) => n === 'Wildflower honey').length === 1, 'and reopening the app adds no duplicates');

  // Erase everything
  await open('#/more');
  await p.getByRole('button', { name: 'Erase everything' }).click();
  ok((await p.getByRole('dialog').textContent()).includes('the starter ingredients put back'), 'the warning says the starter ingredients are put back');
  await p.getByRole('dialog').getByRole('button', { name: 'Erase everything' }).click(); await p.waitForTimeout(500);
  await open('#/ingredients');
  const after = await rows();
  ok(after.length === 100 && !after.includes('Butterfly pea'), 'after erasing: the 100 starters, without Butterfly pea');
  ok((await price('Clover honey')).trim() === 'lb', 'and without the Clover honey price');

  // Sample data, after pricing Clover honey myself
  await p.getByRole('link', { name: /^Clover honey/ }).click(); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: /^Price/ }).fill('20'); await p.getByRole('textbox', { name: 'Amount' }).fill('10');
  await p.locator('.cost-row').getByRole('combobox', { name: 'Unit' }).selectOption('lb');
  await p.getByRole('button', { name: 'Save ingredient' }).click(); await p.waitForURL(/#\/ingredients$/);
  await open('#/more');
  await p.getByRole('button', { name: 'Add sample data' }).click(); await p.waitForTimeout(800);
  await open('#/ingredients');
  const withSamples = await rows();
  ok(withSamples.length === 102 && ['Spring water', 'Oranges'].every((n) => withSamples.includes(n)), 'sample data adds its 2 own ingredients (102); the rest are starters');
  ok((await price('Blackberries')).includes('$4.50') && (await price('Spring water')).includes('$1.49'), 'they have prices');
  ok((await price('Wildflower honey')).includes('$2.08') && (await price('Lalvin 71B')).includes('$1.49'), 'the starters the samples use get prices too (Wildflower honey $2.08 / lb)');
  ok((await price('Clover honey')).includes('$2.00'), 'but a price I set stays: Clover honey $2.00 / lb');
  ok((await price('Buckwheat honey')).trim() === 'lb', 'starters the samples don\'t use stay unpriced');
  await p.getByRole('link', { name: /^Wildflower honey/ }).click(); await p.waitForSelector('form');
  ok(await p.locator('.used-in').getByRole('link').count() >= 3, 'Wildflower honey shows the sample recipes and batches that use it');
  await open('#/batches');
  await p.getByRole('link', { name: /Winter Spice/ }).first().click(); await p.waitForSelector('.hero');
  const details = p.locator('section.card', { has: p.getByRole('heading', { name: 'Details' }) });
  const cost = await details.locator('dt', { hasText: /^Ingredient cost$/ }).locator('xpath=following-sibling::dd[1]').textContent();
  ok(cost === '$8.44' && await details.getByText(/^No cost:|^No amount:|^Cost in other units:/).count() === 0, 'a sample batch shows its full cost: ' + cost);
  // The recipe and the batch made from it agree
  const factOf = async (label) => details.locator('dt', { hasText: new RegExp('^' + label + '$') }).locator('xpath=following-sibling::dd[1]').textContent();
  await open('#/batches'); await p.getByRole('button', { name: /^Bottled/ }).click();
  await p.getByRole('link', { name: /First Traditional/ }).first().click(); await p.waitForSelector('.hero');
  const batchCost = await factOf('Ingredient cost');
  await open('#/recipes'); await p.getByRole('link', { name: /First Traditional/ }).first().click(); await p.waitForSelector('.hero');
  const card = p.getByRole('region', { name: 'Ingredient cost' });
  const recipeCost = await card.locator('.cost-total').textContent();
  ok(batchCost === recipeCost && await card.getByText(/^No cost:|^No amount:|^Cost in other units:/).count() === 0, 'First Traditional costs the same as a recipe and as a batch: ' + recipeCost);
  await open('#/recipes'); await p.getByRole('link', { name: /Bramble Melomel/ }).first().click(); await p.waitForSelector('.hero');
  const bramble = await card.locator('.cost-total').textContent();
  await open('#/batches'); await p.getByRole('link', { name: /Bramble Melomel #2/ }).first().click(); await p.waitForSelector('.hero');
  const brambleBatch = await factOf('Ingredient cost');
  const perGallon = await factOf('Per gallon');
  ok(perGallon === brambleBatch, 'a 1 gallon batch costs the same per gallon as in total: ' + perGallon);
  ok(bramble === '$17.85' && brambleBatch === '$20.52', 'Bramble uses my Clover honey price: recipe ' + bramble + ', batch ' + brambleBatch + ' (with oak)');
  await details.scrollIntoViewIfNeeded(); await p.screenshot({ path: out + '/starters-sample-batch.png' });
  await open('#/more');
  await p.getByRole('button', { name: 'Add sample data' }).click(); await p.waitForTimeout(800);
  await open('#/ingredients');
  ok((await rows()).length === 102, 'adding sample data again adds no duplicate ingredients');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
