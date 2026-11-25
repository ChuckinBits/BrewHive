const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
// The list filters on Batches and Cellar (Active, Bottled, Archived, All and the like) stay on one line on a phone,
// fit without scrolling from 375 px wide, and never make the page wider than the screen.
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch();
  for (const width of [360, 375, 390]) {
    const p = await (await b.newContext({ viewport: { width, height: 800 } })).newPage();
    await p.goto(BASE + '/'); await p.waitForSelector('.empty');
    await p.getByRole('button', { name: 'Load sample data' }).click(); await p.waitForSelector('.shelf-item');
    await p.evaluate(() => document.fonts.ready);
    for (const [name, route] of [['Batches', '#/'], ['Cellar', '#/cellar']]) {
      await p.goto(BASE + '/' + route); await p.waitForSelector('.toolbar .chip');
      const r = await p.evaluate(() => {
        const row = document.querySelector('.toolbar .chips');
        const tops = new Set([...row.querySelectorAll('.chip')].map((c) => Math.round(c.getBoundingClientRect().top)));
        return { lines: tops.size, scrolls: row.scrollWidth > row.clientWidth, pageWide: document.documentElement.scrollWidth > innerWidth };
      });
      ok(r.lines === 1 && !r.pageWide, `${name} at ${width}px: filters on one line, page not wider than the screen`);
      if (width >= 375) ok(!r.scrolls, `${name} at ${width}px: filters fit without scrolling`);
      if (width === 375 && name === 'Batches') await p.screenshot({ path: out + '/filterrow-375.png', clip: { x: 0, y: 0, width, height: 260 } });
    }
  }
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
