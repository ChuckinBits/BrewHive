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
  await p.goto(BASE + '/#/ingredients'); await p.waitForTimeout(500);
  await p.getByRole('link', { name: /Wildflower honey/ }).click(); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: /^Price/ }).fill('24'); await p.getByRole('textbox', { name: 'Amount' }).fill('12');
  await p.locator('.cost-row').getByRole('combobox', { name: 'Unit' }).selectOption('lb');
  await p.getByRole('button', { name: 'Save ingredient' }).click(); await p.waitForURL(/#\/ingredients$/);

  // A batch with 3 lb of honey ($2/lb)
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Synced mead'); await p.getByRole('textbox', { name: 'Volume' }).fill('1');
  await p.getByRole('button', { name: /Add ingredient/ }).first().click();
  await d.getByRole('combobox', { name: 'Ingredient', exact: true }).fill('Wildflower');
  await d.getByRole('listbox').getByRole('button', { name: /^Wildflower honey/ }).click();
  await d.getByRole('textbox', { name: 'Quantity' }).fill('3');
  await d.getByRole('button', { name: 'Add ingredient' }).click(); await d.waitFor({ state: 'detached' });
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForURL(/#\/batches\/[^n]/); await p.waitForSelector('.hero');
  const batchUrl = p.url();
  const details = p.locator('section.card', { has: p.getByRole('heading', { name: 'Details' }) });
  const fact = (label) => details.locator('dt', { hasText: new RegExp('^' + label + '$') }).locator('xpath=following-sibling::dd[1]').textContent();
  const titles = () => p.locator('.timeline-title > span').allTextContents();
  const listRow = (name) => p.locator('.staged-ingredients .staged-row', { hasText: name });
  ok(await fact('Ingredient cost') === '$6.00', '3 lb of honey costs $6.00');

  // Log it from the list
  await p.getByRole('button', { name: 'Log Wildflower honey as added' }).click(); await p.getByRole('dialog').last().getByRole('button', { name: 'Add to timeline' }).click(); await p.getByRole('dialog').waitFor({ state: 'detached' }); await p.waitForTimeout(300);
  ok((await titles()).includes('Added Wildflower honey 3 lb'), 'logged from the list: "Added Wildflower honey 3 lb"');

  // 1: the entry form is the ingredient form, with the date
  const openEntry = async (text) => { await p.locator('.timeline-title', { hasText: text }).first().click(); await d.waitFor(); };
  await openEntry('Added Wildflower honey');
  ok(await d.getByRole('combobox', { name: 'Ingredient' }).inputValue() === 'Wildflower honey', '1: the entry opens in the ingredient form, with the name');
  ok(await d.getByRole('textbox', { name: 'Quantity' }).inputValue() === '3' && await d.getByRole('combobox', { name: 'Unit' }).inputValue() === 'lb', '1: quantity 3, unit lb');
  ok(await d.getByText('About $6.00 at your price for Wildflower honey.').count() === 1, '1: with the cost hint');
  ok(await d.getByLabel('When').count() === 1 && await d.getByLabel('Stage', { exact: true }).count() === 0, '1: a date in place of the stage');
  const alsoList = d.getByRole('checkbox', { name: 'Also update batch ingredients' });
  ok(await alsoList.isChecked(), '3: "Also update batch ingredients" is offered, ticked');
  await d.getByRole('textbox', { name: 'Quantity' }).fill('2.5');
  await p.waitForTimeout(3500); await p.screenshot({ path: out + '/35-entry.png' });
  await d.getByRole('button', { name: 'Save changes' }).click(); await d.waitFor({ state: 'detached' });
  ok((await titles()).includes('Added Wildflower honey 2.5 lb'), '3: the entry shows 2.5 lb');
  ok((await listRow('Wildflower honey').textContent()).includes('2.5 lb'), '3: so does the batch ingredient');
  ok(await fact('Ingredient cost') === '$5.00', '3: and the cost follows: $5.00');

  // 3: unticked, only the entry changes
  await openEntry('Added Wildflower honey');
  await alsoList.uncheck(); await d.getByRole('textbox', { name: 'Quantity' }).fill('2');
  await d.getByRole('button', { name: 'Save changes' }).click(); await d.waitFor({ state: 'detached' });
  ok((await titles()).includes('Added Wildflower honey 2 lb') && (await listRow('Wildflower honey').textContent()).includes('2.5 lb'), '3: unticked, the entry says 2 lb and the list keeps 2.5 lb');

  // 2: Batch Edit offers to update the timeline entry
  const editIngredient = async () => {
    await p.getByRole('link', { name: 'Edit batch' }).click(); await p.waitForSelector('form');
    await p.locator('.staged-row', { hasText: 'Wildflower honey' }).click(); await d.waitFor();
  };
  await editIngredient();
  const alsoEntry = d.getByRole('checkbox', { name: /^Also update the timeline entry \(\w{3} \d+, \d+:\d\d [AP]M\)$/ });
  ok(await alsoEntry.count() === 1 && await alsoEntry.isChecked(), '2: Batch Edit offers "Also update the timeline entry (date, time)", ticked: ' + await d.locator('label', { hasText: 'Also update' }).textContent());
  await d.getByRole('textbox', { name: 'Quantity' }).fill('4');
  await p.screenshot({ path: out + '/35-batch-edit.png' });
  await d.getByRole('button', { name: 'Save ingredient' }).click(); await d.waitFor({ state: 'detached' });
  ok(!(await titles().catch(() => [])).includes('Added Wildflower honey 4 lb'), '2: nothing changes until the batch is saved');
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForSelector('.hero');
  ok((await titles()).includes('Added Wildflower honey 4 lb'), '2: saving the batch updates the entry to 4 lb');
  ok((await listRow('Wildflower honey').textContent()).includes('4 lb') && await fact('Ingredient cost') === '$8.00', '2: the list says 4 lb, cost $8.00');

  // 2: unticked in Batch Edit, the entry stays
  await editIngredient();
  await alsoEntry.uncheck(); await d.getByRole('textbox', { name: 'Quantity' }).fill('5');
  await d.getByRole('button', { name: 'Save ingredient' }).click(); await d.waitFor({ state: 'detached' });
  await p.locator('.staged-row', { hasText: 'Wildflower honey' }).click(); await d.waitFor();
  ok(!(await alsoEntry.isChecked()), '2: reopened before saving, it stays unticked');
  await d.getByRole('button', { name: 'Close', exact: true }).click(); await d.waitFor({ state: 'detached' });
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForSelector('.hero');
  ok((await titles()).includes('Added Wildflower honey 4 lb') && (await listRow('Wildflower honey').textContent()).includes('5 lb'), '2: unticked, the entry keeps 4 lb and the list says 5 lb');

  // Removing the batch ingredient keeps the entry, unlinked
  await editIngredient();
  await d.getByRole('button', { name: 'Remove ingredient' }).click(); await d.waitFor({ state: 'detached' });
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForSelector('.hero');
  ok((await titles()).includes('Added Wildflower honey 4 lb') && await listRow('Wildflower honey').count() === 0, 'removing the ingredient keeps its timeline entry');
  await openEntry('Added Wildflower honey');
  ok(await d.getByRole('checkbox', { name: 'Also update batch ingredients' }).count() === 0, 'the entry no longer offers to update the list');
  const addTo = d.getByRole('checkbox', { name: /^Add to batch ingredients/ });
  ok(await addTo.count() === 1 && !(await addTo.isChecked()), 'it offers "Add to batch ingredients", unticked');
  await addTo.check(); await d.getByRole('button', { name: 'Save changes' }).click(); await d.waitFor({ state: 'detached' });
  ok((await listRow('Wildflower honey').textContent()).includes('4 lb') && await p.locator('.staged-row-done', { hasText: 'Wildflower honey' }).count() === 1, 'ticked, it goes back on the list, already added');
  ok(await fact('Ingredient cost') === '$8.00', 'and is priced again: $8.00');

  // A new entry picked from your ingredients
  await p.getByRole('button', { name: 'Add entry' }).click(); await d.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('ingredient'), exact: true }).click();
  await d.getByRole('combobox', { name: 'Ingredient' }).fill('71B');
  await d.getByRole('listbox').getByRole('button', { name: /^Lalvin 71B/ }).click();
  await d.getByRole('textbox', { name: 'Quantity' }).fill('1');
  ok(await d.getByRole('combobox', { name: 'Unit' }).inputValue() === 'packet', 'picking Lalvin 71B for a new entry fills in its unit, packet');
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  ok((await titles()).includes('Yeast pitched: Lalvin 71B 1 packet') && await p.locator('.staged-row-done', { hasText: 'Lalvin 71B' }).count() === 1, 'it goes on the timeline and the list');

  // An older entry with a typed amount still opens
  await p.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open('brewhive'); q.onsuccess = () => r(q.result); });
    const tx = db.transaction('events', 'readwrite'); const store = tx.objectStore('events');
    const all = await new Promise((r) => { const q = store.getAll(); q.onsuccess = () => r(q.result); });
    const e = all.find((x) => x.ingredient === 'Lalvin 71B');
    store.put({ ...e, id: 'old-entry', ingredient: 'Oak cubes', amount: '1 oz', quantity: undefined, unit: undefined, ingredientId: undefined, ingredientLineId: undefined });
    await new Promise((r) => (tx.oncomplete = r));
  });
  await p.reload(); await p.waitForSelector('.hero');
  await openEntry('Added Oak cubes');
  ok(await d.getByRole('textbox', { name: 'Quantity' }).inputValue() === '1' && await d.getByRole('combobox', { name: 'Unit' }).inputValue() === 'oz', 'an older "1 oz" entry opens as 1 and oz');
  await d.getByRole('button', { name: 'Close', exact: true }).click();
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scrolling');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
