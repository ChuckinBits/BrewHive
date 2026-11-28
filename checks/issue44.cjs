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
const pad = (n) => String(n).padStart(2, '0');
const day = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const d = p.getByRole('dialog').last();
  const stat = async (label) => (await p.locator('.stat', { has: p.locator('.stat-label', { hasText: new RegExp('^' + label + '$') }) }).locator('.stat-value').textContent()).trim();
  const ogRow = () => p.locator('.timeline-entry', { hasText: 'Original gravity' });
  const storedOg = () => p.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open('brewhive'); q.onsuccess = () => r(q.result); });
    return new Promise((r) => { const q = db.transaction('events').objectStore('events').getAll(); q.onsuccess = () => r(q.result.filter((e) => e.og && !e.deletedAt)); });
  });

  // New batch: Primary has no final reading; Secondary offers it
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Secondary start');
  await p.getByRole('textbox', { name: 'Original gravity' }).fill('1.100');
  ok(await until(async () => (await p.getByRole('heading', { name: 'Final reading' }).count() === 0)), 'a new Primary batch has no final reading');
  await p.getByLabel('Status').selectOption('secondary');
  ok(await until(async () => (await p.getByRole('heading', { name: 'Final reading' }).count() === 1)), 'a new Secondary batch offers the final reading');
  ok(await until(async () => ((await p.getByText('If fermentation has already finished').count()) === 1)), 'saying it\'s optional');
  const when = p.locator('.final-reading').getByLabel('When');
  ok(await until(async () => ((await when.inputValue()).startsWith(day(0)))), 'it has a When, starting now: ' + await when.inputValue());
  await p.getByRole('textbox', { name: 'Final gravity (optional)' }).fill('1.000');
  ok(await until(async () => (await p.getByRole('note').filter({ hasText: 'same day' }).count() === 1)), 'OG and a different FG on the same day: a note about the start date');
  await p.screenshot({ path: out + '/44-sameday.png', fullPage: true });
  await p.getByLabel('Start date').fill(day(-30));
  ok(await until(async () => (await p.getByRole('note').filter({ hasText: 'same day' }).count() === 0)), 'setting the start date 30 days back clears it');
  await when.fill(`${day(-31)}T10:00`);
  await p.getByRole('button', { name: 'Start batch' }).click();
  ok(await until(async () => ((await p.getByRole('alert').textContent()) === "The final reading can't be from before the batch started.")), 'a final reading before the start date is refused');
  await when.fill(`${day(-2)}T10:00`);
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await ogRow().count() === 1 && (await ogRow().textContent()).includes('1.100') && (await ogRow().textContent()).includes('OG'))), 'the timeline has "Original gravity 1.100" marked OG');
  let og = (await storedOg())[0];
  ok(og.date === `${day(-30)}T00:00`, 'dated the start date: ' + og.date);
  const fin = p.locator('.timeline-entry', { hasText: 'Final' }).filter({ hasNotText: 'Original' });
  ok(await until(async () => ((await fin.textContent()).includes('1.000'))), 'and the final reading 1.000');
  ok(await until(async () => (await stat('OG') === '1.100' && await stat('ABV') === '13.1%')), 'OG 1.100 and ABV 13.1% (labelled ABV: the final reading settled it)');
  await p.screenshot({ path: out + '/44-timeline.png', fullPage: true });

  // Editing the OG entry: value changes the batch's OG; date moves only the reading
  await ogRow().click(); await d.waitFor();
  ok(await until(async () => (await d.getByRole('heading', { name: 'Original gravity' }).count() === 1 && await d.getByLabel('What happened?').count() === 0 && await d.getByText('Final gravity reading').count() === 0)), 'its sheet is just the OG: no type, no Final box');
  await d.getByRole('textbox', { name: 'Original gravity' }).fill('1.105');
  await d.getByLabel('When', { exact: true }).fill(`${day(-29)}T08:00`);
  await d.getByRole('button', { name: 'Save changes' }).click(); await d.waitFor({ state: 'detached' });
  ok(await until(async () => (await stat('OG') === '1.105' && await stat('ABV') === '13.8%')), 'editing it to 1.105 changes the batch OG (ABV 13.8%)');
  og = (await storedOg())[0];
  ok(og.date === `${day(-29)}T08:00`, 'its date moved to when it was taken');
  await p.getByRole('link', { name: 'Edit batch' }).click(); await p.waitForSelector('form');
  ok(await until(async () => (await p.getByLabel('Start date').inputValue() === day(-30) && await p.getByRole('textbox', { name: 'Original gravity' }).inputValue() === '1.105')), 'the start date stayed; Batch Edit shows OG 1.105');

  // Batch Edit: OG follows; a moved entry stays when the start date changes
  await p.getByRole('textbox', { name: 'Original gravity' }).fill('1.110');
  await p.getByLabel('Start date').fill(day(-40));
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForSelector('.hero');
  og = (await storedOg())[0];
  ok(og.value === 1.11 && og.date === `${day(-29)}T08:00`, 'Batch Edit OG 1.110 updates the entry; its moved date stays');

  // A batch whose OG entry is on the start date: it follows the start date
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Follows start');
  await p.getByRole('textbox', { name: 'Original gravity' }).fill('1.090');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  await p.getByRole('link', { name: 'Edit batch' }).click(); await p.waitForSelector('form');
  await p.getByLabel('Start date').fill(day(-5));
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => ((await storedOg()).some((e) => e.value === 1.09 && e.date === `${day(-5)}T00:00`))), 'an OG entry on the start date moves with it');
  // Clearing the OG in Batch Edit removes the entry
  await p.getByRole('link', { name: 'Edit batch' }).click(); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Original gravity' }).fill('');
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await ogRow().count() === 0)), 'clearing the OG removes its entry');
  await p.getByRole('link', { name: 'Edit batch' }).click(); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Original gravity' }).fill('1.092');
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForSelector('.hero');
  // Removing the entry clears the OG
  await ogRow().click(); await d.waitFor();
  await d.getByRole('button', { name: 'Remove entry' }).click();
  ok(await until(async () => (await d.getByText("Remove the OG? This also clears the batch's original gravity.").count() === 1)), 'removing it warns that the OG is cleared');
  await d.getByRole('button', { name: 'Remove', exact: true }).click(); await d.waitFor({ state: 'detached' });
  await p.waitForTimeout(300);
  ok(await until(async () => (await stat('OG') === '–' && await ogRow().count() === 0)), 'and the OG is gone');

  // Older data: batches with an OG but no entry get one at start
  await p.goto(BASE + '/#/more'); await p.getByRole('button', { name: 'Add sample data' }).click(); await p.waitForTimeout(900);
  const sampleOgs = (await storedOg()).length;
  const withOg = await p.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open('brewhive'); q.onsuccess = () => r(q.result); });
    return new Promise((r) => { const q = db.transaction('batches').objectStore('batches').getAll(); q.onsuccess = () => r(q.result.filter((b) => b.og != null && !b.deletedAt && !b.parentId).length); });
  });
  // Sub-batches share the OG entry of the batch they were split from.
  ok(sampleOgs === withOg, 'every batch with an OG has an OG entry (' + sampleOgs + ' of ' + withOg + ')');
  await p.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open('brewhive'); q.onsuccess = () => r(q.result); });
    const tx = db.transaction('events', 'readwrite'); const store = tx.objectStore('events');
    const all = await new Promise((r) => { const q = store.getAll(); q.onsuccess = () => r(q.result); });
    for (const e of all.filter((e) => e.og)) store.delete(e.id);
    await new Promise((r) => (tx.oncomplete = r));
  });
  ok(await until(async () => ((await storedOg()).length === 0)), 'set up: an older device with no OG entries');
  await p.reload(); await p.waitForTimeout(900);
  ok(await until(async () => ((await storedOg()).length === sampleOgs)), 'reopening the app adds them back on each batch\'s start date');
  await p.goto(BASE + '/#/batches'); await p.getByRole('link', { name: /Winter Spice/ }).first().click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await ogRow().count() === 1)), 'a sample batch shows its OG on the timeline');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
