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
const ENTRY_LABELS = { gravity: 'Gravity reading', ingredient: 'Ingredient', tasting: 'Tasting', note: 'Note', status: 'Stage change', rack: 'Racked', feeding: 'Sugar added', backsweeten: 'Sugar added', stabilize: 'Stabilized', temperature: 'Temperature', ph: 'pH', moved: 'Relocate', estimate: 'Estimated ABV', fining: 'Fining', nutrient: 'Nutrients', pitch: 'Yeast pitched' };
// Step feeding and backsweetening are one Sugar added button; its "This will ferment" box picks which.
const sugarAs = async (p, type) => { if (type !== 'feeding' && type !== 'backsweeten') return; const box = p.getByLabel(/^This will ferment/); if (type === 'feeding') await box.check(); else await box.uncheck(); };
const entryLabel = (arg) => (typeof arg === 'string' ? (ENTRY_LABELS[arg] ?? arg) : arg.label);
const ok = (c, m) => { if (!c) throw new Error('FAILED: ' + m); console.log('ok  ' + m); };
const pad = (n) => String(n).padStart(2, '0');
const day = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  const dividers = () => p.locator('.timeline-sections .stage-divider').evaluateAll((hs) => hs.map((h) => h.textContent.replace(/Now$/, '').trim()));
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Aging mead'); await p.getByLabel('Start date').fill(day(-60));
  await p.getByRole('textbox', { name: 'Original gravity' }).fill('1.110');
  await p.locator('select:has(option[value=aging])').first().selectOption('aging');
  await p.getByRole('textbox', { name: 'Final gravity (optional)' }).fill('1.008');
  await p.getByRole('button', { name: /^(Start batch|Save batch|Add batch)$/ }).click(); await p.waitForSelector('.hero');
  const secs = await dividers();
  ok(secs[secs.length - 1].startsWith('Primary'), 'the oldest section is Primary: ' + secs.join(' | '));
  const primary = p.locator('.timeline-sections section', { has: p.locator('.stage-divider', { hasText: 'Primary' }) });
  const titles = (await primary.locator('.timeline-title').allTextContents()).join(' | ');
  ok(/Original gravity/.test(titles) && /Final/.test(titles), 'OG and FG are in Primary: ' + titles);
  await p.screenshot({ path: out + '/ogfg.png', fullPage: true });
  // Bottled batch with OG and FG; Fermaid O (Primary) and a pH reading on the start date stay in Primary.
  await p.goto(BASE + '/#/batches/new'); await p.waitForSelector('form');
  await p.getByRole('textbox', { name: 'Name' }).fill('Bottled mead'); await p.getByLabel('Start date').fill(day(-60));
  await p.getByRole('textbox', { name: 'Original gravity' }).fill('1.100');
  await p.locator('select:has(option[value=bottled])').first().selectOption('bottled');
  await p.getByRole('textbox', { name: 'Final gravity (optional)' }).fill('1.000');
  await p.getByRole('button', { name: /^(Start batch|Save batch|Add batch)$/ }).click(); await p.waitForSelector('.hero');
  const d = p.getByRole('dialog').last();
  await p.getByRole('button', { name: 'Add entry' }).click(); await d.waitFor();
  await d.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('ingredient'), exact: true }).click(); await sugarAs(p, 'ingredient');
  await d.getByRole('combobox', { name: 'Ingredient', exact: true }).fill('Fermaid O'); await d.getByLabel('Quantity').fill('2');
  await d.getByLabel('When').first().fill(day(-60) + 'T12:00');
  const addTo = d.getByRole('checkbox', { name: 'Add to batch ingredients' });
  if (await addTo.count()) { await addTo.check(); ok(await until(async () => (await d.getByRole('combobox', { name: 'Stage' }).inputValue() === 'primary')), 'Fermaid O defaults to Primary'); }
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  await p.getByRole('button', { name: 'Add entry' }).click(); await d.waitFor();
  await d.getByRole('radiogroup', { name: 'What happened?' }).getByRole('radio', { name: entryLabel('ph'), exact: true }).click(); await sugarAs(p, 'ph');
  await d.getByRole('textbox', { name: /pH/ }).first().fill('3.6');
  await d.getByLabel('When').first().fill(day(-60) + 'T13:00');
  await d.getByRole('button', { name: 'Save entry' }).click(); await d.waitFor({ state: 'detached' });
  const bs = await dividers();
  ok(JSON.stringify(bs) === JSON.stringify(['Primary']), 'no Bottled section between OG and FG: ' + bs.join(' | '));
  await p.screenshot({ path: out + '/bottled-sections.png', fullPage: true });

  // Winter Spice sample: Primary (OG, readings, FG), then Secondary, then Aging, with no back-and-forth.
  const p2 = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p2.goto(BASE + '/'); await p2.waitForSelector('.empty');
  await p2.getByRole('button', { name: 'Load sample data' }).click(); await p2.waitForSelector('.shelf-item');
  await p2.getByText('Winter Spice').first().click(); await p2.waitForSelector('.hero');
  const ws = await p2.locator('.timeline-sections .stage-divider').evaluateAll((hs) => hs.map((h) => h.textContent.replace(/Now$/, '').trim()));
  ok(JSON.stringify(ws) === JSON.stringify(['Aging', 'Secondary', 'Primary']), 'Winter Spice sections: ' + ws.join(' | '));
  const wsPrimary = (await p2.locator('.timeline-sections section', { has: p2.locator('.stage-divider', { hasText: 'Primary' }) }).locator('.timeline-title').allTextContents()).join(' | ');
  ok(/Final/.test(wsPrimary) && /OG/.test(wsPrimary) && !/Racked/.test(wsPrimary), 'its OG and FG are in Primary, Racked is not: ' + wsPrimary);
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
