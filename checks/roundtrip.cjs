const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
// A backup carries everything: fill the app (sample data, an edited and a deleted starter ingredient,
// a pasteurization entry, metric units, Hide Add), back up, erase, restore, back up again, and the
// two backups hold the same records.
const fs = require('fs');
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const d = p.getByRole('dialog').last();
  const backup = async (name) => {
    await p.goto(BASE + '/#/more');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Save a backup file' }).click()]);
    const file = `${out}/${name}.json`; await dl.saveAs(file);
    return { file, json: JSON.parse(fs.readFileSync(file, 'utf8')), suggested: dl.suggestedFilename() };
  };

  await p.goto(BASE + '/'); await p.waitForSelector('.empty');
  await p.getByRole('button', { name: 'Load sample data' }).click(); await p.waitForSelector('.shelf-item');
  // A starter ingredient priced, another deleted.
  await p.goto(BASE + '/#/ingredients'); await p.getByRole('link', { name: /^Clover honey/ }).click(); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: /^Price/ }).fill('20'); await p.getByRole('textbox', { name: 'Amount' }).fill('10');
  await p.locator('.cost-row').getByRole('combobox', { name: 'Unit' }).selectOption('lb');
  await p.getByRole('button', { name: 'Save ingredient' }).click(); await p.waitForURL(/#\/ingredients$/);
  await p.getByRole('link', { name: /^Orange blossom honey/ }).click(); await p.waitForSelector('form');
  await p.getByRole('button', { name: 'Delete', exact: true }).click(); await p.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click(); await p.waitForURL(/#\/ingredients$/);
  // A pasteurization entry with temperature and time, and Hide Add.
  await p.goto(BASE + '/'); await p.locator('.shelf-item').first().click(); await p.waitForSelector('.hero');
  await p.getByRole('button', { name: 'Add entry' }).click(); await d.waitFor();
  await d.getByRole('radio', { name: 'Stabilized', exact: true }).click();
  await d.getByRole('combobox', { name: 'Method' }).selectOption('Pasteurization');
  await d.getByRole('textbox', { name: 'Temperature (optional)' }).fill('160'); await d.getByRole('textbox', { name: 'Time (minutes)' }).fill('15');
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  // Hide Add shows on a batch with something left to log.
  let hidden = false;
  for (let i = 0; i < (await p.locator('.shelf-item').count() || 6) && !hidden; i++) {
    await p.goto(BASE + '/'); await p.locator('.shelf-item').nth(i).click(); await p.waitForSelector('.hero');
    const hide = p.getByRole('button', { name: 'Hide Add' });
    if (await hide.count()) { await hide.click(); await p.getByRole('button', { name: 'Show Add' }).waitFor(); hidden = true; }
  }
  ok(hidden, 'Hide Add is switched on');
  // Metric units.
  await p.goto(BASE + '/#/more'); await p.getByRole('radio', { name: 'Metric' }).or(p.getByRole('button', { name: 'Metric' })).first().click();
  await p.waitForTimeout(500);

  const first = await backup('roundtrip-1');
  const localToday = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  ok(first.suggested === `brewhive-backup-${localToday}.json`, `the file is named for today where you are: ${first.suggested}`);
  await p.goto(BASE + '/#/more'); await p.getByRole('button', { name: 'Erase everything' }).click();
  await p.getByRole('dialog').getByRole('button', { name: 'Erase everything' }).click(); await p.waitForTimeout(800);
  await p.goto(BASE + '/#/more'); await p.locator('input[type=file]').setInputFiles(first.file);
  await p.locator('.toast').filter({ hasText: 'Backup restored' }).waitFor();
  await p.waitForTimeout(500);
  const second = await backup('roundtrip-2');

  const strip = (r) => { const { createdAt, updatedAt, ...rest } = r; return JSON.stringify(rest, Object.keys(rest).sort()); };
  ok((first.json.data.equipment || []).length > 0, 'the backup has the sample equipment (v0.3)');
  for (const store of ['recipes', 'batches', 'events', 'cellar', 'pours', 'ingredients', 'equipment']) {
    const a = new Map((first.json.data[store] || []).map((r) => [r.id, r]));
    const c = new Map((second.json.data[store] || []).map((r) => [r.id, r]));
    const lost = [...a.keys()].filter((id) => !c.has(id));
    const changed = [...a.keys()].filter((id) => c.has(id) && strip(a.get(id)) !== strip(c.get(id)));
    const name = (r) => r.name || r.type || r.id;
    ok(lost.length === 0 && changed.length === 0, `${store}: all ${a.size} records come back as they were` + (lost.length || changed.length ? ` (lost: ${lost.map((id) => name(a.get(id))).join(', ') || 'none'}; changed: ${changed.slice(0, 5).map((id) => name(a.get(id))).join(', ') || 'none'})` : ''));
  }
  const s1 = first.json.data.settings.find((s) => s.id === 'app'); const s2 = second.json.data.settings.find((s) => s.id === 'app');
  const keys = ['units', 'tempUnit', 'theme', 'views', 'sorts', 'ingredientCategories', 'currency', 'hideIngredientAdd'];
  const differ = keys.filter((k) => JSON.stringify(s1[k]) !== JSON.stringify(s2[k]));
  ok(s1.units === 'metric' && s1.hideIngredientAdd === true && differ.length === 0, `settings come back as they were (metric, Hide Add on)` + (differ.length ? `; differ: ${differ.join(', ')}` : ''));
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
