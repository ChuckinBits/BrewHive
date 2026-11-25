const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
// Bug-hunt follow-ups: removing the latest stage change moves the batch back; bottling more than the
// batch holds gets a note; a long batch name shows in full on its page (up to three lines).
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
const until = async (read, ms = 5000) => { const end = Date.now() + ms; for (;;) { const v = await read(); if (v || Date.now() > end) return v; await new Promise((r) => setTimeout(r, 100)); } };
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 375, height: 812 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const d = p.getByRole('dialog').last();
  const status = async () => (await p.getByRole('group', { name: 'Status' }).getByRole('button', { pressed: true }).textContent()).trim();
  const stageButton = (name) => p.getByRole('group', { name: 'Status' }).getByRole('button', { name });
  const newBatch = async (name, volume) => {
    await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
    await p.getByRole('textbox', { name: 'Name' }).fill(name);
    if (volume) await p.getByRole('textbox', { name: 'Volume' }).fill(volume);
    await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  };
  const remove = async (entryText) => {
    await p.locator('.timeline-entry', { hasText: entryText }).first().click(); await d.waitFor();
    await d.getByRole('button', { name: 'Remove entry' }).click();
    const said = (await d.getByRole('group', { name: 'Confirm removal' }).textContent()).trim();
    await d.getByRole('button', { name: 'Remove', exact: true }).click(); await d.waitFor({ state: 'detached' });
    return said;
  };

  // 1. Removing the latest stage change.
  await newBatch('Stage back');
  await stageButton('Secondary').click(); await until(async () => (await status()) === 'Secondary');
  const said = await remove('Moved to Secondary');
  ok(/latest stage change, so the batch goes back to Primary/.test(said), 'the confirmation says it goes back to Primary');
  ok(await until(async () => (await status()) === 'Primary'), 'removing the latest stage change moves the batch back to Primary');
  // Backdated history (not the latest) leaves the batch where it is.
  await stageButton('Secondary').click(); await until(async () => (await status()) === 'Secondary');
  await p.getByRole('button', { name: 'Add entry' }).click(); await d.waitFor();
  await d.getByRole('radio', { name: 'Stage change' }).click();
  await d.getByRole('combobox', { name: 'Move to' }).selectOption('primary');
  await d.getByLabel('When', { exact: true }).fill('2020-01-01T09:00');
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  const said2 = await remove('Moved to Primary');
  ok(!/goes back/.test(said2), 'removing an earlier stage change does not mention moving back');
  ok(await until(async () => (await status()) === 'Secondary'), 'and the batch stays in Secondary');

  // 2. Bottling more than the batch holds.
  await newBatch('Bottle note', '1');
  await p.getByRole('button', { name: 'Bottle this batch' }).click(); await d.waitFor();
  const note = () => d.getByText(/more than this batch holds/);
  ok(await note().count() === 0, 'the usual count gets no note');
  await d.getByRole('textbox', { name: /Bottles|How many/ }).first().fill('40');
  ok(await until(async () => (await note().count()) === 1), '40 bottles from 1 gallon: "more than this batch holds"');
  ok(await d.getByRole('button', { name: 'Add to cellar' }).isEnabled(), 'and it can still be bottled');
  await p.screenshot({ path: out + '/huntfixes-bottle.png' });

  // 3. A long name shows in full on the batch's page.
  const long = 'Raspberry Lemon Balm Melomel with Wildflower Honey and Oak';
  await newBatch(long);
  const t = p.locator('.topbar-title');
  const box = await t.evaluate((el) => ({ text: el.textContent, lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)), cut: el.scrollHeight > el.clientHeight + 1 }));
  await p.screenshot({ path: out + '/huntfixes-title.png', clip: { x: 0, y: 0, width: 375, height: 200 } });
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'the page is no wider than the screen');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
