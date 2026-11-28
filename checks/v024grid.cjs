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
  const out = process.argv[2];
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const d = p.getByRole('dialog').last();
  const grid = () => d.getByRole('radiogroup', { name: 'What happened?' });
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Grid mead');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');

  await p.getByRole('button', { name: 'Add entry' }).click(); await d.waitFor();
  ok(await until(async () => (await grid().getByRole('radio').count() === 12)), 'Add entry shows 12 icon buttons, no Est. ABV');
  await d.getByRole('button', { name: 'No reading? Enter an estimated ABV' }).click();
  ok(await until(async () => (await d.getByRole('textbox', { name: 'Estimated ABV (%)' }).count() === 1 && await grid().getByRole('radio', { name: 'Gravity reading' }).getAttribute('aria-checked') === 'true')), 'Gravity offers an estimated ABV, still under Gravity');
  await d.getByRole('textbox', { name: 'Estimated ABV (%)' }).fill('12');
  await p.screenshot({ path: out + '/v024-estimate.png' });
  await d.getByRole('button', { name: 'Enter a gravity reading instead' }).click();
  ok(await until(async () => (await d.getByRole('textbox', { name: 'Specific gravity' }).count() === 1)), 'and back to a gravity reading');
  ok(await until(async () => (await grid().getByRole('radio', { name: 'Gravity reading' }).getAttribute('aria-checked') === 'true')), 'Gravity reading is picked to start');
  await p.screenshot({ path: out + '/v024-grid.png' });
  await d.getByRole('button', { name: 'Close' }).first().click(); await d.waitFor({ state: 'detached' });

  const add = async (name, qty) => {
    await p.getByRole('button', { name: 'Add entry' }).click(); await d.waitFor();
    await grid().getByRole('radio', { name: 'Ingredient', exact: true }).click();
    ok(await until(async () => (await grid().getByRole('radio', { name: 'Ingredient', exact: true }).getAttribute('aria-checked') === 'true')), 'tapping Ingredient picks it');
    await d.getByRole('combobox', { name: 'Ingredient', exact: true }).fill(name);
    await d.getByRole('listbox').getByRole('button', { name: new RegExp('^' + name) }).first().click();
    await d.getByRole('textbox', { name: 'Quantity' }).fill(qty);
    await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  };
  await add('Gelatin finings', '2');
  await add('Fermaid O', '2');
  await add('Lalvin 71B', '1');
  await add('Wildflower honey', '3');
  // The last entry can take a moment to appear: wait for each title rather than reading once.
  const has = async (re) => until(async () => (await p.locator('.timeline-title').allTextContents()).some((t) => re.test(t)));
  ok(await has(/^Fining: Gelatin finings/), 'Fining: Gelatin finings');
  ok(await has(/^Nutrients: Fermaid O/), 'Nutrients: Fermaid O');
  ok(await has(/^Yeast pitched: Lalvin 71B/), 'Yeast pitched: Lalvin 71B');
  ok(await has(/^Added Wildflower honey/), 'other categories keep "Added": Added Wildflower honey');
  const fining = p.locator('.timeline-entry', { hasText: 'Fining: Gelatin finings' });
  ok(await until(async () => (await fining.locator('.timeline-icon svg').count() === 1)), 'the fining entry has an icon');
  await p.screenshot({ path: out + '/v024-timeline.png', fullPage: true });

  // An older Yeast pitched entry, as in a backup from before v0.2.4, keeps its type.
  const p2 = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p2.goto(BASE + '/'); await p2.waitForSelector('.empty');
  await p2.getByRole('button', { name: 'Load sample data' }).click(); await p2.waitForSelector('.shelf-item');
  await p2.getByText('Winter Spice').first().click(); await p2.waitForSelector('.hero');
  const batchId = p2.url().split('/').pop();
  await p2.evaluate(async (batchId) => {
    const db = await new Promise((r) => { const q = indexedDB.open('brewhive'); q.onsuccess = () => r(q.result); });
    const tx = db.transaction('events', 'readwrite');
    const t = new Date().toISOString();
    tx.objectStore('events').put({ id: 'old-pitch', batchId, type: 'pitch', date: '2026-01-02T18:00', value: null, note: 'D47', createdAt: t, updatedAt: t, deletedAt: null });
    await new Promise((r) => (tx.oncomplete = r));
  }, batchId);
  await p2.reload(); await p2.waitForSelector('.hero');
  await p2.locator('.timeline-entry', { hasText: /^Yeast pitched(?!:)/ }).first().click();
  const d2 = p2.getByRole('dialog').last(); await d2.waitFor();
  ok(await until(async () => (await d2.getByRole('radio', { name: 'Yeast pitched' }).getAttribute('aria-checked') === 'true')), 'an older Yeast pitched entry opens as Yeast pitched');
  // An estimate saves as before.
  await p.getByRole('button', { name: 'Add entry' }).click(); await d.waitFor();
  await d.getByRole('button', { name: 'No reading? Enter an estimated ABV' }).click();
  await d.getByRole('textbox', { name: 'Estimated ABV (%)' }).fill('11.5');
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  ok(await until(async () => ((await p.locator('.timeline-title').allTextContents()).some((t) => /Estimated ABV ≈ 11.5%/.test(t)))), 'it saves as an Estimated ABV entry');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
