// charts.js — hand-built SVG. Every chart returns an SVG string sized by viewBox so it
// scales to its container (no fixed pixel widths -> nothing overflows on a phone).
// Colours come from CSS custom properties, so the charts follow the theme for free.
// Tooltip text lives in data-tip (plain text, newline-separated); main.js wires the hover.

import { typeVar, TYPE_CODE, niceDate, degC } from './format.js'

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const rainRamp = (mm) => `var(--rain-${mm >= 25 ? 4 : mm >= 12 ? 3 : mm >= 5 ? 2 : mm >= 1 ? 1 : 0})`

// ---------- weather-type grid: rows = editions, cols = Thu..Mon ----------
export function typeGrid(editions, includeThursday) {
  const cols = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon']
  const rowH = 26, colW = 62, padL = 52, padT = 26, padR = 8, padB = 6
  const W = padL + cols.length * colW + padR
  const H = padT + editions.length * rowH + padB
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weather type for every festival day by year">`
  cols.forEach((c, i) => {
    s += `<text x="${padL + i * colW + colW / 2}" y="16" text-anchor="middle" font-size="11" font-family="var(--mono)" fill="var(--ink-3)">${c}</text>`
  })
  editions.forEach((ed, r) => {
    const y = padT + r * rowH
    s += `<text x="${padL - 8}" y="${y + rowH / 2 + 4}" text-anchor="end" font-size="11.5" font-family="var(--mono)" fill="var(--ink-2)">${ed.year}${ed.provisional ? '*' : ''}</text>`
    const byWd = Object.fromEntries(ed.days.map((d) => [d.weekday, d]))
    cols.forEach((c, i) => {
      const x = padL + i * colW
      const d = byWd[c]
      if (!d) { s += `<rect x="${x + 2}" y="${y + 2}" width="${colW - 4}" height="${rowH - 4}" rx="4" fill="none" stroke="var(--line-2)" stroke-dasharray="2 3"/>`; return }
      const counted = d.role === 'core' || (d.role === 'thursday' && includeThursday)
      const muted = d.role === 'monday' || (d.role === 'thursday' && !includeThursday)
      const tip = `${niceDate(d.date)} · ${d.type}\nrain ${d.rain} mm · ${degC(d.tmax)} · cloud ${d.cloud}%${d.role !== 'core' ? '\n(' + (d.role === 'monday' ? 'teardown, not counted' : includeThursday ? 'bolt-on, counted' : 'bolt-on, not counted') + ')' : ''}`
      const cx = x + colW / 2, cy = y + rowH / 2
      s += `<g><title>${esc(tip)}</title>`
        + `<rect class="cell" data-tip="${esc(tip)}" x="${x + 2}" y="${y + 2}" width="${colW - 4}" height="${rowH - 4}" rx="4" fill="${typeVar(d.type)}" opacity="${muted ? 0.34 : 1}"${counted ? '' : ' stroke="var(--line)"'}/>`
        + `<text x="${cx}" y="${cy + 3.5}" text-anchor="middle" font-size="10" font-family="var(--mono)" fill="#fff" stroke="rgba(0,0,0,.4)" stroke-width="0.6" paint-order="stroke" opacity="${muted ? 0.5 : 0.95}" pointer-events="none">${TYPE_CODE[d.type] || ''}</text>`
        + `</g>`
    })
  })
  return s + '</svg>'
}

// ---------- rain by edition (vertical bars, coloured by intensity) ----------
export function rainBars(stats) {
  const W = 720, H = 260, padL = 34, padB = 34, padT = 14, padR = 6
  const max = Math.max(30, ...stats.map((s) => s.rainTotal))
  const bw = (W - padL - padR) / stats.length
  const y = (v) => padT + (1 - v / max) * (H - padT - padB)
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Total rain over the festival weekend, by year">`
  for (const g of [0, 10, 20, 30].filter((g) => g <= max)) {
    s += `<line x1="${padL}" x2="${W - padR}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line-2)"/><text x="${padL - 5}" y="${y(g) + 3}" text-anchor="end" font-size="10" font-family="var(--mono)" fill="var(--ink-3)">${g}</text>`
  }
  stats.forEach((st, i) => {
    const x = padL + i * bw
    const h = padT + (H - padT - padB) - y(st.rainTotal)
    const tip = `${st.year}${st.provisional ? ' (provisional)' : ''}\nweekend rain ${st.rainTotal.toFixed(1)} mm\n${st.rainHours} wet hours · avg high ${degC(st.tmaxAvg)}`
    s += `<rect class="cell" data-tip="${esc(tip)}" x="${x + bw * 0.16}" y="${y(st.rainTotal)}" width="${bw * 0.68}" height="${Math.max(1, h)}" rx="3" fill="${rainRamp(st.rainTotal)}"/>`
    if (i % 2 === 0 || stats.length <= 10) s += `<text x="${x + bw / 2}" y="${H - padB + 13}" text-anchor="middle" font-size="9.5" font-family="var(--mono)" fill="var(--ink-3)">${String(st.year).slice(2)}</text>`
  })
  s += `<text x="${padL - 5}" y="10" text-anchor="end" font-size="9" font-family="var(--mono)" fill="var(--ink-3)">mm</text>`
  return s + '</svg>'
}

