const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const d = p.getByRole('dialog').last();
  const stage = (name) => p.getByRole('group', { name: 'Status' }).getByRole('button', { name, exact: true });
  const status = async () => (await p.getByRole('group', { name: 'Status' }).getByRole('button', { pressed: true }).textContent()).trim();
  const bottledRows = () => p.locator('.timeline-entry', { hasText: /^Bottled/ });
  const cellarCount = () => p.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open('brewhive'); q.onsuccess = () => r(q.result); });
    return new Promise((r) => { const q = db.transaction('cellar').objectStore('cellar').getAll(); q.onsuccess = () => r(q.result.filter((c) => !c.deletedAt).length); });
  });
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Keg mead'); await p.getByRole('textbox', { name: 'Volume' }).fill('1');
  await p.getByRole('textbox', { name: 'Original gravity' }).fill('1.100');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  const url = p.url();

  // Closing the sheet leaves the stage alone
  await stage('Bottled').click(); await d.waitFor();
  ok(await d.getByRole('heading', { name: 'Bottle this batch' }).count() === 1, 'tapping Bottled opens Bottle this batch');
  await d.getByRole('button', { name: 'Close', exact: true }).click(); await d.waitFor({ state: 'detached' });
  ok(await status() === 'Primary', 'closing it leaves the batch in Primary');

  // Mark as bottled without the cellar
  await stage('Bottled').click(); await d.waitFor();
  await d.getByRole('textbox', { name: 'Final gravity (optional)' }).fill('1.010');
  await p.screenshot({ path: out + '/bottled-sheet.png' });
  await d.getByRole('button', { name: 'Mark as bottled without adding to the cellar' }).click(); await d.waitFor({ state: 'detached' });
  ok(await status() === 'Bottled', 'Mark as bottled without adding to the cellar sets Bottled');
  ok(await cellarCount() === 0, 'with nothing added to the cellar');
  ok(await bottledRows().count() === 1 && (await p.locator('.timeline-entry', { hasText: 'Final' }).count()) === 1, 'a Bottled entry and the final reading are on the timeline');

  // Tapping Bottled again opens it to add bottles
  await stage('Bottled').click(); await d.waitFor();
  ok(await d.getByRole('heading', { name: 'Add bottles' }).count() === 1 && await d.getByRole('button', { name: /^Mark as bottled/ }).count() === 0 && await d.getByText('Final reading').count() === 0, 'tapping Bottled while Bottled opens Add bottles (no final reading, no mark button)');
  await d.getByRole('button', { name: 'Close', exact: true }).click(); await d.waitFor({ state: 'detached' });

  // The Bottled timeline entry opens it too, and the bottles land on that entry
  await bottledRows().first().click(); await d.waitFor();
  ok(await d.getByRole('heading', { name: 'Add bottles' }).count() === 1 && await d.getByRole('button', { name: 'Edit timeline entry' }).count() === 1, 'the Bottled entry opens Add bottles, with Edit timeline entry');
  await p.screenshot({ path: out + '/bottled-entry.png' });
  await d.getByRole('button', { name: 'Add to cellar' }).click(); await p.waitForURL(/#\/cellar/);
  ok(await cellarCount() === 1, 'the bottles went to the cellar');
  await p.goto(url); await p.waitForSelector('.hero');
  ok(await bottledRows().count() === 1 && (await bottledRows().textContent()).includes('5 × 750 mL'), 'still one Bottled entry, now with "5 × 750 mL"');

  // More bottles later: a second Bottled entry
  await stage('Bottled').click(); await d.waitFor();
  await d.getByRole('textbox', { name: 'Bottles filled' }).fill('2');
  await d.getByRole('button', { name: 'Add to cellar' }).click(); await p.waitForURL(/#\/cellar/);
  await p.goto(url); await p.waitForSelector('.hero');
  ok(await bottledRows().count() === 2 && await cellarCount() === 2, 'bottling more later adds another Bottled entry');

  // Edit timeline entry goes to the entry's own sheet
  await bottledRows().first().click(); await d.waitFor();
  await d.getByRole('button', { name: 'Edit timeline entry' }).click();
  await p.getByRole('dialog', { name: 'Edit entry' }).waitFor();
  ok(await p.getByRole('dialog', { name: 'Edit entry' }).getByLabel('When').count() === 1, 'Edit timeline entry opens the entry, to change its date or remove it');
  // The Bottle this batch button is unchanged for batches still fermenting
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Still going'); await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  await p.getByRole('button', { name: 'Bottle this batch' }).click(); await d.waitFor();
  ok(await d.getByRole('button', { name: 'Mark as bottled without adding to the cellar' }).count() === 1, 'Bottle this batch offers marking as bottled too');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
