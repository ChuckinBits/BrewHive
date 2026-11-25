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
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  // A device from before: the app has run once (old starters), I made Hibiscus, edited Bentonite, and Wine tannin is untouched in Additives
  await p.goto(BASE + '/#/ingredients'); await p.waitForTimeout(700);
  await p.goto(BASE + '/manifest.webmanifest');
  await p.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open('brewhive'); q.onsuccess = () => r(q.result); });
    const tx = db.transaction('ingredients', 'readwrite'); const store = tx.objectStore('ingredients');
    const all = await new Promise((r) => { const q = store.getAll(); q.onsuccess = () => r(q.result); });
    const oldIds = new Set(['wildflower-honey','clover-honey','orange-blossom-honey','buckwheat-honey','cane-sugar','apple-juice','cinnamon-sticks','vanilla-beans','lalvin-71b','lalvin-ec-1118','lalvin-d47','lalvin-k1-v1116','lalvin-qa23','fermaid-o','fermaid-k','go-ferm','dap','potassium-sorbate','potassium-metabisulfite','campden-tablets','nagardo','pectic-enzyme','acid-blend','wine-tannin','bentonite','sparkalloid','chitosan','oak-cubes'].map((s) => 'starter-' + s));
    store.clear();
    const t = '2026-11-01T00:00:00.000Z';
    for (const i of all.filter((i) => oldIds.has(i.id))) store.put({ ...i, category: i.id === 'starter-wine-tannin' ? 'additive' : i.category, notes: '', createdAt: t, updatedAt: i.id === 'starter-bentonite' ? '2026-11-05T00:00:00.000Z' : t });
    store.put({ id: 'mine-hibiscus', name: 'hibiscus', category: 'herb', defaultUnit: 'oz', notes: 'Mine', createdAt: t, updatedAt: t, deletedAt: null });
    await new Promise((r) => (tx.oncomplete = r));
  });
  await p.goto(BASE + '/#/ingredients'); await p.waitForTimeout(900);
  const names = await p.locator('.library-row .library-name').allTextContents();
  ok(names.length === 100, 'the new starters were added: 100 in all (' + names.length + ')');
  ok(names.filter((n) => n.toLowerCase() === 'hibiscus').length === 1, 'but not a second Hibiscus next to mine');
  ok(names.includes('Meadowfoam honey') && names.includes("Fleischmann's") && names.includes('Oak, French'), 'new ones like Meadowfoam honey, Fleischmann\'s and Oak, French are there');
  const tannins = p.locator('section', { has: p.locator('h3', { hasText: /^Tannins$/ }) });
  ok(await until(async () => (await tannins.getByText('Wine tannin', { exact: true }).count() === 1)), 'Wine tannin, never edited, moved to Tannins');
  ok(await until(async () => (await p.locator('section', { has: p.locator('h3', { hasText: /^Fining & clarifiers$/ }) }).getByText('Bentonite', { exact: true }).count() === 1)), 'an edited starter stays where it was');
  ok(await until(async () => (await p.locator('section', { has: p.locator('h3', { hasText: /^Spices$/ }) }).getByText('Coffee', { exact: true }).count() === 1)), 'Coffee and Cacao nibs are in Spices');
  const notes = await p.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open('brewhive'); q.onsuccess = () => r(q.result); });
    const all = await new Promise((r) => { const q = db.transaction('ingredients').objectStore('ingredients').getAll(); q.onsuccess = () => r(q.result); });
    const note = (id) => all.find((i) => i.id === id)?.notes;
    return { clover: note('starter-clover-honey'), bentonite: note('starter-bentonite'), mine: note('mine-hibiscus') };
  });
  ok(notes.clover.startsWith('Light and mild'), 'an unedited older starter gets its note: ' + notes.clover);
  ok(notes.bentonite === '' && notes.mine === 'Mine', 'an edited starter and my own keep their notes');
  await p.reload(); await p.waitForTimeout(700);
  ok(await until(async () => ((await p.locator('.library-row .library-name').allTextContents()).length === 100)), 'reopening adds nothing more');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
