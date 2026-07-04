// metrics.js — pure, DOM-free analysis of the Kelburn dataset.
// Everything recomputes from the current selection (which years, and whether Thursday counts),
// so the whole page reacts to the filters. Monday (teardown) is NEVER part of the main metrics;
// it only feeds the pack-up desk.

// ---- small date helpers (UTC, no timezone surprises) ----
const DAY_MS = 86400000
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z')
  return new Date(d.getTime() + n * DAY_MS).toISOString().slice(0, 10)
}
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const sum = (xs) => xs.reduce((a, b) => a + (b || 0), 0)
const maxBy = (xs, f) => xs.reduce((best, x) => (best == null || f(x) > f(best) ? x : best), null)
const minBy = (xs, f) => xs.reduce((best, x) => (best == null || f(x) < f(best) ? x : best), null)
const defined = (v) => v != null && !Number.isNaN(v)

// Weekday offsets measured from the festival's Saturday. Monday (+2) is excluded from the core.
const OFFSET_FROM_SAT = { Thu: -2, Fri: -1, Sat: 0, Sun: 1 }

// ---- day-set selection ----
// The "core" is Fri/Sat/Sun. Thursday folds in only when includeThursday is on.
export function coreDays(edition, includeThursday) {
  return edition.days.filter((d) => d.role === 'core' || (includeThursday && d.role === 'thursday'))
}
export function mondayDays(edition) {
  return edition.days.filter((d) => d.role === 'monday')
}

// A per-day "misery" score — higher is grimmer. Used for best/grimmest day and the Curse ranking.
// Plain, explainable weighting; documented in the methodology section.
export function misery(d) {
  return (
    0.5 * (d.rain || 0) +
    0.4 * (d.precipHours || 0) +
    0.12 * (d.cloud || 0) +
    1.4 * Math.max(0, 16 - (d.tmax ?? 16)) +
    0.08 * (d.gust || 0) -
    0.1 * (d.sunFrac || 0)
  )
}

// ---- per-edition rollup over its selected day-set ----
export function editionStats(edition, includeThursday) {
  const days = coreDays(edition, includeThursday)
  if (!days.length) return null
  const tmaxes = days.map((d) => d.tmax).filter(defined)
  const tmins = days.map((d) => d.tmin).filter(defined)
  const clouds = days.map((d) => d.cloud).filter(defined)
  const sunfracs = days.map((d) => d.sunFrac).filter(defined)
  return {
    year: edition.year,
    provisional: edition.provisional,
    pattern: edition.pattern,
    dates: edition.start === edition.end ? edition.start : `${edition.start} → ${edition.end}`,
    days,
    nDays: days.length,
    rainTotal: sum(days.map((d) => d.rain)),
    rainHours: sum(days.map((d) => d.precipHours)),
    sunHours: sum(days.map((d) => d.sunHours)),
    solarMJ: sum(days.map((d) => d.solarMJ)),
    tmaxAvg: mean(tmaxes),
    tmaxPeak: tmaxes.length ? Math.max(...tmaxes) : null,
    tminMin: tmins.length ? Math.min(...tmins) : null,
    cloudAvg: mean(clouds),
    sunFracAvg: mean(sunfracs),
    gustPeak: Math.max(...days.map((d) => d.gust || 0)),
    miseryAvg: mean(days.map(misery)),
    typeCounts: countTypes(days),
  }
}

export function countTypes(days) {
  const c = {}
  for (const d of days) c[d.type] = (c[d.type] || 0) + 1
  return c
}

// ---- summer-weekend ranking ----
// For a given year, treat every Saturday in Jun–Aug as the anchor of a "weekend" of the same
// weekday-shape as the festival, and rank the festival's weekend among them.
function summerWeekends(summerDays, weekdays, year) {
  const byDate = new Map(summerDays.map((d) => [d.date, d]))
  const lo = `${year}-06-01`, hi = `${year}-08-31`
  const out = []
  for (const d of summerDays) {
    if (d.weekday !== 'Sat') continue
    if (d.date < lo || d.date > hi) continue
    const members = []
    let ok = true
    for (const wd of weekdays) {
      const day = byDate.get(addDays(d.date, OFFSET_FROM_SAT[wd]))
      if (!day) { ok = false; break }
      members.push(day)
    }
    if (!ok) continue
    out.push({
      sat: d.date,
      rain: sum(members.map((m) => m.rain)),
      tmaxAvg: mean(members.map((m) => m.tmax).filter(defined)),
      sunFracAvg: mean(members.map((m) => m.sunFrac).filter(defined)),
      gustPeak: Math.max(...members.map((m) => m.gust || 0)),
    })
  }
  return out
}