// ---------- where the Kelburn weekend ranked among that summer's weekends ----------
export function rankStrip(ranks) {
  const items = ranks.filter(Boolean)
  const nW = Math.max(13, ...items.map((r) => r.nWeekends))
  const W = 720, H = 150, padL = 30, padR = 30, padT = 40, padB = 26
  const x = (rank) => padL + ((rank - 1) / (nW - 1)) * (W - padL - padR)
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rank of the Kelburn weekend among summer weekends, 1 = wettest">`
  // axis
  s += `<line x1="${padL}" x2="${W - padR}" y1="${padT + 44}" y2="${padT + 44}" stroke="var(--line)"/>`
  ;[1, Math.ceil(nW / 2), nW].forEach((t) => {
    s += `<line x1="${x(t)}" x2="${x(t)}" y1="${padT + 40}" y2="${padT + 48}" stroke="var(--line)"/><text x="${x(t)}" y="${padT + 64}" text-anchor="middle" font-size="10" font-family="var(--mono)" fill="var(--ink-3)">${t}</text>`
  })
  s += `<text x="${padL}" y="18" font-size="11" font-family="var(--mono)" fill="var(--ink-2)">1 = wettest weekend of the summer</text>`
  s += `<text x="${W - padR}" y="18" text-anchor="end" font-size="11" font-family="var(--mono)" fill="var(--ink-3)">driest → ${nW}</text>`
  // median marker
  const med = items.map((r) => r.wettest).sort((a, b) => a - b)[Math.floor(items.length / 2)]
  if (med) s += `<line x1="${x(med)}" x2="${x(med)}" y1="${padT + 22}" y2="${padT + 46}" stroke="var(--accent)" stroke-width="2" stroke-dasharray="3 3"/><text x="${x(med)}" y="${padT + 34}" text-anchor="middle" font-size="10" font-family="var(--mono)" fill="var(--accent)">median ${med}</text>`
  // dots (jittered vertically by index parity to reduce overlap)
  items.forEach((r, i) => {
    const cx = x(r.wettest), cy = padT + 44 + (i % 2 ? -9 : 9) * 0 // keep on axis; tooltip disambiguates
    const tip = `${r.year}: ${r.wettest} of ${r.nWeekends} wettest\n${r.rainVsTypical >= 0 ? '+' : ''}${r.rainVsTypical.toFixed(1)} mm vs a typical ${r.year} weekend`
    s += `<circle class="cell" data-tip="${esc(tip)}" cx="${cx}" cy="${padT + 44}" r="5.5" fill="${rainRamp(30 - (r.wettest / nW) * 30)}" fill-opacity="0.85" stroke="var(--surface)" stroke-width="1.5"/>`
  })
  return s + '</svg>'
}

// ---------- cloud vs solar energy, by edition ----------
export function cloudSolar(stats) {
  const W = 720, H = 250, padL = 34, padR = 34, padT = 14, padB = 30
  const bw = (W - padL - padR) / stats.length
  const maxSolar = Math.max(1, ...stats.map((s) => (s.solarMJ || 0) / Math.max(1, s.nDays)))
  const yc = (v) => padT + (1 - v / 100) * (H - padT - padB) // cloud %
  const ys = (v) => padT + (1 - v / maxSolar) * (H - padT - padB) // solar MJ/day
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Average cloud cover and daily solar energy, by year">`
  ;[0, 25, 50, 75, 100].forEach((g) => { s += `<line x1="${padL}" x2="${W - padR}" y1="${yc(g)}" y2="${yc(g)}" stroke="var(--line-2)"/><text x="${padL - 5}" y="${yc(g) + 3}" text-anchor="end" font-size="9" font-family="var(--mono)" fill="var(--ink-3)">${g}</text>` })
  // cloud bars
  let pts = ''
  stats.forEach((st, i) => {
    const x = padL + i * bw
    const h = (H - padT - padB) - (yc((st.cloudAvg || 0)) - padT)
    const tip = `${st.year}\ncloud ${Math.round((st.cloudAvg || 0))}% · solar ${(st.solarMJ / st.nDays).toFixed(1)} MJ/m²/day`
    s += `<rect class="cell" data-tip="${esc(tip)}" x="${x + bw * 0.2}" y="${yc((st.cloudAvg || 0))}" width="${bw * 0.6}" height="${Math.max(1, h)}" rx="2" fill="var(--wt-grey)" fill-opacity="0.55"/>`
    const sx = x + bw / 2, sy = ys(st.solarMJ / st.nDays)
    pts += `${sx},${sy} `
    if (stats.length <= 10 || i % 2 === 0) s += `<text x="${x + bw / 2}" y="${H - padB + 13}" text-anchor="middle" font-size="9.5" font-family="var(--mono)" fill="var(--ink-3)">${String(st.year).slice(2)}</text>`
  })
  s += `<polyline points="${pts.trim()}" fill="none" stroke="var(--heat)" stroke-width="2"/>`
  stats.forEach((st, i) => { const sx = padL + i * bw + bw / 2, sy = ys(st.solarMJ / st.nDays); s += `<circle cx="${sx}" cy="${sy}" r="2.6" fill="var(--heat)"/>` })
  return s + '</svg>'
}

