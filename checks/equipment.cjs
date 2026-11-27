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
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
// v0.3 Equipment: vessels and gear, a batch's vessel, racking into another, headspace, and removing.
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('console', m => m.type() === 'error' && errors.push(m.text()));
  const out = process.argv[2] || '/tmp';
  const d = p.getByRole('dialog').last();
  const fact = async (name) => ((await p.locator('dt', { hasText: new RegExp('^' + name + '$') }).locator('xpath=following-sibling::dd[1]').textContent().catch(() => null)) ?? '').trim();
  const row = (name) => p.locator('.equipment-row', { has: p.locator('.library-name', { hasText: new RegExp('^' + name + '$') }) });
  const addVessel = async ({ type, capacity, name }) => {
    await p.getByRole('button', { name: 'Add vessel' }).first().click();
    if (type) await d.getByLabel('Type').selectOption({ label: type });
    if (capacity) await d.getByLabel('Capacity', { exact: true }).fill(capacity);
    if (name) await d.getByLabel('Name').fill(name);
    await d.getByRole('button', { name: 'Add vessel' }).click(); await d.waitFor({ state: 'detached' });
  };

  // 1. Equipment is under More, and starts empty
  await p.goto(BASE + '/#/more'); await p.getByRole('link', { name: /Equipment/ }).click(); await p.waitForSelector('.topbar');
  ok(await until(async () => (await p.getByText(/Carboys, buckets, jars, kegs and barrels/).count() === 1)), 'More → Equipment, empty, says what vessels are for');

  // 2. A vessel left unnamed is named from its capacity and type; gear has a price
  await addVessel({ type: 'Carboy', capacity: '5' });
  ok(await until(async () => (await row('5 gal carboy').count() === 1)), 'an unnamed 5 gal carboy is called "5 gal carboy"');
  await addVessel({ type: 'Jar', capacity: '1', name: 'Jar A' });
  await p.getByRole('button', { name: 'Add gear' }).click();
  await d.getByLabel('Name').fill('Hydrometer'); await d.getByLabel(/^Price/).fill('12.99'); await d.getByLabel('Notes').fill('Triple scale');
  await d.getByRole('button', { name: 'Add gear' }).click(); await d.waitFor({ state: 'detached' });
  ok(await until(async () => ((await row('Hydrometer').textContent()).includes('$12.99') && (await row('Hydrometer').textContent()).includes('Triple scale'))), 'gear shows its notes and price');
  ok(await until(async () => ((await p.locator('.card-head .muted').textContent()) === 'All free')), 'both vessels are free');

  // 3. A new batch picks a vessel; too small warns
  await p.goto(BASE + '/#/batches/new');
  await p.getByLabel('Name').fill('Vessel Test'); await p.getByLabel('Volume', { exact: true }).fill('5');
  await p.getByLabel('Vessel').selectOption({ label: 'Jar A · 1 gal · free' });
  ok(await until(async () => (await p.getByText("Jar A holds 1 gal, less than the 5 gal of this batch.").count() === 1)), 'picking a 1 gal jar for 5 gal warns');
  await p.getByLabel('Volume', { exact: true }).fill('1');
  ok(await until(async () => (await p.locator('.vessel-warning').count() === 0)), '1 gal fits: no warning');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  const batchUrl = p.url();
  ok(await until(async () => ((await fact('Vessel')) === 'Jar AFull')), 'the batch page shows the vessel and that it is full: ' + (await fact('Vessel')));

  // 4. The Equipment screen shows what's in each vessel
  await p.goto(BASE + '/#/equipment'); await p.waitForSelector('.equipment-row');
  ok(await until(async () => ((await row('Jar A').locator('.vessel-status').textContent()) === 'Vessel Test' && (await p.locator('.card-head .muted').textContent()) === '1 of 2 free')), 'Jar A holds Vessel Test; 1 of 2 free');

  // 5. Moving to Secondary offers racking; the carboy gets it, the jar is free again
  await p.goto(batchUrl); await p.waitForSelector('.hero');
  await p.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Secondary' }).click();
  ok(await until(async () => (await p.getByRole('dialog', { name: 'Racked into a new vessel?' }).count() === 1)), 'moving to Secondary asks which vessel it was racked into');
  // The vessel list loads a moment after the sheet opens.
  const opts = () => d.getByLabel('Racked into').locator('option').allTextContents();
  ok(await until(async () => { const o = await opts(); return o.length === 3 && o[2] === 'Jar A · 1 gal · in it now'; }), 'its own vessel says "in it now", listed last: ' + (await opts()).join(' | '));
  await d.getByRole('button', { name: 'Log racking' }).click();
  ok(await until(async () => (await d.getByRole('alert').getByText('Choose the vessel it went into').count() === 1)), 'Log racking without a vessel asks for one');
  await d.getByLabel('Racked into').selectOption({ label: '5 gal carboy · 5 gal · free' });
  await p.screenshot({ path: `${out}/equipment-rack.png` });
  await d.getByRole('button', { name: 'Log racking' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await p.locator('.timeline-title', { hasText: 'Racked into 5 gal carboy' }).count() === 1)), 'the timeline says "Racked into 5 gal carboy"');
  ok(await until(async () => ((await fact('Vessel')) === '5 gal carboy4 gal headspace (80%)')), 'headspace in the carboy: 4 gal (80%): ' + (await fact('Vessel')));

  // 6. Removing that racking puts it back in Jar A
  await p.getByRole('button', { name: /^Edit Racked into 5 gal carboy/ }).click();
  await d.getByRole('button', { name: 'Remove entry' }).click(); await d.getByRole('button', { name: 'Remove', exact: true }).click(); await p.waitForTimeout(400);
  ok(await until(async () => ((await fact('Vessel')) === 'Jar AFull')), 'removing the racking puts it back in Jar A');

  // 7. Racking from Add entry, into the carboy again
  await p.getByRole('button', { name: 'Add entry' }).click();
  await p.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('rack'), exact: true }).click();
  await d.getByLabel('Racked into').selectOption({ label: '5 gal carboy · 5 gal · free' });
  await d.getByRole('button', { name: 'Save entry' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => ((await fact('Vessel')).startsWith('5 gal carboy'))), 'a Racked entry from Add entry moves it to the carboy');

  // 7b. What it cost: no prices given yet, so nothing counted and it says so
  await p.goto(BASE + '/#/equipment'); await p.waitForSelector('.equipment-row');
  ok(await until(async () => ((await p.locator('.equipment-cost').textContent()) === 'Vessels$0.00Other gear$12.99Total$12.99' && await p.getByText("2 items have no price, so they aren't counted.").count() === 1)), 'What it cost: vessels $0, gear $12.99, total $12.99, and 2 without a price');

  // 8. Deleting the carboy: the batch shows no vessel, and the timeline still names it
  await p.goto(BASE + '/#/equipment'); await row('5 gal carboy').click();
  await d.getByRole('button', { name: 'Delete' }).click();
  ok(await until(async () => (await p.getByText("Vessel Test is in it. It keeps its history, but won't show a vessel.").count() === 1)), 'deleting a vessel in use says what happens to its batch');
  await p.getByRole('dialog').last().getByRole('button', { name: 'Delete' }).click(); await p.waitForTimeout(400);
  await p.goto(batchUrl); await p.waitForSelector('.hero');
  ok(await until(async () => (await p.locator('dt', { hasText: /^Vessel$/ }).count() === 0)), 'the batch no longer shows a vessel');
  ok(await until(async () => (await p.locator('.timeline-title', { hasText: 'Racked into 5 gal carboy' }).count() === 1)), 'but its Racked entry still says where it went');

  // 9. Several vessels: 2 gal in a 3 gal carboy, racked into two 1 gal jars
  await p.goto(BASE + '/#/equipment');
  await addVessel({ type: 'Carboy', capacity: '3', name: 'Big carboy' });
  await addVessel({ type: 'Jar', capacity: '1', name: 'Jar B' });
  await addVessel({ type: 'Jar', capacity: '1', name: 'Jar C' });
  await p.goto(BASE + '/#/batches/new');
  await p.getByLabel('Name').fill('Two Jars'); await p.getByLabel('Volume', { exact: true }).fill('2');
  await p.getByLabel('Vessel').selectOption({ label: 'Big carboy · 3 gal · free' });
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => ((await fact('Vessel')) === 'Big carboy1 gal headspace (33%)')), '2 gal in the 3 gal carboy: 1 gal headspace (33%)');
  await p.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Secondary' }).click();
  const rackSheet = p.getByRole('dialog', { name: 'Racked into a new vessel?' });
  await rackSheet.getByLabel('Racked into').selectOption({ label: 'Jar B · 1 gal · free' });
  await rackSheet.getByRole('button', { name: 'Add another vessel' }).click();
  await rackSheet.getByLabel('Racked into 2').selectOption({ label: 'Jar C · 1 gal · free' });
  ok(await until(async () => ((await rackSheet.getByLabel('Amount in Jar B').inputValue()) === '1' && (await rackSheet.getByLabel('Amount in Jar C').inputValue()) === '1')), 'two 1 gal jars fill in order: 1 + 1');
  ok(await until(async () => (await rackSheet.getByText('2 gal across 2 vessels: all of it.').count() === 1)), 'and it says all 2 gal went in');
  // Typed a key at a time, as on a phone: the decimal point has to survive "0.".
  await rackSheet.getByLabel('Amount in Jar C').fill(''); await rackSheet.getByLabel('Amount in Jar C').pressSequentially('0.8', { delay: 60 });
  ok(await until(async () => ((await rackSheet.getByLabel('Amount in Jar C').inputValue()) === '0.8')), 'typing 0.8 a key at a time keeps the decimal point');
  ok(await until(async () => (await rackSheet.getByText('1.8 gal across 2 vessels: 0.2 gal left behind. The batch becomes 1.8 gal.').count() === 1)), 'leaving 0.2 gal of lees behind: the batch becomes 1.8 gal');
  await p.screenshot({ path: `${out}/equipment-rack-two.png` });
  await rackSheet.getByRole('button', { name: 'Log racking' }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await p.locator('.timeline-title', { hasText: 'Racked into Jar B and Jar C' }).count() === 1)), 'the timeline says "Racked into Jar B and Jar C"');
  ok(await until(async () => ((await fact('Vessels')) === 'Jar B · 1 galFullJar C · 0.8 gal0.2 gal headspace (20%)')), 'Vessels: Jar B full, Jar C 0.8 gal with 0.2 gal headspace: ' + (await fact('Vessels')));
  ok(await until(async () => ((await fact('Volume')).startsWith('1.8 gal'))), 'the batch is now 1.8 gal');
  await p.goto(BASE + '/#/equipment'); await p.waitForSelector('.equipment-row');
  // Three 1 gal jars are one line, closed, with how many are free; it opens to show each.
  const jars = p.locator('.vessel-group-head', { hasText: '1 gal jar' });
  ok(await until(async () => ((await jars.textContent()) === '1 gal jar3 vessels1 of 3 free' && (await jars.getAttribute('aria-expanded')) === 'false')), 'the three 1 gal jars are one closed line: 1 of 3 free');
  await jars.click();
  ok(await until(async () => ((await row('Jar B').locator('.vessel-status').textContent()) === 'Two Jars' && (await row('Jar C').locator('.vessel-status').textContent()) === 'Two Jars' && (await row('Big carboy').locator('.vessel-status').textContent()) === 'Free')), 'both jars hold Two Jars, and the big carboy is free');
  await p.goBack(); await p.waitForSelector('.hero');
  await p.getByRole('button', { name: /^Edit Racked into Jar B and Jar C/ }).click();
  await d.getByRole('button', { name: 'Remove entry' }).click(); await d.getByRole('button', { name: 'Remove', exact: true }).click(); await p.waitForTimeout(400);
  ok(await until(async () => ((await fact('Vessel')) === 'Big carboy1 gal headspace (33%)' && (await fact('Volume')).startsWith('2 gal'))), 'removing it puts the 2 gal back in the big carboy');

  // 10. Several alike at once: eight 1 gal carboys, then two more, numbered on
  await p.goto(BASE + '/#/equipment'); await p.waitForSelector('.equipment-row');
  const addMany = async (n) => {
    await p.getByRole('button', { name: 'Add vessel' }).first().click();
    await d.getByLabel('Type').selectOption({ label: 'Carboy' }); await d.getByLabel('Capacity', { exact: true }).fill('1');
    await d.getByLabel('How many').fill(String(n)); await d.getByLabel(/^Price each/).fill('14.99');
  };
  await addMany(8);
  ok(await until(async () => (await d.getByText('Each is added on its own, numbered: 1 gal carboy 1, 1 gal carboy 2…').count() === 1)), 'How many 8 says how they will be numbered');
  await d.getByRole('button', { name: 'Add 8 vessels' }).click(); await d.waitFor({ state: 'detached' });
  ok(await until(async () => (await p.getByText('8 vessels added').count() === 1)), 'it says 8 vessels were added');
  const carboys = p.locator('.vessel-group-head', { hasText: '1 gal carboy' });
  ok(await until(async () => ((await carboys.textContent()) === '1 gal carboy8 vesselsAll free')), 'they are one line: 1 gal carboy, 8 vessels, all free');
  await addMany(2); await d.getByRole('button', { name: 'Add 2 vessels' }).click(); await d.waitFor({ state: 'detached' });
  await carboys.click();
  ok(await until(async () => (JSON.stringify(await p.locator('.vessel-group-list .library-name').allTextContents()).includes('"1 gal carboy 9","1 gal carboy 10"'))), 'two more carry on as 1 gal carboy 9 and 10');
  ok(await until(async () => ((await carboys.textContent()) === '1 gal carboy10 vesselsAll free')), 'and the line counts 10');
  await p.getByRole('button', { name: 'Add vessel' }).first().click();
  await d.getByLabel('How many').fill('51'); await d.getByRole('button', { name: 'Add 51 vessels' }).click();
  ok(await until(async () => (await d.getByRole('alert').getByText('How many should be a whole number from 1 to 50.').count() === 1)), 'more than 50 at once asks for fewer');
  await p.keyboard.press('Escape'); await d.waitFor({ state: 'detached' });

  // 10b. Gear you have several of is one line with a count; the price is each
  await p.getByRole('button', { name: 'Add gear' }).click();
  await d.getByLabel('Name').fill('Airlock'); await d.getByLabel('How many').fill('10'); await d.getByLabel(/^Price each/).fill('1.50');
  await d.getByRole('button', { name: 'Add gear' }).click(); await d.waitFor({ state: 'detached' });
  ok(await until(async () => ((await row('Airlock × 10').textContent()).endsWith('$15.00'))), 'ten airlocks are one line, "Airlock × 10", $15.00');
  await row('Airlock × 10').click();
  ok(await until(async () => ((await d.getByLabel('How many').inputValue()) === '10')), 'editing shows the count');
  await d.getByLabel('How many').fill('12'); await d.getByRole('button', { name: 'Save' }).click(); await d.waitFor({ state: 'detached' });
  ok(await until(async () => ((await row('Airlock × 12').textContent()).endsWith('$18.00'))), 'twelve now: $18.00');

  // 11. Sorting the vessel lines, remembered
  await p.goto(BASE + '/#/equipment'); await p.waitForSelector('.equipment-row');
  // The Vessels card's own lines: not the vessels inside an open group, nor the gear.
  const lines = async () => (await p.locator('section.card').filter({ has: p.getByRole('heading', { name: 'Vessels' }) }).locator('ul.library-list:not(.vessel-group-list) > li > .equipment-row .library-name').allTextContents()).join(' | ');
  const sortBy = p.getByRole('group', { name: 'Sort vessels' });
  ok(await until(async () => ((await sortBy.getByRole('button', { pressed: true }).textContent()) === 'Type')), 'sorted by Type to start');
  ok(await until(async () => (await lines()) === '1 gal carboy | Big carboy | 1 gal jar'), 'Type: carboys smallest first, then jars: ' + (await lines()));
  await sortBy.getByRole('button', { name: 'Size' }).click();
  ok(await until(async () => (await lines()) === '1 gal carboy | 1 gal jar | Big carboy'), 'Size: 1 gal carboys, 1 gal jars, then the 3 gal: ' + (await lines()));
  await sortBy.getByRole('button', { name: 'Name' }).click();
  ok(await until(async () => (await lines()) === '1 gal carboy | 1 gal jar | Big carboy'), 'Name: A to Z: ' + (await lines()));
  await sortBy.getByRole('button', { name: 'Free first' }).click();
  ok(await until(async () => (await lines()).startsWith('1 gal carboy')), 'Free first: the ten free carboys lead: ' + (await lines()));
  await p.reload(); await p.waitForSelector('.equipment-row');
  ok(await until(async () => ((await sortBy.getByRole('button', { pressed: true }).textContent()) === 'Free first')), 'the choice is remembered');

  // 12. A vessel saved as a jug (before v0.3.2) opens as a jar
  await p.evaluate(async () => {
    const db = await new Promise(r => { const q = indexedDB.open('brewhive'); q.onsuccess = () => r(q.result); });
    const now = new Date().toISOString();
    const tx = db.transaction('equipment', 'readwrite');
    tx.objectStore('equipment').put({ id: 'old-jug', name: 'Old growler', kind: 'vessel', vesselType: 'jug', capacityL: 1.89, capacityUnit: 'gal', price: null, notes: '', createdAt: now, updatedAt: now, deletedAt: null });
    await new Promise(r => (tx.oncomplete = r));
  });
  await p.reload(); await p.waitForSelector('.equipment-row');
  ok(await until(async () => ((await row('Old growler').textContent()).includes('Jar · 0.5 gal'))), 'an old Jug vessel shows as Jar');

  ok(errors.length === 0, 'no console errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
