#!/usr/bin/env node
// Runs the browser checks: each file in this folder drives the built app in headless Chromium
// and exits non-zero when something it expects doesn't happen.
//
//   npm run build && npm run checks            every check, against `vite preview`
//   npm run checks -- stagefwd logstages       just these
//   BREWHIVE_URL=http://localhost:5173 npm run checks   against a server you already run
//
// A check that fails is run once more: passing the second time marks it flaky (a timing
// problem in the check, worth fixing) rather than failed. Screenshots go to checks/.shots.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const here = __dirname;
const root = path.dirname(here);
const shots = path.join(here, '.shots');
const args = process.argv.slice(2);
const jobsArg = args.find((a) => a.startsWith('--jobs='));
const jobs = Math.max(1, Number(jobsArg ? jobsArg.slice(7) : process.env.CHECK_JOBS || 2));
const only = args.filter((a) => !a.startsWith('--'));
const TIMEOUT_MS = 240_000;

const all = fs
  .readdirSync(here)
  .filter((f) => f.endsWith('.cjs') && f !== 'run.cjs')
  .map((f) => f.replace(/\.cjs$/, ''))
  .sort();
const unknown = only.filter((name) => !all.includes(name));
if (unknown.length) {
  console.error(`No such check: ${unknown.join(', ')}. Checks: ${all.join(', ')}`);
  process.exit(2);
}
const names = only.length ? only : all;

const reachable = (url) =>
  new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode !== undefined && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });

async function startPreview() {
  if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
    console.error('No build to check: run `npm run build` first, or set BREWHIVE_URL to a running server.');
    process.exit(2);
  }
  const vite = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
  const server = spawn(vite, ['preview', '--port', '4173', '--strictPort'], { cwd: root, stdio: 'ignore', shell: process.platform === 'win32' });
  for (let i = 0; i < 60; i++) {
    if (await reachable('http://localhost:4173/')) return server;
    await new Promise((r) => setTimeout(r, 500));
  }
  server.kill();
  console.error('vite preview did not start on port 4173.');
  process.exit(2);
}

function runOne(name, url) {
  return new Promise((resolve) => {
    const started = Date.now();
    let output = '';
    const child = spawn(process.execPath, [path.join(here, `${name}.cjs`), shots], {
      cwd: root,
      env: { ...process.env, BREWHIVE_URL: url },
    });
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    const timer = setTimeout(() => {
      output += `\nTimed out after ${TIMEOUT_MS / 1000}s.`;
      child.kill('SIGKILL');
    }, TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      const passes = (output.match(/^ok /gm) || []).length;
      resolve({ name, ok: code === 0, output, passes, seconds: Math.round((Date.now() - started) / 1000) });
    });
  });
}

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const url = (process.env.BREWHIVE_URL || 'http://localhost:4173').replace(/\/$/, '');
  const server = process.env.BREWHIVE_URL ? null : await startPreview();
  if (server) process.on('exit', () => server.kill());
  if (!(await reachable(url + '/'))) {
    console.error(`Nothing is answering at ${url}.`);
    process.exit(2);
  }

  console.log(`Running ${names.length} checks against ${url}, ${jobs} at a time.\n`);
  const results = [];
  const queue = [...names];
  const worker = async () => {
    for (let name = queue.shift(); name; name = queue.shift()) {
      let result = await runOne(name, url);
      if (!result.ok) {
        const retry = await runOne(name, url);
        result = retry.ok ? { ...retry, flaky: true, firstOutput: result.output } : result;
      }
      const mark = result.ok ? (result.flaky ? 'FLAKY' : 'pass ') : 'FAIL ';
      console.log(`${mark} ${name.padEnd(14)} ${String(result.passes).padStart(3)} assertions  ${result.seconds}s`);
      results.push(result);
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, names.length) }, worker));

  const failed = results.filter((r) => !r.ok);
  const flaky = results.filter((r) => r.flaky);
  for (const r of flaky) console.log(`\n--- ${r.name} failed once, then passed. First run:\n${r.firstOutput.trim().split('\n').slice(-6).join('\n')}`);
  for (const r of failed) console.log(`\n--- ${r.name} failed twice. Output:\n${r.output.trim().split('\n').slice(-15).join('\n')}`);
  const total = results.reduce((n, r) => n + r.passes, 0);
  console.log(`\n${results.length - failed.length} of ${results.length} checks passed (${total} assertions)${flaky.length ? `, ${flaky.length} flaky` : ''}.`);
  if (server) server.kill();
  process.exit(failed.length ? 1 : 0);
})();
