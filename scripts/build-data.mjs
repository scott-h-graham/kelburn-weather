// Kelburn Garden Party — weather data pipeline.
// Node 20+, zero dependencies (uses built-in fetch). Run: node scripts/build-data.mjs
// Fetches daily weather for the festival location across each edition's summer window,
// derives per-day fields (sunshine fraction, day role, weather type), and writes:
//   data/kelburn.json        — full dataset (human-inspectable)
//   assets/js/data.js        — ES module `export const KELBURN = {...}` (loaded by the site; no fetch needed)

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const cfg = JSON.parse(readFileSync(join(__dirname, 'editions.json'), 'utf8'))
const { lat, lon } = cfg.location

// Daily variables to pull. Same names work on both the archive (ERA5) and forecast endpoints.
const DAILY = [
  'temperature_2m_max', 'temperature_2m_min', 'temperature_2m_mean',
  'apparent_temperature_max', 'apparent_temperature_min',
  'precipitation_sum', 'rain_sum', 'precipitation_hours',
  'windspeed_10m_max', 'windgusts_10m_max', 'winddirection_10m_dominant',
  'shortwave_radiation_sum', 'sunshine_duration', 'daylight_duration', 'cloud_cover_mean',
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const round = (v, n = 1) => (v == null || Number.isNaN(v) ? null : Math.round(v * 10 ** n) / 10 ** n)

function weekday(dateStr) {
  return WEEKDAYS[new Date(dateStr + 'T12:00:00Z').getUTCDay()]
}

// Fri/Sat/Sun = the real festival ('core'); Thursday = bolt-on; Monday = teardown.
function roleFor(dateStr) {
  const wd = weekday(dateStr)
  if (wd === 'Thu') return 'thursday'
  if (wd === 'Mon') return 'monday'
  return 'core' // Fri, Sat, Sun (every edition falls within Thu..Mon)
}

// Deadpan Scots weather taxonomy. Thresholds are deliberately simple and documented on the page.
function weatherType({ tmax, rain, precipHours, gust, cloud, sunFrac }) {
  if (tmax != null && tmax >= 22) return 'Taps Aff'
  if (rain != null && rain >= 25) return 'Biblical'
  if (gust != null && gust >= 58) return 'Blustery'
  if (tmax != null && tmax <= 12.5) return 'Baltic'
  if (cloud != null && cloud >= 80 && rain != null && rain >= 2) return 'Dreich'
  if (rain != null && rain >= 1 && precipHours != null && precipHours >= 8) return 'Drizzle'
  if (rain != null && rain >= 8) return 'Dreich'
  if (cloud != null && cloud >= 68) return 'Grey'
  return 'Pleasant'
}

async function fetchYear(year, provisional) {
  const host = provisional ? 'https://api.open-meteo.com/v1/forecast' : 'https://archive-api.open-meteo.com/v1/archive'
  const start = `${year}-05-20`
  let end = `${year}-08-31`
  if (provisional) {
    // Forecast endpoint only serves up to ~today+15; clamp so the request is valid.
    const cap = new Date(Date.now() + 13 * 864e5).toISOString().slice(0, 10)
    if (cap < end) end = cap
  }
  const url = `${host}?latitude=${lat}&longitude=${lon}` +
    `&start_date=${start}&end_date=${end}` +
    `&daily=${DAILY.join(',')}` +
    `&timezone=Europe%2FLondon&cell_selection=land`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${year}: HTTP ${res.status} ${await res.text()}`)
  const j = await res.json()
  return j
}

function buildDays(api) {
  const d = api.daily
  const out = []
  for (let i = 0; i < d.time.length; i++) {
    const date = d.time[i]
    const sunSec = d.sunshine_duration?.[i]
    const dayLen = d.daylight_duration?.[i]
    const tmax = round(d.temperature_2m_max?.[i])
    const tmin = round(d.temperature_2m_min?.[i])
    const rain = round(d.precipitation_sum?.[i])
    if (tmax == null && rain == null) continue // skip empty days (e.g. beyond forecast horizon)
    const precipHours = round(d.precipitation_hours?.[i], 0)
    const gust = round(d.windgusts_10m_max?.[i])
    const cloud = round(d.cloud_cover_mean?.[i], 0)
    const sunFrac = sunSec != null && dayLen ? round((sunSec / dayLen) * 100, 0) : null
    const day = {
      date,
      weekday: weekday(date),
      role: roleFor(date),
      tmax,
      tmin,
      tmean: round(d.temperature_2m_mean?.[i]),
      appMax: round(d.apparent_temperature_max?.[i]),
      appMin: round(d.apparent_temperature_min?.[i]),
      rain,
      rainSum: round(d.rain_sum?.[i]),
      precipHours,
      windMax: round(d.windspeed_10m_max?.[i]),
      gust,
      windDir: round(d.winddirection_10m_dominant?.[i], 0),
      solarMJ: round(d.shortwave_radiation_sum?.[i]),
      sunHours: sunSec != null ? round(sunSec / 3600) : null,
      sunFrac,
      cloud,
    }
    day.type = weatherType(day)
    out.push(day)
  }
  return out
}

function inRange(date, start, end) {
  return date >= start && date <= end
}

async function main() {
  const editions = []
  const summers = {}
  for (const ed of cfg.editions) {
    process.stdout.write(`Fetching ${ed.year} (${ed.provisional ? 'forecast/provisional' : 'ERA5 archive'})... `)
    const api = await fetchYear(ed.year, ed.provisional)
    const allDays = buildDays(api)
    summers[ed.year] = allDays
    const festDays = allDays.filter((d) => inRange(d.date, ed.start, ed.end))
    editions.push({
      year: ed.year,
      start: ed.start,
      end: ed.end,
      pattern: ed.pattern,
      confidence: ed.confidence,
      provisional: !!ed.provisional,
      sources: ed.sources,
      cellLat: api.latitude,
      cellLon: api.longitude,
      days: festDays,
    })
    console.log(`${allDays.length} summer days, ${festDays.length} festival days`)
    await sleep(400)
  }

  const sample = editions[0]
  const dataset = {
    meta: {
      location: cfg.location.name,
      lat,
      lon,
      cell: { lat: sample.cellLat, lon: sample.cellLon },
      timezone: 'Europe/London',
      source: 'Open-Meteo — ERA5 reanalysis (archive) for 2009-2025; forecast model for the in-progress 2026 edition',
      resolutionNote: 'Nearest reanalysis grid cell (~25 km, coastal). Regional, not a pinpoint castle-grounds gauge.',
      typeThresholds: 'Taps Aff >=22C; Biblical rain >=25mm; Blustery gust >=58km/h; Baltic max <=12.5C; Dreich cloud>=80% & rain>=2mm (or rain>=8mm); Drizzle rain>=1mm & >=8 wet hours; Grey cloud>=68%; else Pleasant',
      generated: new Date().toISOString().slice(0, 10),
      cancelled: cfg.cancelled,
    },
    editions,
    summers,
  }

  writeFileSync(join(ROOT, 'data', 'kelburn.json'), JSON.stringify(dataset, null, 0))
  const js = `// Auto-generated by scripts/build-data.mjs — do not edit by hand.\nexport const KELBURN = ${JSON.stringify(dataset)};\n`
  writeFileSync(join(ROOT, 'assets', 'js', 'data.js'), js)
  console.log('\nWrote data/kelburn.json and assets/js/data.js')
  console.log(`Editions: ${editions.length}. Total festival days: ${editions.reduce((a, e) => a + e.days.length, 0)}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
