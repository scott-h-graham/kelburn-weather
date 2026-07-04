# Kelburn WX

A wee dashboard of the weather at every **Kelburn Garden Party** (Kelburn Castle, Fairlie, Ayrshire) from 2009 to 2026 — for the folk who keep going back and keep getting rained on.

**Live:** https://scott-h-graham.github.io/kelburn-weather/

## The short version

It is grim in absolute terms (avg daytime high ~16°C, ~70% cloud), but it is **not** specially cursed: the Kelburn weekend lands around the *median* weekend of the summer — a hair drier and cooler than a random weekend that year. The problem was never the festival. The problem is July in Ayrshire.

## How it's built

- **No build step, no framework, no runtime dependencies.** Plain HTML + CSS + ES-module JS. To run locally: `python3 -m http.server` and open the printed URL.
- **Data** comes from the [Open-Meteo](https://open-meteo.com/) historical API (ERA5 reanalysis 2009–2025; forecast model for the in-progress 2026 edition). It is fetched once and committed as `assets/js/data.js`, so the page never calls the network.
- All metrics recompute **in the browser** from the current filter (which years, and whether Thursday counts), so the whole dashboard is reactive.

## Layout

```
index.html                 markup + terse copy
assets/css/styles.css      design system, dual-theme, mobile-first
assets/js/
  data.js                  generated dataset (do not hand-edit)
  metrics.js               pure analysis (unit-testable in Node)
  charts.js                hand-built inline-SVG charts
  format.js                display + weather-type helpers
  main.js                  loads data, wires filters, renders
scripts/
  editions.json            authoritative, weekday-validated festival dates
  build-data.mjs           fetch + derive -> data.js and data/kelburn.json
  smoke.mjs                headless render test
  inline.mjs               single-file build (for previews)
```

## Refreshing the data

```
npm run build-data      # re-fetch weather, regenerate data.js + data/kelburn.json
node scripts/smoke.mjs  # sanity-check the render path
```

Re-run after the 2026 edition finishes to swap its provisional forecast figures for the final reanalysis.

## Changing the code

After editing any CSS/JS, bump `version` in `package.json` and run `node scripts/stamp.mjs`. That stamps `?v=<version>` onto the asset URLs and module imports so returning visitors get the new files instead of a stale browser cache.

## Caveats

The figures are the nearest ERA5 grid cell (~25 km, coastal) — regional, not a gauge in the field. Sunshine-hours are omitted because ERA5 over-counts them; cloud cover and solar energy are shown instead. Weather-type cut-offs (Taps Aff ≥22°C, Biblical ≥25 mm, Baltic ≤12.5°C, …) are blunt instruments for a laugh, not the Met Office.
