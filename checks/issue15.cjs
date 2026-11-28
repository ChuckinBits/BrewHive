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
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  const name = () => p.getByRole('textbox', { name: 'Name' }).inputValue();
  const style = () => p.locator('.select-button').textContent();
  const pickIcon = async (label) => {
    await p.locator('.icon-picker-button').click(); const d = p.getByRole('dialog');
    // Tapping an icon changes the main one.
    await d.locator('.icon-grid').getByRole('button', { name: label, exact: true }).click();
    await d.getByRole('button', { name: 'Done' }).click(); await p.waitForTimeout(150);
  };
  const type = (t) => p.getByRole('combobox', { name: 'Type' }).selectOption(t);
  await pickIcon('Maple');
  ok(await until(async () => (await name() === 'Maple Acerglyn' && (await style()).includes('Acerglyn'))), 'Maple gives "Maple Acerglyn", style Acerglyn');
  await pickIcon('Pumpkin');
  ok(await until(async () => (await name() === 'Pumpkin Metheglin' && (await style()).includes('Metheglin'))), 'the name and suggested style follow the icon');
  await p.locator('.select-button').click(); await p.getByRole('dialog').getByRole('button', { name: /^Melomel/ }).click();
  ok(await until(async () => (await name() === 'Pumpkin Melomel')), 'a chosen style is used in the suggested name');
  await pickIcon('Maple');
  ok(await until(async () => (await name() === 'Maple Melomel' && (await style()).includes('Melomel'))), 'the chosen style is kept for a new icon');
  await type('beer');
  ok(await until(async () => (await name() === 'Maple Beer' && (await style()).includes('Choose a style'))), 'switching to beer clears the mead style and renames');
  await p.locator('.select-button').click();
  ok(await until(async () => (await p.getByRole('dialog').getByRole('button', { name: /^Stout/ }).count() === 1 && await p.getByRole('dialog').getByRole('button', { name: /^Melomel/ }).count() === 0)), 'beer offers beer styles');
  await p.getByRole('dialog').getByRole('button', { name: /^Stout/ }).click();
  await type('cider');
  ok(await until(async () => (await p.locator('.select-button').count() === 0 && await name() === 'Maple Cider')), 'cider has no Style field');
  await type('other');
  ok(await until(async () => (await p.getByRole('textbox', { name: 'Style' }).count() === 1)), 'Other has a free-text style');
  await type('wine'); await pickIcon('Raspberry');
  ok(await until(async () => (await name() === 'Raspberry Wine')), 'Raspberry Wine');
  await p.getByRole('textbox', { name: 'Name' }).fill('My Wine');
  await pickIcon('Cherry');
  ok(await until(async () => (await name() === 'My Wine')), 'a typed name is never changed');
  await p.screenshot({ path: process.argv[2] + '/15-form.png' });
  // Name typed first, style empty: the icon still fills in the style
  await p.goto(BASE + '/#/'); await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Sugar Shack');
  await pickIcon('Maple');
  ok(await until(async () => (await name() === 'Sugar Shack' && (await style()).includes('Acerglyn'))), 'with a typed name, the icon still fills an empty style (Acerglyn), name kept');
  await pickIcon('Strawberry');
  ok(await until(async () => ((await style()).includes('Melomel') && await name() === 'Sugar Shack')), 'a suggested style follows the next main icon');
  await p.locator('.select-button').click(); await p.getByRole('dialog').getByRole('button', { name: /^Metheglin/ }).click();
  await pickIcon('Apple');
  ok(await until(async () => ((await style()).includes('Metheglin'))), 'a style the person chose is kept');
  await p.goto(BASE + '/#/recipes/new'); await p.waitForSelector('form');
    await pickIcon('Apple');
  ok(await until(async () => (await name() === 'Apple Cyser')), 'recipe form suggests too (Apple Cyser)');
  console.log(errors.length ? 'ERRORS ' + errors : 'no console errors'); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
