# BrewHive

*From first pitch to final gravity.*

BrewHive is an open source, private-by-default brew log that makes tracking brews fun to look at and easy to start. It is built for mead first, with room for cider, wine, beer and kombucha. Your data stays on your device: there is no account, no server and no tracking.

This is **v0.1**, the first milestone of the [project plan](#roadmap): a complete local brew log that installs as an app from the browser.

## What it does today

- **Batches.** Track each batch from Planned through Primary, Secondary, Aging and Bottled. Log gravity readings, nutrients, racking, tastings and notes on a timeline. See live ABV and a gravity chart.
- **Recipes.** Save ingredients, steps and target gravities, then start a new batch from a recipe with one tap.
- **Cellar.** Bottling a batch adds it to the cellar. Log each bottle you drink, gift or enter in a competition, and see what is ready to drink.
- **Shelf view.** Every collection can be shown as a list or as a shelf: carboys for batches, books for recipes and bottles for the cellar. Carboys bubble while a batch is in primary.
- **Icons and ratings.** Give anything one of 30 flavor icons and a 0 to 10 rating. Ratings show as a badge above each item, and every list can be sorted by rating.
- **Backup.** Save everything to one JSON file and restore it on any device.
- **Works offline.** After the first visit the app loads without a connection, and it can be installed to the home screen on iOS, Android and desktop.
- **Light and dark themes**, gallons or liters, °F or °C.

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
| `npm test` | Runs the unit tests for the brewing math |
| `npm run typecheck` | Checks the TypeScript types |

## Put it online

BrewHive is a static site. `npm run build` produces a `dist` folder that any web server can host.

**GitHub Pages.** This repo includes a workflow that builds and publishes on every push to `main`. Turn it on once under *Settings > Pages > Build and deployment > Source: GitHub Actions*. To use a custom domain such as `brewhive.app`, add it on the same settings page.

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
    types.ts        The data model (recipes, batches, events, cellar, pours)
    idb.ts          Small wrapper around the browser's IndexedDB
    store.ts        The data API the screens use, plus live-updating hooks
    backup.ts       JSON backup and restore
    sample.ts       Sample data
  lib/
    calc.ts         Brewing math (ABV, Brix, unit conversions), with tests
    batch.ts        Numbers derived from a batch and its timeline
    format.ts       Dates, units and number formatting
    router.tsx      Tiny hash router
    theme.ts        Applies the light / dark theme
    demo.ts         Demo mode switch for hosted previews
  icons/            Flavor icons and interface icons, all inline SVG
  components/       Shelf, carboy / book / bottle artwork, forms, sheets, chart
  screens/          Batches, Recipes, Cellar, More
public/
  sw.js             Service worker for offline use
  manifest.webmanifest, icons
```

The app has only two runtime dependencies, React and React DOM. Volumes are stored in liters, temperatures in °C and gravity as SG; the screens convert to the units chosen in Settings.

## Roadmap

| Version | Focus |
| --- | --- |
| **v0.1 (this release)** | Local PWA: recipes, batches, timeline, cellar, shelf views, icons, ratings, backup |
| v0.2 | Ingredient library: categories, default units, costs and batch totals |
| v0.3 | Equipment screen (vessels and ingredient inventory), calculators, photos, reminders, Simple / Advanced mode |
| v0.4 | iOS and Android apps with Capacitor |
| v0.5 | Optional sync through a self-hosted server |
| v0.6 | Community recipes on Nostr, with zaps |
| Later | Smart hydrometers, BeerXML import, printable labels |

## Contributing

Issues and pull requests are welcome. Please run `npm test` and `npm run typecheck` before opening a pull request.

## License

[MIT](LICENSE)
