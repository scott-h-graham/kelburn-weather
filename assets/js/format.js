// format.js — display helpers and weather-type metadata. No DOM state.

export const ordinal = (n) => {
  if (n == null) return '–'
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export const t1 = (v) => (v == null ? '–' : v.toFixed(1))
export const t0 = (v) => (v == null ? '–' : Math.round(v).toString())
export const degC = (v) => (v == null ? '–' : `${v.toFixed(1)}°`)
export const mm = (v) => (v == null ? '–' : `${v.toFixed(1)}`)
export const pct = (v) => (v == null ? '–' : `${Math.round(v)}%`)

// Weather types ordered calm -> grim. `tone` maps to a CSS colour token (--wt-*),
// so the charts recolour automatically with the theme. `heat`/`cold` are the two specials.
export const TYPE_ORDER = ['Taps Aff', 'Pleasant', 'Grey', 'Drizzle', 'Blustery', 'Baltic', 'Dreich', 'Biblical']
export const TYPE_META = {
  'Taps Aff': { token: '--wt-heat', blurb: 'top off, genuinely warm' },
  Pleasant: { token: '--wt-good', blurb: 'mild, dry-ish, some sun' },
  Grey: { token: '--wt-grey', blurb: 'overcast, mostly dry' },
  Drizzle: { token: '--wt-drizzle', blurb: 'persistent light rain' },
  Blustery: { token: '--wt-wind', blurb: 'gusts over 58 km/h' },
  Baltic: { token: '--wt-cold', blurb: 'high under 12.5°C' },
  Dreich: { token: '--wt-dreich', blurb: 'grey, damp, miserable' },
  Biblical: { token: '--wt-biblical', blurb: 'over 25 mm of rain' },
}
export const typeVar = (type) => (TYPE_META[type] ? `var(${TYPE_META[type].token})` : 'var(--ink-2)')
// short codes so the day-grid is readable without relying on colour alone
export const TYPE_CODE = { 'Taps Aff': 'TA', Pleasant: 'Pl', Grey: 'Gy', Drizzle: 'Dz', Blustery: 'Bl', Baltic: 'Ba', Dreich: 'Dr', Biblical: 'Bi' }

export const WEEKDAY_FULL = { Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday', Mon: 'Monday' }
export const ROLE_LABEL = { thursday: 'bolt-on', core: 'festival', monday: 'teardown' }

// pretty date: "2023-07-01" -> "Sat 1 Jul 2023"
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function niceDate(dateStr, withYear = true) {
  const [y, m, d] = dateStr.split('-')
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(dateStr + 'T12:00:00Z').getUTCDay()]
  return `${wd} ${+d} ${MON[+m - 1]}${withYear ? ' ' + y : ''}`
}