// rank of `value` in `arr` sorted so that "1st" is the extreme we care about.
function rankOf(arr, value, dir) {
  // dir 'desc' → biggest is 1st (wettest, windiest). 'asc' → smallest is 1st (coldest, least sunny).
  const sorted = [...arr].sort((a, b) => (dir === 'desc' ? b - a : a - b))
  // 1-based rank; ties share the better rank
  let rank = 1
  for (const v of sorted) {
    if (dir === 'desc' ? v > value + 1e-9 : v < value - 1e-9) rank++
  }
  return rank
}

export function editionRanking(edition, summerDays, includeThursday) {
  if (edition.provisional) return null // partial summer — not comparable
  const days = coreDays(edition, includeThursday)
  const weekdays = [...new Set(days.map((d) => d.weekday))].filter((w) => w in OFFSET_FROM_SAT)
  const wkds = summerWeekends(summerDays, weekdays, edition.year)
  if (wkds.length < 3) return null
  const satDate = (days.find((d) => d.weekday === 'Sat') || {}).date
  const self = wkds.find((w) => w.sat === satDate) || {
    rain: sum(days.map((d) => d.rain)),
    tmaxAvg: mean(days.map((d) => d.tmax).filter(defined)),
    sunFracAvg: mean(days.map((d) => d.sunFrac).filter(defined)),
    gustPeak: Math.max(...days.map((d) => d.gust || 0)),
  }
  const rains = wkds.map((w) => w.rain)
  const temps = wkds.map((w) => w.tmaxAvg)
  const suns = wkds.map((w) => w.sunFracAvg)
  const gusts = wkds.map((w) => w.gustPeak)
  return {
    year: edition.year,
    nWeekends: wkds.length,
    wettest: rankOf(rains, self.rain, 'desc'),
    coldest: rankOf(temps, self.tmaxAvg, 'asc'),
    leastSunny: rankOf(suns, self.sunFracAvg, 'asc'),
    windiest: rankOf(gusts, self.gustPeak, 'desc'),
    // anomalies vs a typical summer weekend that year
    rainAnom: self.rain / days.length - mean(rains) / mean(wkds.map((w) => weekdays.length)),
    rainVsTypical: self.rain - mean(rains),
    tempVsTypical: self.tmaxAvg - mean(temps),
  }
}

// linear regression slope (per year) of y over x
function slope(points) {
  const n = points.length
  if (n < 2) return 0
  const mx = mean(points.map((p) => p[0]))
  const my = mean(points.map((p) => p[1]))
  let num = 0, den = 0
  for (const [x, y] of points) { num += (x - mx) * (y - my); den += (x - mx) ** 2 }
  return den === 0 ? 0 : num / den
}

