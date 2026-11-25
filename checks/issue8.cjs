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
const ENTRY_LABELS = { gravity: 'Gravity reading', ingredient: 'Ingredient', tasting: 'Tasting', note: 'Note', status: 'Stage change', rack: 'Racked', feeding: 'Step feeding', backsweeten: 'Backsweetened', stabilize: 'Stabilized', temperature: 'Temperature', ph: 'pH', moved: 'Relocate', estimate: 'Estimated ABV', fining: 'Fining', nutrient: 'Nutrients', pitch: 'Yeast pitched' };
const entryLabel = (arg) => (typeof arg === 'string' ? (ENTRY_LABELS[arg] ?? arg) : arg.label);
const out = process.argv[2];
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const titles = () => p.locator('.timeline-entry .timeline-title > span').allTextContents();
  const reviews = async () => (await titles()).filter(t => t === 'Batch rating').length;
  const heroRating = async () => (await p.locator('.hero .rating').getAttribute('aria-label')) ?? 'unrated';
  const slider = () => p.locator('section.card .rating-input input[type=range]');
  await p.goto(BASE + '/#/batches/new');
  await p.getByLabel('Name').fill('Issue 8 Test'); await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');

  // 4: rating from the slider logs one entry per day
  await slider().fill('7'); await p.waitForTimeout(400);
  ok(await until(async () => (await reviews() === 1 && await heroRating() === 'Rated 7 out of 10')), '4: setting the batch rating adds a "Batch rating" entry');
  await slider().fill('8'); await p.waitForTimeout(200); await slider().fill('8.5'); await p.waitForTimeout(400);
  ok(await until(async () => (await reviews() === 1 && await p.locator('.timeline-entry .rating[aria-label="Rated 8.5 out of 10"]').count() === 1)), '4: changing it again the same day updates that one entry (8.5)');

  // 1 + 2: tasting with checkbox (default on) and a taster
  await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('tasting'), exact: true }).click();
  const box = p.getByLabel('Set as the batch rating');
  ok(await until(async () => (await box.isDisabled())), '1: the checkbox waits until a rating is picked');
  await p.getByRole('dialog').getByRole('slider', { name: 'Rating' }).fill('9');
  ok(await until(async () => (await box.isChecked())), '1: "Set as the batch rating" is checked by default');
  ok(await until(async () => (await p.getByText('Replaces the current batch rating of 8.5.').count() === 1)), '1: it says which rating it replaces');
  await p.getByLabel(/^Taster/).fill('Sam');
  await p.screenshot({ path: `${out}/1-tasting-sheet.png` });
  await p.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await heroRating() === 'Rated 9 out of 10')), '1: the batch rating is now 9');
  ok(await until(async () => ((await titles()).includes('Tasting by Sam'))), '2: the timeline shows "Tasting by Sam"');
  ok(await until(async () => (await reviews() === 1 && await p.locator('.timeline-entry .rating[aria-label="Rated 8.5 out of 10"]').count() === 1)), '4: the tasting did not overwrite today\'s Batch rating entry (still 8.5)');

  // 1: unticked tasting leaves the batch rating alone
  await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('tasting'), exact: true }).click();
  await p.getByRole('dialog').getByRole('slider', { name: 'Rating' }).fill('5');
  await p.getByLabel('Set as the batch rating').uncheck();
  await p.getByLabel(/^Taster/).fill('Ana');
  await p.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await heroRating() === 'Rated 9 out of 10')), '1: an unticked tasting of 5 leaves the batch at 9');

  // 2: known tasters are suggested
  await p.getByRole('button', { name: 'Add entry' }).click(); await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('tasting'), exact: true }).click();
  await p.waitForFunction(() => document.querySelectorAll('#known-tasters option').length >= 2, null, { timeout: 5000 }).catch(() => {});
  const suggestions = await p.locator('#known-tasters option').evaluateAll(os => os.map(o => o.value));
  ok(JSON.stringify(suggestions) === JSON.stringify(['Ana', 'Sam']), '2: earlier tasters are suggested: ' + suggestions.join(', '));
  await p.keyboard.press('Escape');

  // 4: the slider after a tasting updates today's entry, tastings untouched
  await slider().fill('6'); await p.waitForTimeout(400);
  ok(await until(async () => (await reviews() === 1 && (await titles()).filter(t => t.startsWith('Tasting')).length === 2)), '4: rating again updates the Batch rating entry; both tastings stay');

  // 4: Clear removes today's entry only
  await p.evaluate(async () => {
    // Add an older Batch rating entry from yesterday to prove Clear keeps it.
    const db = await new Promise(r => { const q = indexedDB.open('brewhive'); q.onsuccess = () => r(q.result); });
    const batchId = location.hash.split('/')[2];
    const d = new Date(Date.now() - 86400000); const pad = n => String(n).padStart(2, '0');
    const now = new Date(Date.now() - 86400000).toISOString();
    const tx = db.transaction('events', 'readwrite');
    tx.objectStore('events').put({ id: 'yesterday-review', batchId, type: 'review', date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`, value: null, note: '', rating: 7, auto: true, createdAt: now, updatedAt: now, deletedAt: null });
    await new Promise(r => (tx.oncomplete = r));
  });
  await p.reload(); await p.waitForSelector('.hero');
  ok(await until(async () => (await reviews() === 2)), '4: yesterday\'s Batch rating entry is there too');
  await p.locator('section.card .rating-input').getByRole('button', { name: 'Clear' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await reviews() === 1 && await p.locator('.timeline-entry .rating[aria-label="Rated 7 out of 10"]').count() === 1)), '4: Clear removes today\'s entry and keeps yesterday\'s');
  ok(await until(async () => (await p.locator('.hero .rating-none').count() === 1)), '4: and the batch is unrated');

  // 3: date lines up with other entries
  const rights = await p.locator('.timeline-entry time').evaluateAll(ts => ts.map(t => Math.round(t.getBoundingClientRect().right)));
  ok(new Set(rights).size === 1, '3: every entry\'s date ends at the same spot: ' + [...new Set(rights)].join(','));
  await p.screenshot({ path: `${out}/2-timeline.png`, fullPage: true });
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
