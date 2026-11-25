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
  const search = p.getByRole('searchbox', { name: 'Search ingredients' });
  const chip = (name) => p.getByRole('group', { name: 'Category' }).getByRole('button', { name: new RegExp('^' + name) });
  const back = () => p.locator('.topbar').getByRole('link', { name: /back/i }).first().click();
  await p.goto(BASE + '/#/more'); await p.waitForTimeout(600);
  await p.getByRole('link', { name: /Ingredients/ }).click(); await p.waitForURL(/#\/ingredients$/); await p.waitForTimeout(400);

  // Search, open one, come back
  await search.fill('ho');
  const found = await p.locator('.library-row').count();
  await p.getByRole('link', { name: /^Wildflower honey/ }).click(); await p.waitForSelector('form');
  await back(); await p.waitForURL(/#\/ingredients$/); await p.waitForTimeout(300);
  ok(await until(async () => (await search.inputValue() === 'ho' && await p.locator('.library-row').count() === found)), 'back from an ingredient, the search "ho" is still there (' + found + ' shown)');
  await p.getByRole('link', { name: /^Clover honey/ }).click(); await p.waitForSelector('form');
  await p.getByRole('button', { name: 'Save ingredient' }).click(); await p.waitForURL(/#\/ingredients$/); await p.waitForTimeout(300);
  ok(await until(async () => (await search.inputValue() === 'ho')), 'and after saving one');
  await search.fill('');

  // A category chip, scrolled down
  await chip('Spices').click();
  ok(await until(async () => (await chip('Spices').getAttribute('aria-pressed') === 'true')), 'Spices chip on');
  await p.getByRole('link', { name: /^Star anise/ }).scrollIntoViewIfNeeded();
  const y = await p.evaluate(() => window.scrollY);
  await p.getByRole('link', { name: /^Star anise/ }).click(); await p.waitForSelector('form');
  ok(await until(async () => (await p.evaluate(() => window.scrollY) === 0)), 'the ingredient page opens at the top');
  await back(); await p.waitForURL(/#\/ingredients$/); await p.waitForTimeout(400);
  ok(await until(async () => (await chip('Spices').getAttribute('aria-pressed') === 'true')), 'back: the Spices chip is still on');
  ok(await until(async () => (Math.abs(await p.evaluate(() => window.scrollY) - y) < 5)), 'and the list is where it was (scrolled to ' + y + ')');
  ok(await until(async () => (await p.getByRole('link', { name: /^Star anise/ }).isVisible())), 'with Star anise in view');

  // The phone's own back button too
  await p.getByRole('link', { name: /^Nutmeg/ }).click(); await p.waitForSelector('form');
  await p.goBack(); await p.waitForURL(/#\/ingredients$/); await p.waitForTimeout(400);
  ok(await until(async () => (await chip('Spices').getAttribute('aria-pressed') === 'true')), 'the browser back button keeps it too');

  // Leaving the list and returning keeps it for this session; reopening the app starts fresh
  await p.goto(BASE + '/#/batches'); await p.waitForTimeout(300);
  await p.goto(BASE + '/#/ingredients'); await p.waitForTimeout(400);
  ok(await until(async () => (await chip('Spices').getAttribute('aria-pressed') === 'true')), 'it stays while the app is open');
  await p.reload(); await p.waitForTimeout(700);
  ok(await until(async () => (await search.inputValue() === '' && await p.getByRole('group', { name: 'Category' }).getByRole('button', { pressed: true }).textContent().then((t) => t.startsWith('All')))), 'reopening the app starts with All and no search');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
