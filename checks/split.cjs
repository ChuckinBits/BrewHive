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
const ENTRY_LABELS = { gravity: 'Gravity reading', ingredient: 'Ingredient', tasting: 'Tasting', note: 'Note', status: 'Stage change', rack: 'Racked', feeding: 'Sugar added', backsweeten: 'Sugar added', stabilize: 'Stabilized', temperature: 'Temperature', ph: 'pH', moved: 'Relocate', estimate: 'Estimated ABV', fining: 'Fining', nutrient: 'Nutrients', pitch: 'Yeast pitched' };
// Step feeding and backsweetening are one Sugar added button; its "This will ferment" box picks which.
const sugarAs = async (p, type) => { if (type !== 'feeding' && type !== 'backsweeten') return; const box = p.getByLabel(/^This will ferment/); if (type === 'feeding') await box.check(); else await box.uncheck(); };
const entryLabel = (arg) => (typeof arg === 'string' ? (ENTRY_LABELS[arg] ?? arg) : arg.label);
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
// v0.3 Splitting: rack into two vessels, split into sub-batches that share the history, undo.
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const out = process.argv[2] || '/tmp';
  const fact = async (name) => ((await p.locator('dt', { hasText: new RegExp('^' + name + '$') }).locator('xpath=following-sibling::dd[1]').textContent().catch(() => null)) ?? '').trim();
  const money = (t) => Number((t.match(/\$([\d.]+)/) || [])[1]);
  await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Load sample data' }).click(); await p.waitForSelector('.shelf-item');
  await p.getByRole('link', { name: /Bramble Melomel #2/ }).click(); await p.waitForSelector('.hero');
  const parentUrl = p.url();
  const parentCost = money(await fact('Ingredient cost'));

  // 1. Rack into Jars C and D, half a gallon each
  await p.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Secondary' }).click();
  const rack = p.getByRole('dialog', { name: 'Racked into a new vessel?' });
  await rack.getByLabel('Racked into').selectOption({ label: 'Jar C · 1 gal · free' });
  await rack.getByRole('button', { name: 'Add another vessel' }).click();
  await rack.getByLabel('Racked into 2').selectOption({ label: 'Jar D · 1 gal · free' });
  await rack.getByLabel('Amount in Jar C').fill('0.5'); await rack.getByLabel('Amount in Jar D').fill('0.5');
  await rack.getByRole('button', { name: 'Log racking' }).click();
  const split = p.getByRole('dialog', { name: 'Make sub-batches?' });
  ok(await until(async () => (await split.count() === 1)), 'racking into two vessels offers sub-batches');
  ok(await until(async () => ((await split.getByLabel('Jar C · 0.5 gal').inputValue()) === 'Bramble Melomel #2 A' && (await split.getByLabel('Jar D · 0.5 gal').inputValue()) === 'Bramble Melomel #2 B')), 'named A and B, one per vessel');
  await p.screenshot({ path: `${out}/split-1-offer.png` });

  // 2. Split: the first sub-batch opens, with the history up to the split
  await split.getByRole('button', { name: 'Split into 2 batches' }).click();
  await p.waitForURL((u) => u.toString() !== parentUrl); await p.waitForSelector('.hero');
  const aUrl = p.url();
  ok(await until(async () => ((await p.locator('.topbar').textContent()).includes('Bramble Melomel #2 A'))), 'it opens Bramble Melomel #2 A');
  ok(await until(async () => ((await p.locator('.split-from').textContent()).startsWith('Split from Bramble Melomel #2 on'))), 'which says where it came from');
  ok(await until(async () => (await p.locator('.timeline-title', { hasText: 'Racked into Jar C and Jar D' }).count() === 1 && await p.locator('.timeline-title', { hasText: 'Original gravity' }).count() === 1)), 'its timeline has the racking and the OG from before the split');
  ok(await until(async () => ((await p.locator('.stat-value').first().textContent()) === '1.114')), 'and its OG is 1.114, from that history');
  ok(await until(async () => ((await fact('Volume')).startsWith('0.5 gal') && (await fact('Vessel')) === 'Jar C0.5 gal headspace (50%)')), 'it is 0.5 gal in Jar C, with 0.5 gal headspace');
  const aCost = money(await fact('Ingredient cost'));
  ok(Math.abs(aCost - parentCost / 2) < 0.02, `its ingredient cost is half: $${aCost} of $${parentCost}`);
  ok(await until(async () => ((await p.locator('.step-on').textContent()) === 'Secondary')), 'it is in Secondary, where the batch was');
  await p.screenshot({ path: `${out}/split-2-child.png`, fullPage: true });

  // 3. An entry from before the split opens the batch it came from, which is Split
  await p.getByRole('button', { name: /^Racked into Jar C and Jar D, .*, from Bramble Melomel #2$/ }).click();
  await p.waitForURL(parentUrl); await p.waitForSelector('.hero');
  ok(await until(async () => ((await p.locator('.split-note').textContent()).includes('Into Bramble Melomel #2 A and Bramble Melomel #2 B'))), 'the batch says it was split into A and B');
  ok(await until(async () => (await p.getByRole('group', { name: 'Status' }).count() === 0 && await p.getByRole('button', { name: 'Add entry' }).count() === 0)), 'with no stage buttons and no Add entry');
  ok(await until(async () => (await p.getByRole('button', { name: 'Undo split' }).count() === 1)), 'and Undo split, since nothing has been logged on them');
  await p.screenshot({ path: `${out}/split-3-parent.png` });

  // 4. Batches: the sub-batches are active, the split batch only under All
  await p.goto(BASE + '/#/');
  const shelf = async () => (await p.locator('.shelf-item').allTextContents()).join(' | ');
  ok(await until(async () => { const s = await shelf(); return s.includes('Bramble Melomel #2 A') && s.includes('Bramble Melomel #2 B') && !/Bramble Melomel #2(?! [AB])/.test(s); }), 'Active lists A and B, not the split batch: ' + (await shelf()));
  await p.getByRole('button', { name: /^All/ }).click();
  ok(await until(async () => /Bramble Melomel #2(?! [AB])/.test(await shelf())), 'All lists the split batch too');

  // 5. Undo split: A and B go, and the batch carries on in both vessels
  await p.goto(parentUrl); await p.waitForSelector('.hero');
  await p.getByRole('button', { name: 'Undo split' }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Undo split' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => ((await p.locator('.step-on').textContent()) === 'Secondary' && (await fact('Vessels')).startsWith('Jar C · 0.5 gal'))), 'undone: back in Secondary, in Jar C and Jar D');

  // 6. Split again from a Racked entry; once A has an entry, the split stays
  await p.getByRole('button', { name: 'Add entry' }).click();
  await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: 'Racked', exact: true }).click();
  const d = p.getByRole('dialog').last();
  await d.getByLabel('Racked into').selectOption({ label: 'Jar C · 1 gal · in it now' });
  await d.getByRole('button', { name: 'Add another vessel' }).click();
  await d.getByLabel('Racked into 2').selectOption({ label: 'Jar D · 1 gal · in it now' });
  ok(await until(async () => (await d.getByText('Nothing goes in Jar D: change the amounts, or remove it.').count() === 1)), 'filled in order, 1 gal fits in Jar C and nothing is left for Jar D: it says so');
  await d.getByLabel('Amount in Jar C').fill('0.5'); await d.getByLabel('Amount in Jar D').fill('0.5');
  await d.getByRole('button', { name: 'Save entry' }).click();
  await split.getByRole('button', { name: 'Split into 2 batches' }).click(); await p.waitForURL((u) => u.toString() !== parentUrl); await p.waitForSelector('.hero');
  await p.getByRole('button', { name: 'Add entry' }).click();
  await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: 'Note', exact: true }).click();
  await p.getByRole('dialog').last().getByRole('textbox', { name: 'Note (optional)' }).fill('Tastes great'); await p.getByRole('dialog').last().getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(300);
  await p.goto(parentUrl); await p.waitForSelector('.hero');
  ok(await until(async () => (await p.locator('.split-note').count() === 1 && await p.getByRole('button', { name: 'Undo split' }).count() === 0)), 'once a sub-batch has its own entry, Undo split is gone');

  ok(errors.length === 0, 'no console errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
