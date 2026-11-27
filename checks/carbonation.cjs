const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
// Waits for a condition that reads the page: the page can lag a moment behind a click or a save.
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
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const d = p.getByRole('dialog').last();
  const hero = p.locator('.hero svg.vessel');
  const fizz = () => hero.locator('.fizz circle').count();
  const airlock = () => hero.locator('rect[height="11"]').count();
  const fact = async (name) => { const dt = p.locator('dt', { hasText: new RegExp('^' + name + '$') }); return (await dt.count()) ? (await dt.locator('xpath=following-sibling::dd[1]').textContent()).trim() : ''; };
  const carbRows = () => p.locator('.timeline-entry', { hasText: /^Carbonated/ });

  // A batch in Aging, with an airlock and no fizz
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Fizzy'); await p.getByRole('textbox', { name: 'Volume' }).fill('1');
  await p.getByRole('textbox', { name: 'Original gravity' }).fill('1.100');
  await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await airlock()) === 1 && (await fizz()) === 0), 'a new batch has its airlock and no fizz');

  // 1. A Carbonated entry: forced, petillant, 12 PSI
  await p.getByRole('button', { name: 'Add entry' }).click(); await d.waitFor();
  await d.getByRole('radio', { name: 'Carbonated' }).click();
  await d.getByRole('group', { name: 'Method' }).getByRole('button', { name: 'Forced' }).click();
  await d.getByRole('group', { name: 'How fizzy' }).getByRole('button', { name: 'Petillant' }).click();
  await d.getByLabel('Pressure (PSI, optional)').fill('99');
  await d.getByRole('button', { name: 'Save' }).click();
  ok(await until(async () => (await d.getByRole('alert').count()) === 1), 'a pressure over 60 PSI is refused');
  await d.getByLabel('Pressure (PSI, optional)').fill('12');
  await p.screenshot({ path: out + '/carbonated-entry.png' });
  await d.getByRole('button', { name: 'Save' }).click(); await d.waitFor({ state: 'detached' });
  ok(await until(async () => (await carbRows().count()) === 1 && /Petillant · forced, 12 PSI/.test(await carbRows().first().textContent())), 'the timeline shows Carbonated: Petillant · forced, 12 PSI');
  ok(await until(async () => (await fact('Carbonation')) === 'Petillant · forced, 12 PSI'), 'Details shows the carbonation');
  ok(await until(async () => (await airlock()) === 0 && (await fizz()) > 0), 'the batch art loses its airlock and fizzes');
  ok(await until(async () => (await hero.locator('.fizz-gentle').count()) === 1 && (await fizz()) === 8), 'petillant fizzes gently: half the bubbles, slower');
  await p.screenshot({ path: out + '/carbonated-batch.png' });

  // 2. Removing the entry makes it still again
  await carbRows().first().click(); await d.waitFor();
  await d.getByRole('button', { name: 'Remove entry' }).click(); await d.getByRole('button', { name: 'Remove', exact: true }).click(); await p.waitForTimeout(400);
  ok(await until(async () => (await carbRows().count()) === 0 && (await airlock()) === 1 && (await fizz()) === 0 && (await fact('Carbonation')) === ''), 'removing it brings the airlock back and stops the fizz');

  // 3. Bottling, primed with honey: a Carbonated entry and sparkling bottles
  await p.getByRole('button', { name: 'Bottle this batch' }).click(); await d.waitFor();
  await d.getByRole('textbox', { name: 'Final gravity (optional)' }).fill('1.000');
  await d.getByRole('group', { name: 'Carbonation' }).getByRole('button', { name: 'Natural' }).click();
  await d.getByLabel('Amount (optional)').fill('3 oz');
  await d.getByRole('button', { name: 'Add to cellar' }).click(); await d.waitFor({ state: 'detached' });
  await p.waitForURL(/#\/cellar\//);
  ok(await until(async () => (await fact('Carbonation')) === 'Sparkling'), 'the bottles are sparkling');
  ok(await until(async () => (await hero.locator('.fizz circle').count()) === 16 && (await hero.locator('.fizz-gentle').count()) === 0), 'and the bottle fizzes fully');
  await p.screenshot({ path: out + '/carbonated-bottle.png' });
  await p.locator('dd a', { hasText: 'Fizzy' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await carbRows().count()) === 1 && /Sparkling · natural, honey 3 oz/.test(await carbRows().first().textContent())), 'bottling added a Carbonated entry: Sparkling · natural, honey 3 oz');

  // 4. Adding more bottles to a carbonated batch keeps its carbonation
  await p.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Bottled', exact: true }).click(); await d.waitFor();
  ok(await until(async () => (await d.getByText(/^Carbonated: Sparkling/).count()) === 1 && (await d.getByRole('group', { name: 'Carbonation' }).count()) === 0), 'Add bottles says it is carbonated, with nothing to pick');
  await d.getByRole('button', { name: 'Close', exact: true }).click(); await d.waitFor({ state: 'detached' });

  // 5. Still bottles stay still, and the cellar edit form can change it
  await p.goto(BASE + '/#/cellar/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Plain'); await p.getByRole('button', { name: /Add|Save/ }).last().click();
  await p.waitForURL(/#\/cellar\/(?!new)/);
  ok(await until(async () => (await fact('Carbonation')) === 'Still' && (await hero.locator('.fizz circle').count()) === 0), 'bottles added by hand are still');
  await p.getByRole('link', { name: 'Edit cellar entry' }).click(); await p.waitForSelector('form');
  await p.getByRole('group', { name: 'Carbonation' }).getByRole('button', { name: 'Petillant' }).click();
  await p.getByRole('button', { name: /Save/ }).last().click(); await p.waitForURL(/#\/cellar\/(?!.*edit)/);
  ok(await until(async () => (await fact('Carbonation')) === 'Petillant' && (await hero.locator('.fizz circle').count()) > 0), 'editing them to Petillant makes them fizz');

  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
