const { chromium } = require('playwright');
const BASE = process.env.BREWHIVE_URL || 'http://localhost:4173';
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' }); const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const out = process.argv[2];
  // An existing v0.1.2 database (version 1, no ingredients store) with a recipe in it
  // Set it up from a plain file on the same site, so the app isn't holding the database open.
  await p.goto(BASE + '/manifest.webmanifest');
  await p.evaluate(() => new Promise((res, rej) => { indexedDB.deleteDatabase('brewhive').onsuccess = res; }));
  await p.evaluate(() => new Promise((res, rej) => {
    const r = indexedDB.open('brewhive', 1);
    r.onupgradeneeded = () => { for (const n of ['recipes', 'batches', 'events', 'cellar', 'pours', 'settings']) r.result.createObjectStore(n, { keyPath: 'id' }); };
    r.onsuccess = () => { const tx = r.result.transaction('recipes', 'readwrite'); tx.objectStore('recipes').put({ id: 'old', name: 'Old recipe', beverageType: 'mead', style: '', batchSizeL: null, targetOG: null, targetFG: null, ingredients: [{ id: 'l1', name: 'Clover honey', amount: '3 lb' }], steps: [], notes: '', rating: null, isPublished: false, icon: 'traditional', color: '#E8A33A', createdAt: '2026-01-01', updatedAt: '2026-01-01', deletedAt: null }); tx.oncomplete = () => { r.result.close(); res(); }; };
    r.onerror = rej;
  }));
  await p.goto(BASE + '/#/recipes'); await p.reload(); await p.waitForTimeout(800);
  ok(await p.getByText('Old recipe').count() > 0, 'a version 1 database opens, and its recipes are still there');

  await p.goto(BASE + '/#/more'); await p.waitForTimeout(300);
  await p.getByRole('link', { name: /Ingredients/ }).click(); await p.waitForURL(/#\/ingredients$/);
  await p.getByRole('link', { name: /Wildflower honey/ }).waitFor({ timeout: 5000 });
  ok(await p.getByRole('link', { name: /Wildflower honey/ }).count() === 1 && await p.getByRole('link', { name: /Lalvin 71B/ }).count() === 1, 'More → Ingredients lists the starter ingredients');
  ok(await p.getByRole('heading', { name: 'Honey' }).count() === 1 && await p.getByRole('heading', { name: 'Yeast' }).count() === 1, 'grouped by category');
  await p.screenshot({ path: out + '/31-list.png' });
  await p.getByRole('searchbox', { name: 'Search ingredients' }).fill('lalvin');
  ok(await p.locator('.library-row').count() === 6, 'search finds the six Lalvin yeasts');
  await p.getByRole('searchbox', { name: 'Search ingredients' }).fill('');
  await p.getByRole('group', { name: 'Category' }).getByRole('button', { name: /^Nutrients/ }).click();
  ok(await p.locator('.library-row').count() === 4 && await p.getByRole('heading', { name: 'Honey' }).count() === 0, 'the Nutrients chip shows only nutrients');

  // Add one in the selected category
  await p.getByRole('link', { name: 'Add ingredient' }).click(); await p.waitForSelector('form');
  ok(await p.getByRole('combobox', { name: 'Category' }).inputValue() === 'nutrient', 'adding from a category starts in it');
  await p.getByRole('textbox', { name: 'Name' }).fill('fermaid o');
  await p.getByRole('button', { name: 'Add ingredient' }).click();
  ok(await p.getByText('Fermaid O is already in your ingredients.').count() === 1, 'a duplicate name is caught');
  await p.getByRole('textbox', { name: 'Name' }).fill('Boysenberries'); await p.getByRole('combobox', { name: 'Category' }).selectOption('fruit'); await p.getByRole('combobox', { name: 'Default unit' }).selectOption('lb');
  await p.getByRole('button', { name: 'Add ingredient' }).click(); await p.waitForURL(/#\/ingredients$/);
  await p.getByRole('group', { name: 'Category' }).getByRole('button', { name: /^All/ }).click();
  ok(await p.getByRole('region', { name: 'Fruit' }).getByRole('link', { name: /Boysenberries\s*lb/ }).count() === 1, 'Boysenberries is listed under Fruit, in lb');

  // Used in (older lines match by name)
  await p.getByRole('link', { name: /Clover honey/ }).click(); await p.waitForSelector('form');
  ok(await p.locator('.used-in').getByRole('link', { name: /Old recipe/ }).count() === 1, 'Used in lists the recipe that uses it');
  await p.screenshot({ path: out + '/31-edit.png', fullPage: true });

  // Rename and add categories; removing one moves its ingredients to Other
  await p.goto(BASE + '/#/ingredients'); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Categories' }).click();
  const d = p.getByRole('dialog');
  await d.getByRole('textbox', { name: 'Name of Fruit' }).fill('Fruit & berries');
  await d.getByRole('textbox', { name: 'New category' }).fill('Tea'); await d.getByRole('button', { name: 'Add', exact: true }).click();
  await d.getByRole('button', { name: 'Remove Tannins' }).click();
  await d.getByRole('button', { name: 'Save categories' }).click(); await p.waitForTimeout(400);
  ok(await p.getByRole('heading', { name: 'Fruit & berries' }).count() === 1, 'a category can be renamed');
  ok(await p.getByRole('region', { name: 'Other' }).getByRole('link', { name: /Oak cubes/ }).count() === 1, 'removing Tannins moved Oak cubes to Other');
  await p.getByRole('link', { name: 'Add ingredient' }).click(); await p.waitForSelector('form');
  ok(await p.getByRole('combobox', { name: 'Category' }).locator('option', { hasText: 'Tea' }).count() === 1, 'a new category can be picked');

  // Delete; reload doesn't bring a deleted starter back
  await p.goto(BASE + '/#/ingredients'); await p.waitForTimeout(300);
  await p.getByRole('link', { name: /Buckwheat honey/ }).click(); await p.waitForSelector('form');
  await p.getByRole('button', { name: 'Delete' }).click(); await d.getByRole('button', { name: 'Delete' }).click(); await p.waitForURL(/#\/ingredients$/);
  await p.reload(); await p.waitForTimeout(800);
  ok(await p.getByRole('link', { name: /Buckwheat honey/ }).count() === 0, 'a deleted starter ingredient stays deleted after reloading');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scrolling');
  console.log(errors.length ? 'ERRORS ' + errors : 'no console errors'); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
