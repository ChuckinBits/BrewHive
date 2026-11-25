const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const out = process.argv[2];
  const header = (label) => p.locator('section h3', { hasText: new RegExp('^' + label + '$') });
  const headerIcon = async (label) => (await header(label).locator('svg').count()) ? header(label).locator('svg').innerHTML() : null;
  await p.goto(BASE + '/#/ingredients'); await p.waitForTimeout(700);
  const heads = await p.locator('section h3').count();
  ok(heads > 5 && await p.locator('section h3 svg').count() === heads, 'every category header in the list has an icon (' + heads + ')');
  ok((await headerIcon('Honey')).includes('polygon'), 'Honey shows the honeycomb');
  await p.screenshot({ path: out + '/36-list.png' });

  // Categories sheet: icon buttons
  await p.getByRole('button', { name: 'Categories' }).click(); const d = p.getByRole('dialog', { name: 'Categories' });
  ok(await d.getByRole('button', { name: 'Icon for Honey: Honey. Change it' }).count() === 1, 'Honey has an icon button');
  await d.getByRole('button', { name: /^Icon for Honey/ }).click();
  const picker = p.getByRole('dialog', { name: 'Icon for Honey' });
  ok(await picker.getByRole('button').filter({ hasNot: p.locator('[aria-label="Close"]') }).count() >= 18, 'the picker offers None and the 17 icons');
  ok(await picker.getByRole('button', { name: 'Honey', exact: true }).getAttribute('aria-pressed') === 'true', 'with the current one marked');
  await p.waitForTimeout(300); await p.screenshot({ path: out + '/36-picker.png' });
  await picker.getByRole('button', { name: 'Water', exact: true }).click(); await picker.waitFor({ state: 'detached' });
  ok(await d.getByRole('button', { name: 'Icon for Honey: Water. Change it' }).count() === 1, 'picking Water changes the button');
  // Hops to None
  await d.getByRole('button', { name: /^Icon for Hops/ }).click();
  await p.getByRole('dialog', { name: 'Icon for Hops' }).getByRole('button', { name: 'None' }).click();
  ok(await d.getByRole('button', { name: 'Choose an icon for Hops' }).count() === 1, 'None leaves a dashed + button');
  // A new category starts with none, then gets the leaf
  await d.getByRole('textbox', { name: 'New category' }).fill('Tea'); await d.getByRole('button', { name: 'Add', exact: true }).click();
  ok(await d.getByRole('button', { name: 'Choose an icon for Tea' }).count() === 1, 'a new category starts with no icon');
  await d.getByRole('button', { name: 'Choose an icon for Tea' }).click();
  await p.getByRole('dialog', { name: 'Icon for Tea' }).getByRole('button', { name: 'Leaf' }).click();
  // Renaming keeps the icon
  await d.getByRole('textbox', { name: 'Name of Yeast' }).fill('Yeast & cultures');
  await p.screenshot({ path: out + '/36-sheet.png' });
  await d.getByRole('button', { name: 'Save categories' }).click(); await d.waitFor({ state: 'detached' });
  ok((await headerIcon('Honey')).includes('M12 3c-3 4'), 'Honey now shows the water drop');
  ok(await header('Hops').count() === 0 || await headerIcon('Hops') === null, 'Hops shows no icon');
  ok(((await headerIcon('Yeast & cultures')) ?? '').includes('circle'), 'renamed Yeast keeps its icon');
  // An ingredient in Tea shows the leaf
  await p.getByRole('link', { name: 'Add ingredient' }).click(); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Rooibos'); await p.getByRole('combobox', { name: 'Category' }).selectOption({ label: 'Tea' });
  await p.getByRole('button', { name: 'Add ingredient' }).click(); await p.waitForURL(/#\/ingredients$/); await p.waitForTimeout(300);
  ok((await headerIcon('Tea')).includes('M5 19C5 10'), 'Tea shows the leaf');
  await p.reload(); await p.waitForTimeout(700);
  ok((await headerIcon('Honey')).includes('M12 3c-3 4') && (await headerIcon('Tea')).includes('M5 19C5 10'), 'the choices survive a reload');

  // Categories saved before icons existed use the starter icons
  await p.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open('brewhive'); q.onsuccess = () => r(q.result); });
    const tx = db.transaction('settings', 'readwrite'); const store = tx.objectStore('settings');
    const s = await new Promise((r) => { const q = store.get('app'); q.onsuccess = () => r(q.result); });
    store.put({ ...s, ingredientCategories: s.ingredientCategories.map(({ icon, ...c }) => c) });
    await new Promise((r) => (tx.oncomplete = r));
  });
  await p.reload(); await p.waitForTimeout(700);
  ok((await headerIcon('Honey')).includes('polygon') && ((await headerIcon('Yeast & cultures')) ?? '').includes('circle') && await headerIcon('Tea') === null, 'older saved categories get their starter icons; ones of your own get none');
  await p.getByRole('button', { name: 'Categories' }).click();
  await p.getByRole('dialog', { name: 'Categories' }).getByRole('button', { name: /^Icon for Additives/ }).click();
  ok(await p.getByRole('dialog', { name: 'Icon for Additives' }).getByRole('button', { name: 'Hops' }).locator('clipPath').count() === 1, 'the picker draws hops with its clip');
  const clipIds = await p.evaluate(() => [...document.querySelectorAll('clipPath')].map((c) => c.id));
  ok(new Set(clipIds).size === clipIds.length, 'each drawing has its own clip id (' + clipIds.length + ')');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