// ---- the whole picture for a given selection ----
export function compute(KELBURN, selection) {
  const { years, includeThursday } = selection
  const editions = KELBURN.editions.filter((e) => years.has(e.year))
  const stats = editions.map((e) => editionStats(e, includeThursday)).filter(Boolean)
  const nonProv = stats.filter((s) => !s.provisional)

  // pooled core days across the selection
  const allDays = stats.flatMap((s) => s.days)
  const complete = stats.length ? stats : []

  // superlatives (single-day + edition-level)
  const wettestDay = maxBy(allDays, (d) => d.rain || 0)
  const hottestDay = maxBy(allDays, (d) => d.tmax ?? -99)
  const coldestDay = minBy(allDays, (d) => d.tmax ?? 99)
  const windiestDay = maxBy(allDays, (d) => d.gust || 0)
  const bestDay = minBy(allDays, misery)
  const grimmestDay = maxBy(allDays, misery)

  const wettestEd = maxBy(complete, (s) => s.rainTotal)
  const driestEd = minBy(complete, (s) => s.rainTotal)
  const sunniestEd = maxBy(complete, (s) => s.sunFracAvg ?? -1)
  const greyestEd = maxBy(complete, (s) => s.cloudAvg ?? -1)

  // rankings averaged across non-provisional selected editions
  const rankings = nonProv
    .map((s) => editionRanking(KELBURN.editions.find((e) => e.year === s.year), KELBURN.summers[s.year], includeThursday))
    .filter(Boolean)
  const avgRank = (k) => (rankings.length ? mean(rankings.map((r) => r[k])) : null)
  const nWeekends = rankings.length ? Math.round(mean(rankings.map((r) => r.nWeekends))) : null

  // taxonomy across pooled core days
  const typeCounts = countTypes(allDays)

  // day-of-festival: mean by weekday
  const byWeekday = {}
  for (const wd of ['Thu', 'Fri', 'Sat', 'Sun']) {
    const ds = allDays.filter((d) => d.weekday === wd)
    if (ds.length) byWeekday[wd] = { n: ds.length, rain: mean(ds.map((d) => d.rain)), tmax: mean(ds.map((d) => d.tmax).filter(defined)), cloud: mean(ds.map((d) => d.cloud).filter(defined)) }
  }

  // pack-up desk (Monday only, independent of Thursday toggle)
  const mondays = editions.flatMap((e) => mondayDays(e).map((d) => ({ ...d, year: e.year })))
  const worstMonday = maxBy(mondays, (d) => d.rain || 0)
  const packup = mondays.length
    ? { n: mondays.length, avgRain: mean(mondays.map((d) => d.rain)), avgCloud: mean(mondays.map((d) => d.cloud).filter(defined)), worst: worstMonday }
    : null

  // trends (non-provisional)
  const tempTrend = slope(nonProv.map((s) => [s.year, s.tmaxAvg]).filter((p) => defined(p[1])))
  const rainTrend = slope(nonProv.map((s) => [s.year, s.rainTotal]))

  // night — overnight lows, deliberately kept OUT of the headline metrics (own section)
  const SHIVER = 9
  const night = {
    nights: allDays.length,
    avgLow: mean(allDays.map((d) => d.tmin).filter(defined)),
    avgFeels: mean(allDays.map((d) => d.appMin).filter(defined)),
    coldest: minBy(allDays, (d) => d.tmin ?? 99),
    warmest: maxBy(allDays, (d) => d.tmin ?? -99),
    coldestFeels: minBy(allDays, (d) => d.appMin ?? 99),
    shiverThreshold: SHIVER,
    shiverNights: allDays.filter((d) => d.tmin != null && d.tmin <= SHIVER).length,
    perEdition: stats.map((s) => ({ year: s.year, provisional: s.provisional, avgLow: mean(s.days.map((d) => d.tmin).filter(defined)), coldest: s.tminMin })),
  }

  return {
    selection: { years: [...years].sort(), includeThursday },
    editionCount: stats.length,
    stats: stats.sort((a, b) => a.year - b.year),
    allTime: {
      avgWeekendRain: mean(stats.map((s) => s.rainTotal)),
      avgMaxTemp: mean(allDays.map((d) => d.tmax).filter(defined)),
      avgCloud: mean(allDays.map((d) => d.cloud).filter(defined)),
      avgSunFrac: mean(allDays.map((d) => d.sunFrac).filter(defined)),
      cumulativeRain: sum(stats.map((s) => s.rainTotal)),
      totalSunHours: sum(stats.map((s) => s.sunHours)),
    },
    ranks: {
      wettest: avgRank('wettest'),
      coldest: avgRank('coldest'),
      leastSunny: avgRank('leastSunny'),
      windiest: avgRank('windiest'),
      nWeekends,
      basedOn: rankings.length,
      rainVsTypical: rankings.length ? mean(rankings.map((r) => r.rainVsTypical)) : null,
      tempVsTypical: rankings.length ? mean(rankings.map((r) => r.tempVsTypical)) : null,
    },
    superlatives: {
      wettestDay, hottestDay, coldestDay, windiestDay, bestDay, grimmestDay,
      wettestEd, driestEd, sunniestEd, greyestEd,
    },
    typeCounts,
    tapsAffCount: typeCounts['Taps Aff'] || 0,
    perEditionRanks: rankings,
    byWeekday,
    packup,
    night,
    trends: { tempPerDecade: tempTrend * 10, rainPerDecade: rainTrend * 10, points: nonProv.map((s) => ({ year: s.year, tmaxAvg: s.tmaxAvg, rainTotal: s.rainTotal })) },
  }
}
