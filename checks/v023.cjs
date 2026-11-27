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
const keepStage = async (p) => { const k = p.getByRole('button', { name: /^Keep it in / }); await k.waitFor({ timeout: 5000 }); await k.click(); await p.waitForTimeout(200); };
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
const pad = (n) => String(n).padStart(2, '0');
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const d = p.getByRole('dialog').last();
  const details = p.locator('section.card', { has: p.getByRole('heading', { name: 'Details' }) });
  const fact = async (label) => { const dt = details.locator('dt', { hasText: new RegExp('^' + label + '$') }); return (await dt.count()) ? (await dt.locator('xpath=following-sibling::dd[1]').textContent()).trim() : null; };
  const pickIngredient = async (name) => {
    const box = d.getByRole('combobox', { name: 'Ingredient', exact: true });
    await box.fill(name);
    await d.getByRole('listbox', { name: 'Your ingredients' }).getByRole('button', { name: new RegExp('^' + name) }).first().click();
  };

  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Polish mead'); await p.getByLabel('Start date').fill(day(-10));
  await p.getByRole('textbox', { name: 'Original gravity' }).fill('1.100');

  // #52 + #55: 1 1/2 lb of honey, paid 30 for 12 lb; the library has no price, so the update box starts ticked.
  await p.getByRole('button', { name: 'Add ingredient' }).click(); await d.waitFor();
  await pickIngredient('Wildflower honey');
  await d.getByRole('textbox', { name: 'Quantity' }).fill('1 1/2');
  await d.getByRole('combobox', { name: 'Unit', exact: true }).first().selectOption('lb');
  ok(await until(async () => (await d.getByRole('group', { name: 'Price paid (optional)' }).count() === 1)), 'batch ingredient sheet asks the price paid');
  await d.getByRole('textbox', { name: /^Price/ }).fill('30');
  await d.getByRole('textbox', { name: 'Amount' }).fill('12');
  await d.getByRole('group', { name: 'Price paid (optional)' }).getByRole('combobox', { name: 'Unit' }).selectOption('lb');
  const hint = (await d.locator('.cost-fields .field-hint').textContent()).trim();
  ok(hint === '= $3.75 in this batch.', 'fraction quantity is priced: ' + hint);
  const upd = d.getByRole('checkbox', { name: 'Also update the price in your ingredients' });
  ok(await until(async () => (await upd.isChecked())), 'update-library box is ticked when the library has no price');
  await p.screenshot({ path: out + '/v023-price.png' });
  await d.getByRole('button', { name: 'Add ingredient' }).click(); await d.waitFor({ state: 'detached' });

  // A nutrient, no price.
  await p.getByRole('button', { name: 'Add ingredient' }).click(); await d.waitFor();
  await pickIngredient('Fermaid O');
  await d.getByRole('textbox', { name: 'Quantity' }).fill('2½');
  await d.getByRole('button', { name: 'Add ingredient' }).click(); await d.waitFor({ state: 'detached' });

  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await fact('Ingredient cost') === '$3.75')), 'batch cost $3.75: ' + await fact('Ingredient cost'));
  const batchUrl = p.url();

  // #56: honey logs at the start date, the nutrient now.
  await p.getByRole('button', { name: 'Log Wildflower honey as added' }).click();
  ok(await until(async () => ((await d.getByLabel('When').inputValue()).startsWith(day(-10)))), 'honey starts at the start date');
  await d.getByRole('button', { name: 'Add to timeline' }).click(); await d.waitFor({ state: 'detached' });
  await p.getByRole('button', { name: 'Log Fermaid O as added' }).click();
  ok(await until(async () => ((await d.getByLabel('When').inputValue()).startsWith(day(-10)))), 'so does the nutrient, a primary ingredient');
  await d.getByLabel('When').fill(day(0) + 'T08:00');
  await d.getByRole('button', { name: 'Add to timeline' }).click(); await d.waitFor({ state: 'detached' });
  await p.locator('.timeline-entry', { hasText: 'Fermaid O' }).waitFor();
  const honeyAdded = await p.getByLabel(/^Added /).first().getAttribute('aria-label');
  const startShort = new Date(day(-10) + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const todayShort = new Date(day(0) + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const added = await p.getByLabel(/^Added /).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  ok(added.includes('Added ' + startShort), 'honey added on the start date: ' + added.join(', '));
  ok(added.includes('Added ' + todayShort), 'nutrient added today: ' + added.join(', '));

  // Stage change starts on the next stage.
  await p.getByRole('button', { name: 'Add entry' }).click(); await d.waitFor();
  await d.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel({ label: 'Stage change' }), exact: true }).click(); await sugarAs(p, { label: 'Stage change' });
  ok(await until(async () => (await d.getByRole('combobox', { name: 'Move to' }).inputValue() === 'secondary')), 'Stage change shows Move to, starting on Secondary for a Primary batch');
  ok(await until(async () => (await d.getByText('The batch moves to this stage.').count() === 1)), 'and says the batch moves');
  await d.getByRole('button', { name: 'Close' }).first().click(); await d.waitFor({ state: 'detached' });

  // #54: Pasteurization with temperature and time.
  await p.getByRole('button', { name: 'Add entry' }).click(); await d.waitFor();
  await d.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel({ label: 'Stabilized' }), exact: true }).click(); await sugarAs(p, { label: 'Stabilized' });
  ok(await until(async () => (await d.getByRole('textbox', { name: 'Temperature (optional)' }).count() === 0)), 'no temperature for Chemical');
  await d.getByRole('combobox', { name: 'Method' }).selectOption('Pasteurization');
  await d.getByRole('textbox', { name: 'Temperature (optional)' }).fill('160');
  await d.getByRole('textbox', { name: 'Time (minutes)' }).fill('15');
  await p.screenshot({ path: out + '/v023-pasteur.png' });
  await d.getByRole('button', { name: 'Save entry' }).click(); await keepStage(p); await d.waitFor({ state: 'detached' });
  const entry = (await p.locator('.timeline-entry', { hasText: 'Stabilized' }).textContent());
  ok(/Pasteurization · 160 °F.* for 15 min/.test(entry), 'entry reads Pasteurization · 160 °F for 15 min: ' + entry);
  await p.locator('.timeline-entry', { hasText: 'Stabilized' }).click(); await d.waitFor();
  ok(await until(async () => (await d.getByRole('textbox', { name: 'Temperature (optional)' }).inputValue() === '160' && await d.getByRole('textbox', { name: 'Time (minutes)' }).inputValue() === '15')), 'editing keeps temperature and time');
  await d.getByRole('button', { name: 'Close' }).first().click(); await d.waitFor({ state: 'detached' });

  // #53: Edit ingredients opens Batch Edit at the Ingredients section.
  await p.getByRole('link', { name: 'Edit ingredients' }).click(); await p.waitForSelector('fieldset.ingredient-editor');
  ok(p.url().includes('section=ingredients'), 'link carries section=ingredients');
  await p.waitForTimeout(300);
  const [top, y, maxY] = await p.locator('fieldset.ingredient-editor').evaluate((el) => [el.getBoundingClientRect().top, scrollY, document.documentElement.scrollHeight - innerHeight]);
  ok(y > 0 && top >= 0 && (top < 60 || Math.abs(y - maxY) < 2), `scrolled to the ingredients (top ${top}, scrollY ${y} of ${maxY})`);
  await p.screenshot({ path: out + '/v023-edit.png' });

  // #55: editing the line starts from its saved price; the library now has a price, so the box is unticked when changed.
  await p.locator('fieldset.ingredient-editor').getByText('Wildflower honey').first().click(); await d.waitFor();
  ok(await until(async () => (await d.getByRole('textbox', { name: /^Price/ }).inputValue() === '30')), 'edit starts from the price paid');
  await d.getByRole('textbox', { name: /^Price/ }).fill('36');
  ok(await until(async () => (!(await d.getByRole('checkbox', { name: 'Also update the price in your ingredients' }).isChecked()))), 'update box is unticked when the library has a price');
  await d.getByRole('button', { name: 'Save ingredient' }).click(); await d.waitFor({ state: 'detached' });
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await fact('Ingredient cost') === '$4.50')), 'batch cost now $4.50: ' + await fact('Ingredient cost'));

  // Library kept $30 for 12 lb.
  await p.goto(BASE + '/#/ingredients'); await p.getByRole('searchbox').first().fill('Wildflower');
  const row = await p.locator('.library-row, li', { hasText: 'Wildflower honey' }).first().textContent();
  ok(/\$2\.50/.test(row), 'library price stays $2.50 / lb: ' + row);
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
