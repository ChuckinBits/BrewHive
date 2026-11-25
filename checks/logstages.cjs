const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
const pad = (n) => String(n).padStart(2, '0');
const day = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const d = p.getByRole('dialog').last();
  const status = async () => (await p.getByRole('group', { name: 'Status' }).getByRole('button', { pressed: true }).textContent()).trim();
  const logBtn = (name) => p.getByRole('button', { name: `Log ${name} as added` });
  const move = (label) => p.getByRole('button', { name: `Move to ${label}` });
  const addLine = async (name, qty, stage) => {
    await p.getByRole('button', { name: 'Add ingredient' }).click(); await d.waitFor();
    await d.getByRole('combobox', { name: 'Ingredient', exact: true }).fill(name);
    await d.getByRole('textbox', { name: 'Quantity' }).fill(qty);
    await d.locator('select:has(option[value=bottling])').selectOption(stage);
    await d.getByRole('button', { name: 'Add ingredient' }).click(); await d.waitFor({ state: 'detached' });
  };
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Staged mead'); await p.getByLabel('Start date').fill(day(-20));
  await addLine('Clover honey', '3', 'primary');
  await addLine('Raspberries', '2', 'secondary');
  await addLine('Oak cubes', '1', 'aging');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');

  ok(await logBtn('Clover honey').count() === 1 && await logBtn('Raspberries').count() === 0 && await logBtn('Oak cubes').count() === 0, 'in Primary: only Primary ingredients can be logged');
  ok(await move('Secondary').count() === 1 && await move('Aging').count() === 0, 'Secondary ingredients offer Move to Secondary; Aging does not yet');
  ok(await p.getByRole('button', { name: 'Hide Add' }).count() === 1 && await p.getByText('Tap an ingredient when it goes in').count() === 1, 'with something to log: Hide Add and the hint show');
  await p.screenshot({ path: out + '/logstages-primary.png', fullPage: true });

  // Logging asks when, starting at the start date for a primary ingredient.
  await logBtn('Clover honey').click(); await d.waitFor();
  ok((await d.getByLabel('When').inputValue()).startsWith(day(-20)), 'Clover honey starts at the start date');
  await p.screenshot({ path: out + '/logstages-sheet.png' });
  await d.getByRole('button', { name: 'Close' }).first().click(); await d.waitFor({ state: 'detached' });
  ok(await logBtn('Clover honey').count() === 1, 'closing the sheet logs nothing');

  await move('Secondary').click(); await p.waitForTimeout(400);
  ok(await status() === 'Secondary', 'Move to Secondary moves the batch');
  ok((await p.locator('.timeline-title').allTextContents()).some((t) => /Moved to Secondary/.test(t)), 'and adds Moved to Secondary to the timeline');
  ok(await move('Secondary').count() === 0 && await move('Aging').count() === 1, 'the button moves on to Aging');
  ok(await logBtn('Raspberries').count() === 1 && await logBtn('Clover honey').count() === 1, 'Secondary and Primary ingredients can both be logged now');
  await logBtn('Raspberries').click(); await d.waitFor();
  ok((await d.getByLabel('When').inputValue()).startsWith(day(0)), 'a Secondary ingredient starts at now');
  await d.getByRole('button', { name: 'Add to timeline' }).click(); await d.waitFor({ state: 'detached' });
  ok(await p.locator('.staged-row-done', { hasText: 'Raspberries' }).count() === 1, 'Raspberries are logged');

  // Aging asks for the final reading, as the stage button does.
  await move('Aging').click(); await d.waitFor();
  ok(await d.getByRole('heading', { name: 'Move to Aging' }).count() === 1, 'Move to Aging asks for the final reading');
  await d.getByRole('textbox', { name: 'Final gravity (optional)' }).fill('1.000');
  await d.getByRole('button', { name: 'Move to Aging' }).click(); await d.waitFor({ state: 'detached' });
  ok(await status() === 'Aging' && await move('Aging').count() === 0, 'now in Aging, no more Move buttons (no Bottling ingredients)');
  // Clover honey, never logged, can still be logged from Aging.
  await logBtn('Clover honey').click(); await d.waitFor();
  await d.getByRole('button', { name: 'Add to timeline' }).click(); await d.waitFor({ state: 'detached' });
  ok(await p.locator('.staged-row-done', { hasText: 'Clover honey' }).count() === 1, 'an earlier stage ingredient is logged from Aging');
  await p.screenshot({ path: out + '/logstages-aging.png', fullPage: true });
  // Hide Add: the list stays, the + Add buttons go, on every batch, until Show Add.
  await p.getByRole('button', { name: 'Hide Add' }).click(); await p.waitForTimeout(300);
  ok(await p.locator('.staged-action-add').count() === 0 && await p.getByText('Oak cubes').count() >= 1, 'Hide Add hides every + Add, the list stays');
  ok(await p.locator('.staged-row-done', { hasText: 'Clover honey' }).count() === 1, 'logged ingredients keep their date');
  await p.screenshot({ path: out + '/logstages-hidden.png', fullPage: true });
  await p.reload(); await p.waitForSelector('.hero');
  ok(await p.locator('.staged-action-add').count() === 0 && await p.getByRole('button', { name: 'Show Add' }).count() === 1, 'and stays hidden after a reload');
  await p.getByRole('button', { name: 'Show Add' }).click(); await p.waitForTimeout(300);
  ok(await p.locator('.staged-action-add').count() >= 1, 'Show Add brings them back');
  // Once everything reached is logged, Hide Add and the hint go away.
  await logBtn('Oak cubes').click(); await d.waitFor();
  await d.getByRole('button', { name: 'Add to timeline' }).click(); await d.waitFor({ state: 'detached' });
  await p.waitForTimeout(300);
  ok(await p.getByRole('button', { name: /^(Hide|Show) Add$/ }).count() === 0 && await p.getByText('Tap an ingredient when it goes in').count() === 0, 'all logged: no Hide Add and no hint');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
