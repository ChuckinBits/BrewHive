# Browser checks

Each `.cjs` file here drives the built app in headless Chromium, through a real flow (start a
batch, log an ingredient, move a stage, restore a backup…), and asserts what should happen.
A check prints `ok  …` for each thing it confirms and exits non-zero on the first that fails.

They run on every pull request (the `browser` job in `.github/workflows/ci.yml`).

## Running them

```sh
npm ci
npx playwright install chromium   # once
npm run build
npm run checks                     # all of them, against `vite preview` on port 4173
npm run checks -- stagefwd v024grid   # just these
npm run checks -- --jobs=4         # more at once (default 2)
```

To check a server you already run, such as `npm run dev`, set `BREWHIVE_URL`:

```sh
BREWHIVE_URL=http://localhost:5173 npm run checks
```

Assertions that read the page wait for their condition (up to 5 seconds, or `CHECK_WAIT`
milliseconds), since the page can lag a moment behind a click or a save on a slow machine.
A failing check runs once more. If it passes then, it's reported as **flaky**: usually the
check read the page a moment too early, and it should wait for what it expects instead.
Screenshots land in `checks/.shots/` (not committed); CI keeps them when a run fails.

## What they cover

Most are named after the issue or release they were written for:

| Check | Covers |
| --- | --- |
| `smoke` | A tour of every screen with the sample data |
| `issue3` … `issue44` | The issue of that number |
| `pr11` | Ingredient units and stage hints (PR 11) |
| `v022`, `v023`, `v024grid` | The v0.2.2, v0.2.3 and v0.2.4 changes |
| `bottled`, `resweet`, `targetsweet` | Bottling, backsweetening, sweetness |
| `stageat`, `stagefwd`, `ogfgprimary`, `logstages` | Timeline stages and logging ingredients |
| `unitsetting`, `unitsfollow`, `starters`, `catorder`, `picknote`, `nopitch` | Settings and the ingredient library |
| `listmemory` | Lists remembering their search and filters |
| `csp` | No Content-Security-Policy violations on any screen |
| `fonts` | Inter and Bricolage Grotesque load from the app itself |
| `badbackup` | A damaged backup restores its good records and skips the rest |

New features get a check here, in the same style.
