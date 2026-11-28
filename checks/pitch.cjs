const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
// Waits for a condition that reads the page: the page can lag a moment behind a click or a save.
const until = async (read, ms = Number(process.env.CHECK_WAIT || 5000)) => {
  const end = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (value || Date.now() > end) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
};
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
const pad = (n) => String(n).padStart(2, '0');
const shown = (offset) => new Date(Date.now() + offset * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const day = (offset) => { const d = new Date(Date.now() + offset * 86400000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const d = p.getByRole('dialog').last();
  const status = async () => (await p.getByRole('group', { name: 'Status' }).getByRole('button', { pressed: true }).textContent()).trim();
  const asked = () => p.getByRole('dialog', { name: 'Yeast pitched' }).count();
  const fact = async (name) => { const dt = p.locator('dt', { hasText: new RegExp('^' + name + '$') }); return (await dt.count()) ? (await dt.locator('xpath=following-sibling::dd[1]').textContent()).trim() : ''; };
  const logIngredient = async (name, when) => {
    await p.getByRole('button', { name: 'Add entry' }).click(); await d.waitFor();
    await d.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: 'Ingredient', exact: true }).click();
    await d.getByRole('combobox', { name: 'Ingredient' }).fill(name.slice(0, 6));
    await d.getByRole('listbox').getByRole('button', { name: new RegExp('^' + name) }).first().click();
    await d.getByLabel('When').fill(when);
    await d.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(400);
  };

  // A Planned batch
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Someday mead'); await p.getByRole('textbox', { name: 'Volume' }).fill('1');
  await p.getByLabel('Status').selectOption('planned');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await status()) === 'Planned'), 'the batch is Planned');

  // 1. Yeast pitched tomorrow: still a plan, no question
  await logIngredient('Lalvin 71B', day(1) + 'T09:00');
  ok(await until(async () => (await p.locator('.timeline-entry', { hasText: 'Lalvin 71B' }).count()) === 1), 'a yeast dated tomorrow is logged');
  await p.waitForTimeout(500);
  ok((await asked()) === 0 && (await status()) === 'Planned', 'and nothing asks to move it: it is still planned');

  // 2. Moving that pitch to today asks; keeping it planned keeps it planned
  await p.locator('.timeline-entry', { hasText: 'Lalvin 71B' }).click(); await d.waitFor();
  await d.getByLabel('When').fill(day(0) + 'T08:00');
  await d.getByRole('button', { name: 'Save changes' }).click();
  ok(await until(async () => (await asked()) === 1), 'dating the pitch today asks to move it to Primary');
  await p.screenshot({ path: out + '/pitch-ask.png' });
  await p.getByRole('dialog', { name: 'Yeast pitched' }).getByRole('button', { name: 'Keep it planned' }).click(); await p.waitForTimeout(300);
  ok(await until(async () => (await asked()) === 0 && (await status()) === 'Planned'), '"Keep it planned" keeps it Planned');

  // 3. Something that isn't yeast doesn't ask
  await logIngredient('Lalvin EC-1118', day(1) + 'T09:00');
  await logIngredient('Go-Ferm', day(-1) + 'T09:00');
  await p.waitForTimeout(500);
  ok((await asked()) === 0, 'a nutrient pitched yesterday does not ask');

  // 4. Yeast pitched yesterday: move to Primary, dated then
  await p.locator('.timeline-entry', { hasText: 'Lalvin EC-1118' }).click(); await d.waitFor();
  await d.getByLabel('When').fill(day(-1) + 'T19:30');
  await d.getByRole('button', { name: 'Save changes' }).click();
  ok(await until(async () => (await asked()) === 1), 'a yeast pitched yesterday asks too');
  await p.getByRole('dialog', { name: 'Yeast pitched' }).getByRole('button', { name: 'Move to Primary' }).click();
  ok(await until(async () => (await status()) === 'Primary'), 'Move to Primary moves it');
  ok(await until(async () => (await fact('Started')) === shown(-1)), 'and it started when the yeast went in: ' + (await fact('Started')));
  const stageEntry = p.locator('.timeline-entry', { hasText: /Primary/ }).filter({ hasNotText: /Lalvin|Go-Ferm/ }).first();
  await stageEntry.click(); await d.waitFor();
  ok(await until(async () => (await d.getByLabel('When').inputValue()) === day(-1) + 'T19:30'), 'and the stage change is dated when the yeast went in: ' + (await d.getByLabel('When').inputValue()));
  await d.getByRole('button', { name: 'Close', exact: true }).click();

  // 5. Already in Primary: another pitch doesn't ask
  await logIngredient('Lalvin D47', day(0) + 'T10:00');
  await p.waitForTimeout(500);
  ok((await asked()) === 0, 'in Primary, pitching again does not ask');

  // 6. A planned batch logs its Primary ingredients from the list, then pitching moves it on
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Saturday mead'); await p.getByRole('textbox', { name: 'Volume' }).fill('1');
  await p.getByLabel('Status').selectOption('planned');
  await p.getByLabel('Planned start').fill(day(2));
  const addIngredient = async (name, stage) => {
    await p.getByRole('button', { name: 'Add ingredient' }).click();
    await p.getByRole('dialog').getByRole('combobox', { name: 'Ingredient', exact: true }).fill(name);
    await p.getByRole('dialog').getByLabel(/^Stage/).selectOption(stage);
    await p.getByRole('dialog').getByRole('button', { name: 'Add ingredient' }).click();
    await p.getByRole('dialog').waitFor({ state: 'detached' });
  };
  await addIngredient('Clover honey', 'primary'); await addIngredient('Lalvin 71B', 'primary'); await addIngredient('Raspberries', 'secondary');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  const primaryList = p.getByRole('region', { name: 'Primary ingredients' });
  ok(await until(async () => (await p.getByRole('button', { name: 'Log Clover honey as added' }).count()) === 1 && (await p.getByRole('button', { name: 'Log Lalvin 71B as added' }).count()) === 1), 'while Planned, Primary ingredients have Add');
  ok((await p.getByRole('button', { name: 'Log Raspberries as added' }).count()) === 0, 'Secondary ones do not');
  ok((await primaryList.getByRole('button', { name: 'Move to Primary' }).count()) === 1 && (await primaryList.locator('.stage-now').count()) === 0, 'Primary still offers Move to Primary, and is not marked Now');
  await p.screenshot({ path: out + '/pitch-planned-list.png', fullPage: true });
  await p.getByRole('button', { name: 'Log Clover honey as added' }).click(); await d.getByRole('button', { name: 'Add to timeline' }).click(); await p.waitForTimeout(500);
  ok(await until(async () => (await p.locator('.staged-row-done', { hasText: 'Clover honey' }).count()) === 1 && (await asked()) === 0 && (await status()) === 'Planned'), 'logging the honey ticks it off, still Planned');
  await p.getByRole('button', { name: 'Log Lalvin 71B as added' }).click(); await d.getByRole('button', { name: 'Add to timeline' }).click();
  ok(await until(async () => (await asked()) === 1), 'logging the yeast from the list asks to move to Primary');
  await p.getByRole('dialog', { name: 'Yeast pitched' }).getByRole('button', { name: 'Move to Primary' }).click();
  ok(await until(async () => (await status()) === 'Primary' && (await fact('Started')) === shown(0)), 'moved to Primary, started today rather than the planned date');

  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
