# BrewHive

*From first pitch to final gravity.*

BrewHive is an open source, private-by-default brew log that makes tracking brews fun to look at and easy to start. It is built for mead first, with room for cider, wine, beer and kombucha. Your data stays on your device: there is no account, no server and no tracking.

**Use it at [brewhive.app](https://brewhive.app).** It runs in any modern browser and can be installed to your home screen or desktop from there.

The latest release is **v0.3.1**: a complete local brew log that installs as an app from the browser, with an ingredient library, batch costs, your equipment, and batches you can rack into several vessels or split into sub-batches. The rest of **v0.3** adds ingredient inventory, calculators and more. See the [roadmap](#roadmap) and the [changelog](CHANGELOG.md).

## What it does today

- **Batches.** Track each batch from Planned through Primary, Secondary, Aging and Bottled, then archive it. Log gravity readings, ingredients, nutrients, step feeding, backsweetening, stabilizing, racking, tastings and notes on a timeline, divided by stage. See the ABV, a gravity chart and the points of sugar added.
- **Final gravity.** Moving a batch to Aging or bottling it asks for the final reading, which settles the ABV. No reading? Enter an estimated ABV instead.
- **Targets.** Aim for a final gravity or an ABV. Aiming for an ABV shows the gravity it finishes at, or how much more sugar it needs, and the batch page says when the target is reached.
- **Recipes.** Save ingredients by stage, steps and targets, then start a batch from a recipe with one tap. Save a batch as a recipe, and update the recipe as the batch evolves.
- **Ingredient library** *(v0.2)*. Your ingredients by category, with default units, a starter list of 100 mead-making ingredients, each with a note on what it does (honeys, fruit, sweeteners, spices, herbs, yeasts, nutrients, additives, tannins, malts and hops), and the recipes and batches that use each one. Pick from the list as you type when adding ingredients.
- **Costs** *(v0.2)*. Enter what you paid for an ingredient and see what each batch and recipe costs: the total, per 750 mL bottle and per gallon or liter.
- **Splitting batches** *(v0.3)*. Rack a batch into several vessels and keep it one batch, or split it into sub-batches that share its history and go their own way from there.
- **Equipment** *(v0.3)*. Your vessels (carboys, buckets, jugs, kegs, barrels) with their capacity, and the rest of your gear with notes and prices. Pick a vessel when you start a batch; moving to Secondary asks which vessel it was racked into, and the timeline records each move. See which vessels are free, and how much headspace a batch has.
- **Cellar.** Bottling a batch adds it to the cellar, in as many bottle sizes as you filled. Log each bottle you drink, gift or enter in a competition, and edit or remove pours.
- **Shelf view.** Every collection can be shown as a list or as a shelf: carboys for batches, books for recipes and archived batches, and bottles for the cellar. Carboys bubble while a batch is in primary.
- **Icons and ratings.** Give anything up to three of 30 flavor icons, any color, and a 0 to 10 rating. Picking an icon suggests a name and a style for the type of brew.
- **Backup.** Save everything to one JSON file and restore it on any device.
- **Works offline.** After the first visit the app loads without a connection, and it can be installed to the home screen on iOS, Android and desktop.
- **Light and dark themes**, gallons or liters and °F or °C (per batch too), and your currency.

## Run it on your computer

You need [Node.js](https://nodejs.org) 22.18 or newer.

```sh
npm install
npm run dev
```

Then open the address it prints (usually `http://localhost:5173`).

Other commands:

| Command | What it does |
| --- | --- |
| `npm run build` | Builds the app into the `dist` folder |
| `npm run preview` | Serves the built app locally, with offline support switched on |
| `npm test` | Runs the unit tests (brewing math, costs, ingredient library and more) |
| `npm run typecheck` | Checks the TypeScript types |
| `npm run checks` | Runs the browser checks against the built app (see [checks/README.md](checks/README.md)) |

## Put it online

BrewHive is a static site. `npm run build` produces a `dist` folder that any web server can host.

**GitHub Pages.** This repo includes a workflow that builds and publishes on every push to `main`; that's how [brewhive.app](https://brewhive.app) is served. Turn it on once under *Settings > Pages > Build and deployment > Source: GitHub Actions*. A custom domain is set on the same page (with GitHub Actions deployments no `CNAME` file is needed), and the domain's DNS points at GitHub Pages.

**Self-hosting.** Copy the contents of `dist` to any folder served over HTTPS (Caddy, nginx, Apache, a NAS). All paths are relative, so it works at a domain root or in a subfolder. HTTPS is required for offline support and installing to the home screen; `localhost` is the one exception.

## Privacy

- All data is stored in your browser's IndexedDB on your device.
- The app makes no network requests besides loading its own files.
- Clearing your browser's site data erases your brew log, so save a backup file now and then (*More > Save a backup file*).

## How the code is organized

```
src/
  main.tsx          Starts the app and registers the offline service worker
  App.tsx           Picks the screen for the current address, draws the tab bar
  styles.css        All styles; colors are tokens with light and dark values
  db/
    types.ts        The data model (recipes, batches, events, cellar, pours, ingredients)
    idb.ts          Small wrapper around the browser's IndexedDB
    store.ts        The data API the screens use, plus live-updating hooks
    actions.ts      Changes that touch several records (stage changes, archiving)
    backup.ts       JSON backup and restore
    sample.ts       Sample data
    starterIngredients.ts  The ingredients a new library starts with
  lib/              Logic with no screen, each with unit tests beside it
    calc.ts         Brewing math (ABV, Brix, unit conversions)
    batch.ts        Numbers derived from a batch and its timeline (ABV, targets)
    stages.ts       Ingredient stages and the timeline sections
    bottling.ts     Bottle sizes and counts
    cellar.ts       Cellar filters and the archive prompt
    cost.ts         Ingredient costs and currencies
    library.ts      Ingredient library search and categories
    recipeFromBatch.ts  Saving a batch as a recipe
    suggest.ts      Name and style suggestions from icons
    format.ts       Dates, units and number formatting
    router.tsx      Tiny hash router
    theme.ts        Applies the light / dark theme
    demo.ts         Demo mode switch for hosted previews
    version.ts      The app version
  icons/            Flavor icons and interface icons, all inline SVG
  components/       Shelf, carboy / book / bottle artwork, forms, sheets, chart, cost card
  screens/          Batches, Recipes, Cellar, Ingredients, More
public/
  sw.js             Service worker for offline use
  manifest.webmanifest, icons
```

The app has only two runtime dependencies, React and React DOM. Volumes are stored in liters, temperatures in °C and gravity as SG; the screens convert to the units chosen under More, or on each batch.

## Roadmap

| Version | Focus |
| --- | --- |
| **v0.1** (released) | Local PWA: recipes, batches, timeline, cellar, shelf views, icons, ratings, backup |
| **v0.2** (released, latest v0.2.9) | Ingredient library: categories, icons, 100 starter ingredients, costs and batch totals |
| **v0.3** (in progress, latest v0.3.1) | Equipment screen (vessels and gear, in v0.3.0), splitting batches across vessels (v0.3.1), ingredient inventory, calculators, photos, reminders, Simple / Advanced mode |
| v0.4 | iOS and Android apps with Capacitor |
| v0.5 | Optional sync through a self-hosted server |
| v0.6 | Community recipes on Nostr, with zaps |
| Later | Smart hydrometers, BeerXML import, printable labels |

## Contributing

Issues and pull requests are welcome. Please run `npm test`, `npm run typecheck` and `npm run checks` before opening a pull request; they also run on every pull request.

## License

[MIT](LICENSE)
