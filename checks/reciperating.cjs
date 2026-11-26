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
// A recipe saved from a batch starts with its rating; Update recipe brings a new batch rating over; a batch
// started from a recipe starts unrated, and an unrated batch leaves the recipe's rating alone.
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  const cardRating = async () => (await p.locator('.rating-card .rating').getAttribute('aria-label').catch(() => null)) ?? 'unrated';
  const rate = async (v) => {
    await p.locator('.rating-card').getByRole('button', { name: /^(Rate|Change)$/ }).click();
    await p.getByRole('dialog').getByRole('slider', { name: 'Rating' }).fill(String(v));
    await p.getByRole('dialog').getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(400);
  };
  await p.goto(BASE + '/'); await p.getByRole('button', { name: 'Load sample data' }).click(); await p.waitForSelector('.shelf-item');
  await p.getByRole('button', { name: /^All/ }).click(); await p.getByRole('link', { name: /Winter Spice/ }).first().click(); await p.waitForSelector('.hero');
  const batchUrl = p.url();
  const start = await cardRating();
  ok(start.startsWith('Rated '), 'Winter Spice is rated: ' + start);

  // 1. Save as recipe: the recipe starts with the batch's rating
  await p.getByRole('button', { name: 'Save as recipe' }).click();
  ok(await until(async () => (await p.getByText(/icon, color and rating as a recipe/).count() === 1)), 'the save sheet says the rating comes along');
  await p.getByRole('button', { name: 'Save recipe' }).click(); await p.waitForURL(/#\/recipes\//); await p.waitForSelector('.rating-card');
  const recipeUrl = p.url();
  ok(await until(async () => (await cardRating() === start)), 'the new recipe has the batch\'s rating: ' + start);

  // 2. Rate the batch 9, then Update recipe lists the rating and applies it
  await p.goto(batchUrl); await p.waitForSelector('.hero');
  await rate(9);
  await p.getByRole('button', { name: 'Update recipe' }).click();
  const changes = await p.locator('.change-list li').allTextContents();
  ok(changes.includes(`Rating ${start.match(/Rated (\S+)/)[1]} → 9`), 'the update lists the rating change: ' + changes.join(' | '));
  ok(await until(async () => (await p.getByText("The recipe's name, notes and steps stay as they are.").count() === 1)), 'and says name, notes and steps stay');
  await p.screenshot({ path: `${process.argv[2] || '/tmp'}/recipe-rating-update.png` });
  await p.getByRole('dialog').getByRole('button', { name: 'Update recipe' }).click(); await p.waitForTimeout(400);
  await p.goto(recipeUrl); await p.waitForSelector('.rating-card');
  ok(await until(async () => (await cardRating() === 'Rated 9 out of 10')), 'the recipe is now rated 9');

  // 3. A batch started from the recipe starts unrated
  await p.getByRole('link', { name: 'Start a batch' }).click(); await p.waitForSelector('form');
  await p.getByLabel('Name').fill('Winter Spice #2'); await p.getByRole('button', { name: 'Start batch' }).click(); await p.waitForSelector('.hero');
  ok(await until(async () => (await cardRating() === 'unrated' && await p.locator('.rating-card').getByText('Not rated').count() === 1)), 'a batch started from the recipe is not rated');

  // 4. Updating the recipe from that unrated batch keeps the recipe's 9
  await p.getByRole('link', { name: 'Edit batch' }).click(); await p.getByLabel(/^Original gravity/).fill('1.111');
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForSelector('.hero');
  await p.getByRole('button', { name: 'Update recipe' }).click();
  const changes2 = await p.locator('.change-list li').allTextContents();
  ok(!changes2.some(c => c.startsWith('Rating')), 'an unrated batch lists no rating change: ' + changes2.join(' | '));
  ok(await until(async () => (await p.getByText(/and so does its rating, since this batch isn't rated/).count() === 1)), 'and says the recipe keeps its rating');
  await p.getByRole('dialog').getByRole('button', { name: 'Update recipe' }).click(); await p.waitForTimeout(400);
  await p.goto(recipeUrl); await p.waitForSelector('.rating-card');
  ok(await until(async () => (await cardRating() === 'Rated 9 out of 10' && (await p.locator('.stat-value').first().textContent()) === '1.111')), 'the recipe took OG 1.111 and kept its 9');
  ok(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
