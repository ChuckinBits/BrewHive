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
const fs = require('fs');
const shots = process.argv[2];
const assert = (cond, msg) => { if (!cond) throw new Error('ASSERT: ' + msg); console.log('ok  ' + msg); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US', acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const base = BASE + '/';
  await page.goto(base);
  await page.waitForSelector('.empty');
  await page.screenshot({ path: `${shots}/21-empty.png` });
  await page.getByRole('button', { name: 'Load sample data' }).click();
  await page.waitForSelector('.shelf-item');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${shots}/22-shelf.png` });

  // Sort by rating
  await page.getByRole('button', { name: /^All/ }).click();
  await page.getByLabel('Sort').selectOption('rating');
  await page.waitForTimeout(300);
  const order = await page.locator('.shelf-label strong').allTextContents();
  assert(order[0] === 'Winter Spice' && order[1] === 'First Traditional' && order[2] === 'Orchard Cyser', 'sort by rating puts 8.5, 8, 7 first: ' + order.join(' | '));

  // Rate a batch: Change opens the rating sheet, Save sets it
  await page.getByRole('link', { name: /Bramble Melomel #2/ }).click();
  await page.waitForSelector('.hero');
  await page.locator('.rating-card').getByRole('button', { name: /^(Rate|Change)$/ }).click();
  await page.getByRole('dialog').getByLabel('Rating').fill('9.5');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(300);
  assert(await until(async () => ((await page.locator('.hero .rating').textContent()) === '9.5')), 'the rating sheet sets the badge to 9.5');
  const abvText = await page.locator('.stat-value').nth(2).textContent();
  assert(abvText === '10.9%', 'live ABV from OG 1.114 and latest reading 1.031 is 10.9%: ' + abvText);

  // Status change is logged
  await page.getByRole('button', { name: 'Secondary' }).click();
  await page.waitForTimeout(300);
  assert(await until(async () => (await page.getByText('Moved to Secondary').count() === 1)), 'status change appears in the timeline');

  // Backup round trip
  await page.goto(base + '#/more');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save a backup file' }).click()]);
  const file = `${shots}/backup.json`;
  await download.saveAs(file);
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert(backup.app === 'brewhive' && backup.data.batches.length === 5 && backup.data.recipes.length === 3, `backup holds 5 batches and 3 recipes (${download.suggestedFilename()})`);
  await page.getByRole('button', { name: 'Erase everything' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Erase everything' }).click();
  await page.getByText('Everything was erased').waitFor();
  await page.goto(base + '#/');
  await page.waitForSelector('.empty');
  assert(true, 'erase leaves an empty app');
  await page.goto(base + '#/more');
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByText(/Backup restored/).waitFor();
  await page.goto(base + '#/');
  await page.waitForSelector('.shelf-item');
  await page.getByRole('button', { name: /^All/ }).click();
  assert(await until(async () => (await page.locator('a.shelf-item').count() === 5)), 'restore brings back all 5 batches');
  assert(await until(async () => ((await page.getByLabel('Sort').inputValue()) === 'rating')), 'restore brings back settings (sort order)');

  // A bad file is refused politely
  fs.writeFileSync(`${shots}/bad.json`, '{"hello": 1}');
  await page.goto(base + '#/more');
  await page.locator('input[type=file]').setInputFiles(`${shots}/bad.json`);
  await page.getByText('That file is not a BrewHive backup.').waitFor();
  assert(true, 'a non-backup file is refused with a clear message');

  // Units: switch to liters and check a detail screen
  await page.getByRole('group', { name: 'Volume and weight units' }).getByRole('button', { name: 'Metric' }).click();
  await page.goto(base + '#/recipes');
  await page.getByRole('link', { name: /First Traditional/ }).click();
  await page.waitForSelector('.hero');
  assert(await until(async () => ((await page.locator('.hero-sub').textContent()).includes('3.8 L'))), 'volume shows in liters after switching units');

  // Data survives a reload, and the app works offline through the service worker
  await page.goto(base);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.shelf-item', { timeout: 10000 });
  assert(true, 'app loads and shows data while offline');
  await ctx.setOffline(false);

  // Wide screen
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${shots}/23-wide.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert(!overflow, 'no sideways scroll at 1200 px');
  await page.setViewportSize({ width: 320, height: 640 });
  await page.waitForTimeout(400);
  for (const hash of ['#/', '#/recipes', '#/cellar', '#/more', '#/batches/new']) {
    await page.goto(base + hash);
    await page.waitForTimeout(300);
    const o = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert(!o, `no sideways scroll at 320 px on ${hash}`);
  }
  await page.goto(base + '#/');
  await page.screenshot({ path: `${shots}/24-narrow.png` });
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'no console errors');
  await browser.close();
})().catch((e) => { console.error('CHECK FAILED:', e.message); process.exit(1); });
