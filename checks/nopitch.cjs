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
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Ginger soda');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForURL(/#\/batches\/[^n]/); await p.waitForSelector('.hero');
  ok(await until(async () => (await p.getByText('Yeast pitched').count() === 0)), 'starting a batch adds no Yeast pitched entry');
  await p.getByRole('button', { name: 'Add entry' }).click();
  ok(await until(async () => (await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: 'Ingredient', exact: true }).count() === 1)), 'yeast can still be added by hand, as an Ingredient entry');
  console.log(errors.length ? 'ERRORS ' + errors : 'no console errors'); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
