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
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Picker test');
  await p.getByRole('button', { name: /Add ingredient/ }).first().click();
  const field = d.getByRole('combobox', { name: 'Ingredient', exact: true });
  const list = d.getByRole('listbox', { name: 'Your ingredients' });
  ok(await until(async () => (await list.isVisible() && await list.getByRole('option').count() >= 25)), 'opening the sheet shows the full ingredient list (' + await list.getByRole('option').count() + ')');
  await d.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Yeast', exact: true }).click();
  ok(await until(async () => (await list.getByRole('option').count() === 12)), 'the Yeast chip narrows it to the twelve yeasts');
  await d.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'All', exact: true }).click();
  await field.fill('clov');
  ok(await until(async () => ((await list.getByRole('option').allTextContents()).map((t) => t.replace(/(Honey|Spices)$/, '')).sort().join() === 'Clove,Clover honey')), 'typing "clov" leaves Clove and Clover honey');
  ok(await until(async () => (await d.getByText('Save to my ingredients').count() === 0 && await d.getByRole('button', { name: 'Your ingredients' }).count() === 0)), 'no Save to my ingredients checkbox or Your ingredients button');
  ok(await until(async () => (await d.getByRole('button', { name: 'Save "clov" as a new ingredient' }).count() === 1)), 'a name not in the list offers: Save "clov" as a new ingredient');
  await p.screenshot({ path: out + '/32-picker.png' });
  await list.getByRole('button', { name: /Clover honey/ }).click();
  ok(await until(async () => (await field.inputValue() === 'Clover honey' && await d.getByRole('combobox', { name: 'Unit' }).first().inputValue() === 'lb')), 'picking it fills the name and its default unit (lb)');
  await field.click();
  ok(await until(async () => (await d.getByRole('button', { name: 'New ingredient', exact: true }).count() === 1)), 'a picked name offers a plain New ingredient instead');
  ok(await until(async () => (await list.getByRole('option').count() >= 25)), 'tapping a picked name shows the whole list again');
  await d.getByRole('button', { name: 'Close list' }).click();
  await d.getByRole('textbox', { name: 'Quantity' }).fill('3');
  await d.getByRole('button', { name: 'Add ingredient' }).click(); await p.waitForTimeout(300);

  // A new name, saved through the full New ingredient form
  await p.getByRole('button', { name: /Add ingredient/ }).first().click();
  await d.getByRole('group', { name: 'Category' }).getByRole('button', { name: 'Fruit', exact: true }).click();
  await field.fill('Boysenberries');
  await d.getByRole('combobox', { name: 'Unit' }).first().selectOption('lb');
  await p.screenshot({ path: out + '/32-new.png' });
  await d.getByRole('button', { name: 'Save "Boysenberries" as a new ingredient' }).click();
  const nf = p.getByRole('dialog', { name: 'New ingredient' });
  ok(await until(async () => (await nf.getByRole('textbox', { name: 'Name' }).inputValue() === 'Boysenberries')), 'it opens New ingredient with the name filled in');
  ok(await until(async () => (await nf.getByRole('combobox', { name: 'Category' }).inputValue() === 'fruit')), 'in the category chip that was picked (Fruit)');
  ok(await until(async () => (await nf.getByRole('combobox', { name: 'Default unit' }).inputValue() === 'lb')), 'with the unit being used as its default (lb)');
  await nf.getByRole('textbox', { name: /^Price/ }).fill('9'); await nf.getByRole('textbox', { name: 'Amount' }).fill('3');
  await p.waitForTimeout(400); await p.screenshot({ path: out + '/32-new-form.png' });
  await nf.getByRole('button', { name: 'Save new ingredient' }).click(); await nf.waitFor({ state: 'detached' });
  ok(await until(async () => (await field.inputValue() === 'Boysenberries' && await d.getByRole('listbox').count() === 0)), 'back in the ingredient, Boysenberries is picked');
  await d.getByRole('textbox', { name: 'Quantity' }).fill('2');
  ok(await until(async () => (await d.getByText('= $6.00 in this batch.').count() === 1 && await d.getByRole('textbox', { name: /^Price/ }).inputValue() === '9')), 'and its price fills in right away: $6.00 for 2 lb');
  await d.getByRole('button', { name: 'Add ingredient' }).click(); await p.waitForTimeout(400);
  // A typed name that isn't saved is used once
  await p.getByRole('button', { name: /Add ingredient/ }).first().click();
  await field.fill('Grandma secret spice');
  await d.getByRole('button', { name: 'Close list' }).click();
  await d.getByRole('button', { name: 'Add ingredient' }).click(); await p.waitForTimeout(300);
  // Cancelling New ingredient goes back with the name as typed
  await p.getByRole('button', { name: /Add ingredient/ }).first().click();
  await field.fill('Elderflower');
  await d.getByRole('button', { name: 'Save "Elderflower" as a new ingredient' }).click();
  await nf.getByRole('button', { name: 'Close' }).click(); await nf.waitFor({ state: 'detached' });
  ok(await until(async () => (await field.inputValue() === 'Elderflower')), 'closing New ingredient goes back with the name as typed');
  await d.getByRole('button', { name: 'Close', exact: true }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForURL(/#\/batches\/[^n]/); await p.waitForSelector('.hero');
  const batchUrl = p.url();

  await p.goto(BASE + '/#/ingredients'); await p.waitForTimeout(400);
  ok(await until(async () => (await p.getByRole('region', { name: 'Fruit' }).getByRole('link', { name: /Boysenberries/ }).count() === 1)), 'Boysenberries was saved under Fruit');
  ok(await until(async () => (await p.getByRole('link', { name: /Boysenberries\s*\$3\.00 \/ lb/ }).count() === 1)), 'with its price, $3.00 / lb');
  ok(await until(async () => (await p.getByRole('link', { name: /Grandma secret spice|Elderflower/ }).count() === 0)), 'names that weren\'t saved stay out of the list');
  // Linked lines count in Used in, even after renaming the library item
  await p.getByRole('link', { name: /Clover honey/ }).click(); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Clover honey (local)'); await p.getByRole('button', { name: 'Save ingredient' }).click(); await p.waitForURL(/#\/ingredients$/);
  await p.getByRole('link', { name: /Clover honey \(local\)/ }).click(); await p.waitForSelector('form');
  ok(await until(async () => (await p.locator('.used-in').getByRole('link', { name: /Picker test/ }).count() === 1)), 'after renaming, Used in still finds the batch through its link');
  await p.goto(batchUrl); await p.waitForSelector('.hero');
  ok(await until(async () => (await p.getByText('Clover honey', { exact: true }).count() >= 1)), 'the batch keeps the name it was added with');

  // In a recipe, saving a new ingredient doesn't lose the recipe being written
  await p.goto(BASE + '/#/recipes/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Draft recipe');
  await p.getByRole('button', { name: /Add ingredient/ }).first().click();
  await d.getByRole('button', { name: 'New ingredient', exact: true }).click();
  ok(await until(async () => (await nf.getByRole('textbox', { name: 'Name' }).inputValue() === '')), 'with nothing typed, New ingredient starts empty');
  await nf.getByRole('textbox', { name: 'Name' }).fill('Butterfly pea'); await nf.getByRole('combobox', { name: 'Category' }).selectOption('herb');
  await nf.getByRole('combobox', { name: 'Default unit' }).selectOption('oz');
  await nf.getByRole('button', { name: 'Save new ingredient' }).click(); await nf.waitFor({ state: 'detached' });
  ok(await until(async () => (await field.inputValue() === 'Butterfly pea' && await d.getByRole('combobox', { name: 'Unit' }).first().inputValue() === 'oz')), 'Butterfly pea is picked, in oz');
  await d.getByRole('button', { name: 'Close', exact: true }).click(); await p.waitForTimeout(300);
  ok(await until(async () => (await p.getByRole('textbox', { name: 'Name' }).inputValue() === 'Draft recipe')), 'the recipe being written is still there');
  console.log(errors.length ? 'ERRORS ' + errors : 'no console errors'); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
