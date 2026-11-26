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
// Editing the Batch rating entry the batch's rating came from changes the batch rating; removing it doesn't.
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const hero = async () => (await p.locator('.hero .rating').getAttribute('aria-label').catch(() => null)) ?? 'unrated';
  const entryRatings = () => p.locator('.timeline-entry', { hasText: 'Batch rating' }).locator('.rating').evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
  const rate = async (v) => {
    await p.locator('.rating-card').getByRole('button', { name: /^(Rate|Change)$/ }).click();
    await p.getByRole('dialog').getByRole('slider', { name: 'Rating' }).fill(String(v));
    await p.getByRole('dialog').getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(400);
  };
  const openEntry = async (n = 0) => { await p.getByRole('button', { name: /^Edit Batch rating/ }).nth(n).click(); await p.getByRole('dialog').waitFor(); };
  await p.goto(BASE + '/#/batches/new');
  await p.getByLabel('Name').fill('Rating Entry Test'); await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');

  await rate(7);
  ok(await until(async () => (await hero() === 'Rated 7 out of 10' && JSON.stringify(await entryRatings()) === '["Rated 7 out of 10"]')), 'rated 7: the batch and its Batch rating entry say 7');
  await openEntry();
  ok(await until(async () => (await p.getByText('Changing it here changes the batch rating too. Removing this entry keeps the batch rating.').count() === 1)), 'the entry says editing it changes the batch rating, and removing it does not');
  await p.getByRole('dialog').getByRole('slider', { name: 'Rating' }).fill('8.5');
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await hero() === 'Rated 8.5 out of 10')), 'changing the entry to 8.5 changes the batch rating to 8.5');
  ok(await until(async () => (await p.getByText('Entry updated, and the batch rating too').count() === 1)), 'and says so');
  ok(await until(async () => ((await p.locator('.rating-card .rating').getAttribute('aria-label')) === 'Rated 8.5 out of 10')), 'the rating card shows 8.5 too');

  // An older entry the batch rating no longer comes from: editing it only changes the timeline.
  await p.evaluate(async () => {
    const db = await new Promise(r => { const q = indexedDB.open('brewhive'); q.onsuccess = () => r(q.result); });
    const batchId = location.hash.split('/')[2];
    const d = new Date(Date.now() - 2 * 86400000); const pad = n => String(n).padStart(2, '0'); const now = d.toISOString();
    const tx = db.transaction('events', 'readwrite');
    tx.objectStore('events').put({ id: 'older-review', batchId, type: 'review', date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`, value: null, note: '', rating: 6, auto: true, createdAt: now, updatedAt: now, deletedAt: null });
    await new Promise(r => (tx.oncomplete = r));
  });
  await p.reload(); await p.waitForSelector('.hero');
  await p.getByRole('button', { name: /^Edit Batch rating/ }).last().click(); await p.getByRole('dialog').waitFor();
  ok(await until(async () => (await p.getByText("The batch's rating has changed since, so changing this entry only changes the timeline.").count() === 1)), 'an older entry says it only changes the timeline');
  await p.getByRole('dialog').getByRole('slider', { name: 'Rating' }).fill('4');
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await hero() === 'Rated 8.5 out of 10')), 'editing the older entry to 4 leaves the batch at 8.5');

  // Removing the latest entry keeps the batch rating.
  await openEntry(0);
  await p.getByRole('dialog').getByRole('button', { name: /^Remove/ }).click(); await p.waitForTimeout(200);
  const confirm = p.getByRole('dialog').getByRole('button', { name: /^Remove/ });
  if (await confirm.count()) { await confirm.last().click(); }
  await p.waitForTimeout(400);
  ok(await until(async () => (JSON.stringify(await entryRatings()) === '["Rated 4 out of 10"]')), 'removing the latest Batch rating entry takes it off the timeline');
  ok(await until(async () => (await hero() === 'Rated 8.5 out of 10')), 'and the batch keeps its 8.5 rating');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
