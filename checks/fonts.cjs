const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
// The app's fonts are bundled: they load from the app itself on every device, not from what's installed.
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const fontRequests = [];
  p.on('request', (r) => { if (r.resourceType() === 'font') fontRequests.push(r.url()); });
  await p.goto(BASE + '/'); await p.waitForSelector('.empty');
  await p.evaluate(() => document.fonts.ready);
  const loaded = await p.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '')));
  ok(loaded.includes('Inter Variable'), 'Inter is loaded from the app: ' + [...new Set(loaded)].join(', '));
  ok(loaded.includes('Bricolage Grotesque Variable'), 'Bricolage Grotesque is loaded from the app');
  const family = (sel) => p.locator(sel).first().evaluate((el) => getComputedStyle(el).fontFamily);
  ok((await family('body')).startsWith('"Inter Variable"'), 'body text asks for Inter first');
  ok((await family('h1, .topbar h1, .topbar-title')).startsWith('"Bricolage Grotesque Variable"'), 'headings ask for Bricolage Grotesque first');
  const origin = new URL(BASE).origin;
  ok(fontRequests.length > 0 && fontRequests.every((u) => u.startsWith(origin)), `font files come from the app itself (${fontRequests.length} requested)`);
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
