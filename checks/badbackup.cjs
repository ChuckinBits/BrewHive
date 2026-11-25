// Restores a backup with good and broken records: the good ones arrive, the broken ones are skipped and counted.
const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
const fs = require('fs');
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const out = process.argv[2];
  const t = '2026-01-02T00:00:00.000Z';
  const backup = {
    app: 'brewhive', formatVersion: 1, exportedAt: t,
    data: {
      batches: [
        { id: 'good-1', name: 'Good mead', status: 'primary', startDate: '2026-01-01', og: 1.1, ingredients: [{ id: 'l1', name: 'Clover honey', amount: '3 lb' }, 'junk'], createdAt: t, updatedAt: t },
        { id: 'bad-1', name: 'No start date', status: 'primary', createdAt: t, updatedAt: t },
        { name: 'No id at all', status: 'primary', startDate: '2026-01-01' },
      ],
      events: [
        { id: 'ev-1', batchId: 'good-1', type: 'gravity', date: '2026-01-05T09:00', value: '1.050', createdAt: t, updatedAt: t },
        { id: 'ev-2', batchId: 'good-1', type: 'teleport', date: '2026-01-06T09:00', value: 1, createdAt: t, updatedAt: t },
      ],
      settings: [{ id: 'app', units: 'metric', tempUnit: 'K', theme: 'dark', views: 'nope', sorts: {} }],
    },
  };
  const file = out + '/bad-backup.json'; fs.writeFileSync(file, JSON.stringify(backup));
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(BASE + '/#/more'); await p.waitForSelector('input[type=file]', { state: 'attached' });
  await p.locator('input[type=file]').setInputFiles(file);
  const toast = p.locator('.toast').filter({ hasText: 'Backup restored' });
  await toast.waitFor();
  const msg = (await toast.textContent()).trim();
  ok(/2 records/.test(msg) && /Skipped 3 records/.test(msg), 'restores 2 good records and skips 3: ' + msg);
  await p.goto(BASE + '/'); await p.getByText('Good mead').first().click(); await p.waitForSelector('.hero');
  ok(await p.getByText('Clover honey').count() >= 1, 'the good batch opens, with its good ingredient');
  ok(await p.getByText('No start date').count() === 0, 'the broken batch is not there');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
