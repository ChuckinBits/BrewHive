const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
const fs = require('fs');
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', acceptDownloads: true }); const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const pressed = async () => (await p.getByRole('group', { name: 'Volume and weight units' }).getByRole('button', { pressed: true }).textContent()).trim();
  const stored = () => p.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open('brewhive'); q.onsuccess = () => r(q.result); });
    return new Promise((r) => { const q = db.transaction('settings').objectStore('settings').get('app'); q.onsuccess = () => r(q.result); });
  });
  // A device from v0.2.0: settings saved with volumeUnit 'L'
  await p.goto(BASE + '/#/more'); await p.waitForTimeout(600);
  await p.goto(BASE + '/manifest.webmanifest');
  await p.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open('brewhive'); q.onsuccess = () => r(q.result); });
    const tx = db.transaction('settings', 'readwrite'); const store = tx.objectStore('settings');
    const t = '2026-11-01T00:00:00.000Z';
    store.put({ id: 'app', volumeUnit: 'L', tempUnit: 'C', theme: 'system', views: {}, sorts: {}, createdAt: t, updatedAt: t, deletedAt: null });
    await new Promise((r) => (tx.oncomplete = r));
  });
  ok((await stored()).volumeUnit === 'L' && (await stored()).units === undefined, 'set up: an older device with volumeUnit "L"');
  await p.goto(BASE + '/#/more'); await p.waitForTimeout(600);
  ok(await pressed() === 'Metric', 'it opens as Metric');
  const upgraded = await stored();
  ok(upgraded.units === 'metric' && !('volumeUnit' in upgraded) && upgraded.tempUnit === 'C', 'and the saved setting is converted to units: "metric", keeping the rest');
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  ok(await p.getByRole('button', { name: 'Liters' }).getAttribute('aria-pressed') === 'true', 'new batches start in liters');

  // Changing the setting saves it the new way
  await p.goto(BASE + '/#/more'); await p.waitForTimeout(400);
  await p.getByRole('group', { name: 'Volume and weight units' }).getByRole('button', { name: 'US' }).click(); await p.waitForTimeout(300);
  let s = await stored();
  ok(s.units === 'us' && !('volumeUnit' in s), 'switching to US saves units: "us" and drops volumeUnit');

  // A backup says units
  const [download] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Save a backup file' }).click()]);
  const file = out + '/units-backup.json'; await download.saveAs(file);
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  const app = backup.data.settings.find((x) => x.id === 'app');
  ok(app.units === 'us' && !('volumeUnit' in app), 'the backup file has units: "us" and no volumeUnit');
  await p.waitForTimeout(3200);

  // Restoring an older backup with volumeUnit 'L' gives Metric
  app.volumeUnit = 'L'; delete app.units;
  fs.writeFileSync(out + '/units-old-backup.json', JSON.stringify(backup));
  await p.locator('input[type=file]').setInputFiles(out + '/units-old-backup.json');
  await p.getByText(/Backup restored/).waitFor({ timeout: 8000 });
  await p.waitForTimeout(300);
  s = await stored();
  ok(s.units === 'metric' && !('volumeUnit' in s), 'restoring an older backup with volumeUnit "L" stores units: "metric"');
  await p.goto(BASE + '/#/batches'); await p.goto(BASE + '/#/more'); await p.waitForTimeout(400);
  ok(await pressed() === 'Metric', 'and More shows Metric');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
