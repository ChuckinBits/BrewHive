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
(async () => {
  const out = process.argv[2] || '/tmp';
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const d = p.getByRole('dialog');
  const tap = (label) => d.locator('.icon-grid').getByRole('button', { name: label, exact: true }).click();
  const color = (label) => d.getByRole('radiogroup', { name: /^Color of/ }).getByRole('radio', { name: label }).click();
  const slotNames = async () => (await d.locator('.icon-slot-pick .picked-name').allTextContents()).join('|');
  const summary = () => p.locator('.icon-picker-text strong').textContent();
  const liquid = () => p.locator('.swatch-on').first().getAttribute('aria-label');

  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');

  // 1. Traditional's colors: a bochet darkens the mead and suggests the Bochet style
  await p.locator('.icon-picker-button').click();
  ok(await until(async () => (await d.getByRole('radiogroup', { name: 'Color of the main icon' }).getByRole('radio').count()) === 4), 'Traditional comes in 4 colors');
  await color('Bochet');
  ok(await until(async () => (await slotNames()) === 'Bochet · Main'), 'picking Bochet makes the main icon a bochet');
  await d.getByRole('button', { name: 'Done' }).click();
  ok(await until(async () => (await liquid()) === 'Color #6E3B1A'), 'and its dark liquid color: ' + (await liquid()));
  ok(await until(async () => (await p.getByRole('textbox', { name: 'Name' }).inputValue()) === 'Bochet Mead'), 'the name suggests a Bochet Mead');

  // 2. Three apples: red main, then green and yellow
  await p.locator('.icon-picker-button').click();
  await tap('Apple'); await color('Red');
  await d.getByRole('button', { name: '+ Add 2nd icon' }).click();
  ok(await until(async () => (await slotNames()) === 'Red apple · Main|Tap an icon'), 'Add 2nd icon adds an empty slot');
  await tap('Apple');
  await d.getByRole('button', { name: '+ Add 3rd icon' }).click(); await tap('Apple'); await color('Yellow');
  ok(await until(async () => (await slotNames()) === 'Red apple · Main|Green apple|Yellow apple'), 'three apples, each its own color: ' + (await slotNames()));
  ok((await d.locator('.icon-grid').getByRole('button', { name: 'Apple', exact: true }).locator('.icon-choice-number').textContent()) === '1·2·3', 'the apple tile shows all three numbers');
  await p.screenshot({ path: out + '/iconcolors-sheet.png' });

  // 3. Changing the main's color keeps the order; removing the main moves the 2nd up
  await d.locator('.icon-slot-pick').first().click(); await color('Pink');
  ok(await until(async () => (await slotNames()) === 'Pink apple · Main|Green apple|Yellow apple'), 'recoloring the main keeps it main');
  await d.getByRole('button', { name: 'Remove Pink apple' }).click();
  ok(await until(async () => (await slotNames()) === 'Green apple · Main|Yellow apple'), 'removing the main moves the 2nd up');

  // 4. An empty slot left behind is dropped
  await d.getByRole('button', { name: '+ Add 3rd icon' }).click();
  await d.locator('.icon-slot-pick').first().click();
  ok(await until(async () => (await slotNames()) === 'Green apple · Main|Yellow apple'), 'an empty slot is dropped when another is selected');
  await d.getByRole('button', { name: 'Done' }).click();
  ok(await until(async () => (await summary()) === 'Green apple, Yellow apple'), 'the field lists them: ' + (await summary()));
  ok(await until(async () => (await p.getByRole('textbox', { name: 'Name' }).inputValue()) === 'Apple Cyser'), 'the name follows the main flavor');

  // 5. A fruit color keeps the liquid color picked
  await p.getByRole('button', { name: 'Color #6E3B1A' }).click();
  await p.locator('.icon-picker-button').click(); await color('Red'); await d.getByRole('button', { name: 'Done' }).click();
  ok(await until(async () => (await liquid()) === 'Color #6E3B1A'), 'recoloring a fruit keeps the liquid color');

  // 6. Saved and drawn in color
  await p.getByRole('textbox', { name: 'Volume' }).fill('1');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  const fills = await p.locator('.hero svg.vessel').evaluate((svg) => svg.innerHTML);
  ok(fills.includes('#D8343B') && fills.includes('#F2D04B'), 'the batch art draws the red and yellow apples');
  await p.screenshot({ path: out + '/iconcolors-hero.png', clip: { x: 0, y: 0, width: 390, height: 330 } });

  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
