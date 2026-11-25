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
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US', hasTouch: false }); const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const out = process.argv[2];
  await p.goto(BASE + '/manifest.webmanifest');
  await p.evaluate(() => new Promise((res) => { indexedDB.deleteDatabase('brewhive').onsuccess = res; }));
  await p.goto(BASE + '/#/ingredients'); await p.waitForTimeout(900);
  const chips = async () => (await p.getByRole('group', { name: 'Category' }).getByRole('button').allInnerTexts()).map(t => t.replace(/\s*\d+$/, '').trim()).filter(t => t !== 'All');
  const sections = async () => p.locator('section h3').allTextContents();
  const inOrder = (got, order) => got.length > 3 && got.join() === order.filter(x => got.includes(x)).join();
  const rows = async (d) => d.locator('.category-edit input').evaluateAll(els => els.map(e => e.value));
  ok(await until(async () => ((await chips())[0] === 'Honey')), 'starts in the default order, Honey first');

  // Sort A–Z
  await p.getByRole('button', { name: 'Categories' }).click(); let d = p.getByRole('dialog');
  await d.getByRole('button', { name: 'Sort A–Z' }).click();
  const az = await rows(d);
  ok(az[0] === 'Additives' && az[az.length - 1] === 'Other' && az.slice(0, -1).join() === [...az.slice(0, -1)].sort((a, b) => a.localeCompare(b)).join(), 'Sort A–Z orders the rows, Other last: ' + az.join(', '));
  ok(await until(async () => (await d.getByRole('button', { name: 'Sort A–Z' }).isDisabled())), 'Sort A–Z is greyed out once sorted');
  await p.screenshot({ path: out + '/cat-sorted.png' });
  await d.getByRole('button', { name: 'Save categories' }).click(); await d.waitFor({ state: 'detached' });
  ok(await until(async () => (inOrder(await chips(), az))), 'the chips follow the saved order');
  const secs = await sections();
  ok(secs.indexOf('Additives') < secs.indexOf('Honey') && secs.indexOf('Honey') < secs.indexOf('Yeast'), 'the list sections follow it too');

  // Keyboard: move Yeast to the top
  await p.getByRole('button', { name: 'Categories' }).click(); d = p.getByRole('dialog');
  const yeast = d.getByRole('button', { name: /^Reorder Yeast/ });
  await yeast.focus();
  const n = az.indexOf('Yeast');
  for (let i = 0; i < n; i++) await p.keyboard.press('ArrowUp');
  ok(await until(async () => ((await rows(d))[0] === 'Yeast')), 'the up arrow on the handle moves Yeast to the top');
  ok(await until(async () => (await p.evaluate(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Reorder Yeast')))), 'focus stays on the handle');
  ok(await until(async () => (!(await d.getByRole('button', { name: 'Sort A–Z' }).isDisabled()))), 'Sort A–Z is offered again');

  // Drag: Honey's handle down below Spices
  const before = await rows(d);
  const h = await d.getByRole('button', { name: /^Reorder Honey/ }).boundingBox();
  const target = await d.locator('.category-edit li').nth(before.indexOf('Spices')).boundingBox();
  await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await p.mouse.down();
  for (let s = 1; s <= 12; s++) await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + (target.y + target.height * 0.8 - h.y - h.height / 2) * s / 12);
  await p.screenshot({ path: out + '/cat-dragging.png' });
  await p.mouse.up();
  const after = await rows(d);
  ok(after.indexOf('Honey') === after.indexOf('Spices') + 1, 'dragging puts Honey right after Spices: ' + after.join(', '));
  await d.getByRole('button', { name: 'Save categories' }).click(); await d.waitFor({ state: 'detached' });
  ok(await until(async () => (inOrder(await chips(), after))), 'the chips follow the dragged order');
  const s2 = await sections();
  ok(s2[0] === 'Yeast' && s2.indexOf('Honey') === s2.indexOf('Spices') + 1, 'and so do the sections');

  // Cancel keeps the saved order
  await p.getByRole('button', { name: 'Categories' }).click(); d = p.getByRole('dialog');
  await d.getByRole('button', { name: 'Sort A–Z' }).click();
  await p.keyboard.press('Escape'); await d.waitFor({ state: 'detached' });
  ok(await until(async () => (inOrder(await chips(), after))), 'closing without saving keeps the order');
  await p.reload(); await p.waitForTimeout(600);
  ok(await until(async () => (inOrder(await chips(), after))), 'the order survives a reload');
  // Touch, on a phone: drag Yeast from the top down to the bottom, with the sheet scrolling along.
  const t = await b.newContext({ ...require('playwright').devices['iPhone 13'] }); const tp = await t.newPage();
  tp.on('pageerror', e => errors.push(e.message));
  await tp.goto(BASE + '/#/ingredients'); await tp.waitForTimeout(800);
  await tp.getByRole('button', { name: 'Categories' }).click(); const td = tp.getByRole('dialog');
  const cdp = await t.newCDPSession(tp);
  const hb = await td.getByRole('button', { name: /^Reorder Yeast/ }).boundingBox();
  const body = await td.locator('.sheet-body').boundingBox();
  const x = hb.x + hb.width / 2; let y = hb.y + hb.height / 2;
  const touch = (type, yy) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: yy }] });
  await touch('touchStart', y);
  const bottom = body.y + body.height - 10;
  for (let s = 1; s <= 15; s++) await touch('touchMove', y + (bottom - y) * s / 15);
  await tp.waitForTimeout(1500);
  await touch('touchMove', bottom + 1);
  await touch('touchEnd');
  const trows = await td.locator('.category-edit input').evaluateAll(els => els.map(e => e.value));
  ok(trows.indexOf('Yeast') >= trows.length - 2, 'a touch drag scrolls the sheet and takes Yeast to the end: ' + trows.join(', '));
  await tp.screenshot({ path: out + '/cat-touch.png' });
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