// ---------- coldest overnight low, by edition (lollipop) ----------
export function nightLows(perEdition, avgLow) {
  const items = perEdition.filter((p) => p.coldest != null && isFinite(p.coldest))
  if (!items.length) return `<svg class="chart" viewBox="0 0 720 200"></svg>`
  const W = 720, H = 210, padL = 28, padR = 12, padT = 16, padB = 30
  const temps = items.map((p) => p.coldest)
  const lo = Math.floor(Math.min(...temps, avgLow ?? Infinity)) - 1
  const hi = Math.ceil(Math.max(...temps, avgLow ?? -Infinity)) + 1
  const bw = (W - padL - padR) / items.length
  const y = (v) => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB)
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Coldest overnight low by year">`
  for (let g = lo + 1; g < hi; g += 2) s += `<line x1="${padL}" x2="${W - padR}" y1="${y(g)}" y2="${y(g)}" stroke="var(--line-2)"/><text x="${padL - 4}" y="${y(g) + 3}" text-anchor="end" font-size="9" font-family="var(--mono)" fill="var(--ink-3)">${g}</text>`
  if (avgLow != null) s += `<line x1="${padL}" x2="${W - padR}" y1="${y(avgLow)}" y2="${y(avgLow)}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="4 3"/><text x="${W - padR}" y="${y(avgLow) - 4}" text-anchor="end" font-size="9.5" font-family="var(--mono)" fill="var(--accent)">avg ${avgLow.toFixed(1)}°</text>`
  items.forEach((p, i) => {
    const cx = padL + i * bw + bw / 2, cy = y(p.coldest)
    const tip = `${p.year}${p.provisional ? ' (provisional)' : ''}\ncoldest night ${p.coldest.toFixed(1)}°${p.avgLow != null ? ` · avg low ${p.avgLow.toFixed(1)}°` : ''}`
    s += `<line x1="${cx}" x2="${cx}" y1="${H - padB}" y2="${cy}" stroke="var(--wt-cold)" stroke-width="1.5" opacity="0.45"/>`
    s += `<circle class="cell" data-tip="${esc(tip)}" cx="${cx}" cy="${cy}" r="4.5" fill="var(--wt-cold)" stroke="var(--surface)" stroke-width="1.3"/>`
    if (items.length <= 12 || i % 2 === 0) s += `<text x="${cx}" y="${H - padB + 13}" text-anchor="middle" font-size="9.5" font-family="var(--mono)" fill="var(--ink-3)">${String(p.year).slice(2)}</text>`
  })
  return s + '</svg>'
}

// ---------- small trend line ----------
export function trendLine(points, key, unit) {
  const pts = points.filter((p) => p[key] != null)
  if (pts.length < 2) return `<svg class="chart" viewBox="0 0 720 120"></svg>`
  const W = 720, H = 120, padL = 30, padR = 30, padT = 12, padB = 22
  const xs = pts.map((p) => p.year), ys = pts.map((p) => p[key])
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const x = (yr) => padL + ((yr - Math.min(...xs)) / (Math.max(...xs) - Math.min(...xs))) * (W - padL - padR)
  const y = (v) => padT + (1 - (v - minY) / (maxY - minY || 1)) * (H - padT - padB)
  let poly = pts.map((p) => `${x(p.year).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend of ${key} by year">`
  s += `<polyline points="${poly}" fill="none" stroke="var(--accent)" stroke-width="2"/>`
  pts.forEach((p, i) => {
    const last = i === pts.length - 1
    const tip = `${p.year}: ${p[key].toFixed(1)} ${unit}`
    s += `<circle class="cell" data-tip="${esc(tip)}" cx="${x(p.year)}" cy="${y(p[key])}" r="${last ? 4.5 : 2.6}" fill="var(--accent)"${last ? ' stroke="var(--surface)" stroke-width="1.5"' : ''}/>`
  })
  s += `<text x="${padL}" y="10" font-size="9" font-family="var(--mono)" fill="var(--ink-3)">${maxY.toFixed(0)}</text><text x="${padL}" y="${H - 2}" font-size="9" font-family="var(--mono)" fill="var(--ink-3)">${minY.toFixed(0)} ${unit}</text>`
  return s + '</svg>'
}
