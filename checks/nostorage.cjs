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
// Storage that never answers used to leave a blank page for good. Now BrewHive says so, with the browser's reason.
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  // indexedDB.open hands back a request that never succeeds or fails.
  await ctx.addInitScript(() => { indexedDB.open = () => ({}); });
  const p = await ctx.newPage();
  await p.goto(BASE + '/');
  ok(await until(async () => (await p.locator('#root').innerHTML()) === '', 2000), 'while storage is quiet, nothing is drawn yet');
  ok(await until(async () => (await p.getByRole('alert').getByText("BrewHive couldn't open its data").count() === 1), 15000), "after the wait it says BrewHive couldn't open its data");
  ok(await until(async () => (await p.getByText(/storage didn't answer while opening BrewHive \(waited 10 seconds\)/).count() === 1)), 'with the reason');
  ok(await until(async () => (await p.getByText(/close the others and reload, or quit the browser completely/).count() === 1)), 'with what usually fixes it: close other BrewHive tabs, or restart the browser');
  ok(await until(async () => (await p.getByRole('button', { name: 'Reload' }).count() === 1)), 'and a Reload button');
  ok(await until(async () => (await p.getByRole('button', { name: 'Start the preview over' }).count() === 0)), 'starting over is only offered in a hosted preview');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
