// main.js — loads the data, builds the controls, and re-renders on every filter change.
import { KELBURN } from './data.js?v=1.2.0'
import { compute } from './metrics.js?v=1.2.0'
import * as C from './charts.js?v=1.2.0'
import { ordinal, degC, niceDate, typeVar, TYPE_ORDER, TYPE_CODE, TYPE_META, WEEKDAY_FULL } from './format.js?v=1.2.0'

const $ = (id) => document.getElementById(id)
const el = (tag, attrs = {}, html) => { const n = document.createElement(tag); Object.assign(n, attrs); if (html != null) n.innerHTML = html; return n }
const median = (xs) => { const a = [...xs].sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : null }
const CANCELLED = new Set((KELBURN.meta.cancelled || []).map((c) => c.year))
const ALL_YEARS = KELBURN.editions.map((e) => e.year)

const state = { years: new Set(ALL_YEARS), thu: false, gridMode: 'day' }

/* ---------------- theme ---------------- */
function initTheme() {
  const saved = localStorage.getItem('kwx-theme')
  if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved)
  updateThemeBtn()
}
function cycleTheme() {
  const cur = document.documentElement.getAttribute('data-theme')
  const next = cur === 'dark' ? 'light' : cur === 'light' ? '' : 'dark'
  if (next) { document.documentElement.setAttribute('data-theme', next); localStorage.setItem('kwx-theme', next) }
  else { document.documentElement.removeAttribute('data-theme'); localStorage.removeItem('kwx-theme') }
  updateThemeBtn(); render()
}
function updateThemeBtn() {
  const cur = document.documentElement.getAttribute('data-theme') || 'auto'
  $('themeBtn').textContent = cur === 'dark' ? 'Dark' : cur === 'light' ? 'Light' : 'Auto'
}

/* ---------------- filter controls ---------------- */
function buildFilters() {
  const row = $('yearChips')
  for (let y = 2009; y <= 2026; y++) {
    if (CANCELLED.has(y)) { row.append(el('span', { className: 'chip cancelled', title: 'Cancelled (COVID)' }, `${y}`)); continue }
    if (!ALL_YEARS.includes(y)) continue
    const prov = KELBURN.editions.find((e) => e.year === y)?.provisional
    const c = el('button', { className: 'chip', type: 'button' }, `${y}${prov ? '<small>*</small>' : ''}`)
    c.setAttribute('aria-pressed', state.years.has(y))
    c.addEventListener('click', () => { state.years.has(y) ? state.years.delete(y) : state.years.add(y); c.setAttribute('aria-pressed', state.years.has(y)); render() })
    row.append(c)
  }
  $('allBtn').addEventListener('click', () => setYears(ALL_YEARS))
  $('noneBtn').addEventListener('click', () => setYears([]))
  $('recentBtn').addEventListener('click', () => setYears(ALL_YEARS.slice(-5)))
  const thu = $('thuToggle')
  thu.addEventListener('change', () => { state.thu = thu.checked; render() })
  $('themeBtn').addEventListener('click', cycleTheme)
  document.querySelectorAll('#gridToggle .seg-btn').forEach((b) => b.addEventListener('click', () => {
    state.gridMode = b.dataset.mode
    document.querySelectorAll('#gridToggle .seg-btn').forEach((x) => x.setAttribute('aria-pressed', x.dataset.mode === state.gridMode))
    renderGrid()
  }))
}
function setYears(list) {
  state.years = new Set(list)
  document.querySelectorAll('#yearChips .chip:not(.cancelled)').forEach((c) => {
    const y = parseInt(c.textContent, 10); c.setAttribute('aria-pressed', state.years.has(y))
  })
  render()
}

/* ---------------- render ---------------- */
function render() {
  const r = compute(KELBURN, { years: state.years, includeThursday: state.thu })
  const editions = KELBURN.editions.filter((e) => state.years.has(e.year)).sort((a, b) => a.year - b.year)

  if (!r.editionCount) { showEmpty(); return }
  $('dash').style.display = ''
  $('empty').style.display = 'none'

  renderHeadline(r)
  renderKPIs(r)
  renderGrid(editions)
  renderRank(r)
  $('rainBars').innerHTML = C.rainBars(r.stats)
  $('cloudSolar').innerHTML = C.cloudSolar(r.stats)
  renderRecords(r)
  renderNight(r)
  renderDayOfFest(r)
  renderPackup(r)
  renderTaxonomy(r)
  renderTrends(r)
  wireTips()
}

function showEmpty() {
  $('dash').style.display = 'none'
  $('empty').style.display = ''
  $('hVerdict').textContent = '–'
  $('hSub').innerHTML = 'Nothing selected — pick a year or two.'
}

function renderGrid(editions) {
  editions = editions || KELBURN.editions.filter((e) => state.years.has(e.year)).sort((a, b) => a.year - b.year)
  const night = state.gridMode === 'night'
  $('gridTitle').textContent = night ? 'Every festival night' : 'Every festival day'
  $('gridNote').textContent = night
    ? 'Each square is one night, coloured by the overnight low — colder on the left of the legend, milder on the right. Thursday is a bolt-on; Monday is teardown (faded).'
    : 'Each square is one day, coloured by what it did. Thursday is a later bolt-on; Monday is teardown (faded — never counted). Toggle Thursday above to fold it in.'
  $('typeGrid').innerHTML = C.typeGrid(editions, state.thu, state.gridMode)
  buildLegend(state.gridMode)
  wireTips()
}

function renderHeadline(r) {
  const a = r.allTime
  $('hVerdict').textContent = `${a.avgMaxTemp == null ? '–' : a.avgMaxTemp.toFixed(1)}°`
  $('hSub').innerHTML = `average daytime high across <b>${r.editionCount}</b> edition${r.editionCount > 1 ? 's' : ''}, at <b>${Math.round(a.avgCloud)}%</b> cloud. That is your summer festival.`
}

function renderKPIs(r) {
  const a = r.allTime, k = r.ranks
  const med = median(r.perEditionRanks.map((x) => x.wettest))
  const tiles = [
    { c: 'k-accent', label: 'Avg daytime high', val: a.avgMaxTemp == null ? '–' : a.avgMaxTemp.toFixed(1), unit: '°C' },
    { label: 'Avg rain / weekend', val: a.avgWeekendRain == null ? '–' : a.avgWeekendRain.toFixed(1), unit: 'mm' },
    { label: 'Avg cloud cover', val: Math.round(a.avgCloud), unit: '%' },
    { label: 'Typical wettest-rank', val: med ? ordinal(med) : '–', unit: k.nWeekends ? `of ${k.nWeekends}` : '', sub: 'weekend of the summer' },
    { c: 'k-heat', label: 'Taps Aff days', val: r.tapsAffCount, unit: r.tapsAffCount === 1 ? 'ever*' : 'total*' },
    { label: 'Rain endured, total', val: Math.round(a.cumulativeRain), unit: 'mm' },
  ]
  $('kpis').innerHTML = tiles.map((t) => `
    <div class="kpi ${t.c || ''}">
      <div class="k-label">${t.label}</div>
      <div class="k-val tnum">${t.val}<small> ${t.unit}</small></div>
      ${t.sub ? `<div class="k-sub">${t.sub}</div>` : ''}
    </div>`).join('')
}

function renderRank(r) {
  $('rankStrip').innerHTML = C.rankStrip(r.perEditionRanks)
  const k = r.ranks
  if (!k.basedOn) { $('rankNote').textContent = 'Select a couple of completed years to compare against their summers.'; return }
  const med = median(r.perEditionRanks.map((x) => x.wettest))
  const drier = k.rainVsTypical != null && k.rainVsTypical < 0
  $('rankNote').innerHTML =
    `Across ${k.basedOn} completed years, the Kelburn weekend is typically the <b>${ordinal(med)}</b> wettest of ~${k.nWeekends} summer weekends — ` +
    `about <b>${Math.abs(k.rainVsTypical).toFixed(1)} mm ${drier ? 'drier' : 'wetter'}</b> and ${Math.abs(k.tempVsTypical).toFixed(1)}°C ${k.tempVsTypical < 0 ? 'cooler' : 'warmer'} than a random weekend that summer. A normal Scottish summer weekend — nothing cursed about it.`
}

function recCard(tag, val, when, hot) {
  return `<div class="rec ${hot ? 'hot' : ''}"><div class="r-tag">${tag}</div><div class="r-val tnum">${val}</div><div class="r-when">${when}</div></div>`
}
function renderRecords(r) {
  const s = r.superlatives
  const clearest = [...r.stats].filter((x) => x.cloudAvg != null).sort((a, b) => a.cloudAvg - b.cloudAvg)[0]
  const greyest = [...r.stats].filter((x) => x.cloudAvg != null).sort((a, b) => b.cloudAvg - a.cloudAvg)[0]
  const cards = [
    s.hottestDay && recCard('Taps Aff (hottest)', degC(s.hottestDay.tmax), niceDate(s.hottestDay.date), true),
    s.wettestEd && recCard('Wettest weekend', `${s.wettestEd.rainTotal.toFixed(1)} mm`, `${s.wettestEd.year}`),
    s.driestEd && recCard('Driest weekend', `${s.driestEd.rainTotal.toFixed(1)} mm`, `${s.driestEd.year}`),
    s.wettestDay && recCard('Wettest single day', `${s.wettestDay.rain.toFixed(1)} mm`, niceDate(s.wettestDay.date)),
    s.windiestDay && recCard('Windiest (gust)', `${Math.round(s.windiestDay.gust)} km/h`, niceDate(s.windiestDay.date)),
    s.coldestDay && recCard('Coldest day', degC(s.coldestDay.tmax), niceDate(s.coldestDay.date)),
    greyest && recCard('Greyest year', `${Math.round(greyest.cloudAvg)}% cloud`, `${greyest.year}`),
    clearest && recCard('Clearest year', `${Math.round(clearest.cloudAvg)}% cloud`, `${clearest.year}`),
  ].filter(Boolean)
  $('records').innerHTML = cards.join('')
}

function renderNight(r) {
  const n = r.night
  if (!n || !n.nights) { $('nightTiles').innerHTML = ''; $('nightChart').innerHTML = ''; $('nightNote').textContent = ''; return }
  $('nightTiles').innerHTML = [
    `<div class="dow"><b>Coldest night</b><div class="n tnum">${degC(n.coldest.tmin)}</div><div class="u">${niceDate(n.coldest.date)}</div></div>`,
    `<div class="dow"><b>Avg overnight low</b><div class="n tnum">${degC(n.avgLow)}</div><div class="u">across ${n.nights} nights</div></div>`,
    `<div class="dow"><b>Mildest night</b><div class="n tnum">${degC(n.warmest.tmin)}</div><div class="u">${niceDate(n.warmest.date)}</div></div>`,
  ].join('')
  $('nightChart').innerHTML = C.nightLows(n.perEdition, n.avgLow)
  const f = n.coldestFeels
  $('nightNote').innerHTML = `<b>${n.shiverNights}</b> of ${n.nights} nights got down to ${n.shiverThreshold}°C or colder.` +
    (f && f.appMin != null ? ` Worst wind-chill felt like <b>${degC(f.appMin)}</b>, ${niceDate(f.date)}.` : '')
}

function renderDayOfFest(r) {
  const order = ['Thu', 'Fri', 'Sat', 'Sun'].filter((wd) => r.byWeekday[wd])
  const wettest = order.slice().sort((a, b) => r.byWeekday[b].rain - r.byWeekday[a].rain)[0]
  $('dowGrid').innerHTML = order.map((wd) => {
    const d = r.byWeekday[wd]
    return `<div class="dow"><b>${WEEKDAY_FULL[wd]}${wd === wettest ? ' ·' : ''}</b><div class="n tnum">${d.rain.toFixed(1)}<span class="u"> mm</span></div><div class="u">avg high ${degC(d.tmax)} · cloud ${Math.round(d.cloud)}%</div></div>`
  }).join('')
  $('dowNote').textContent = wettest ? `${WEEKDAY_FULL[wettest]} is, on average, the wettest day to be on site.` : ''
}

function renderPackup(r) {
  const p = r.packup
  if (!p) { $('packup').innerHTML = `<div class="cap">No teardown Mondays in the selected years.</div>`; return }
  $('packup').innerHTML = `
    <div class="mini">
      <div class="dow"><b>Worst pack-up</b><div class="n tnum">${p.worst.rain.toFixed(1)}<span class="u"> mm</span></div><div class="u">Mon ${p.worst.year} · gust ${Math.round(p.worst.gust)} km/h</div></div>
      <div class="dow"><b>Average Monday</b><div class="n tnum">${p.avgRain.toFixed(1)}<span class="u"> mm</span></div><div class="u">${Math.round(p.avgCloud)}% cloud</div></div>
      <div class="dow"><b>Teardowns</b><div class="n tnum">${p.n}</div><div class="u">Mondays in view</div></div>
    </div>`
}

function renderTaxonomy(r) {
  const maxC = Math.max(1, ...Object.values(r.typeCounts))
  $('taxo').innerHTML = TYPE_ORDER.filter((t) => r.typeCounts[t]).map((t) => {
    const n = r.typeCounts[t]
    return `<div class="row"><span class="name" title="${TYPE_META[t].blurb}">${t}</span><div class="bar"><div class="fill" style="width:${(n / maxC) * 100}%;background:${typeVar(t)}"></div></div><span class="c tnum">${n}</span></div>`
  }).join('')
}

function renderTrends(r) {
  $('trendTemp').innerHTML = C.trendLine(r.trends.points, 'tmaxAvg', '°C')
  $('trendRain').innerHTML = C.trendLine(r.trends.points, 'rainTotal', 'mm')
  const tp = r.trends.tempPerDecade, rp = r.trends.rainPerDecade
  $('trendNote').innerHTML = `Avg high: <b>${tp >= 0 ? '+' : ''}${tp.toFixed(1)}°C</b> / decade · weekend rain: <b>${rp >= 0 ? '+' : ''}${rp.toFixed(0)} mm</b> / decade. On ${r.trends.points.length} points — read nothing into it.`
}

/* ---------------- tooltip ---------------- */
let tip
function wireTips() {
  if (!tip) { tip = el('div', { className: 'tip' }); document.body.append(tip) }
  document.querySelectorAll('[data-tip]').forEach((n) => {
    n.onpointerenter = (e) => { tip.textContent = n.getAttribute('data-tip'); tip.style.whiteSpace = 'pre-line'; tip.style.opacity = '1'; move(e) }
    n.onpointermove = move
    n.onpointerleave = () => { tip.style.opacity = '0' }
  })
}
function move(e) {
  const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight
  let x = e.clientX + pad, y = e.clientY + pad
  if (x + w > innerWidth - 6) x = e.clientX - w - pad
  if (y + h > innerHeight - 6) y = e.clientY - h - pad
  tip.style.left = Math.max(6, x) + 'px'; tip.style.top = Math.max(6, y) + 'px'
}

function buildLegend(mode = 'day') {
  const l = $('typeLegend')
  if (!l) return
  const notCounted = `<span><i class="swatch" style="background:var(--ink-3);opacity:.34"></i>faded = not counted</span>`
  if (mode === 'night') {
    const steps = [['0', '≤7°'], ['1', '8–9°'], ['2', '10–11°'], ['3', '12–13°'], ['4', '14°+']]
    l.innerHTML = steps.map(([n, lab]) => `<span><i class="swatch" style="background:var(--night-${n})"></i>${lab}</span>`).join('') + notCounted
    return
  }
  l.innerHTML = TYPE_ORDER.map((t) => `<span><i class="swatch" style="background:${typeVar(t)}"></i><b class="mono">${TYPE_CODE[t]}</b> ${t}</span>`).join('') + notCounted
}

/* ---------------- go ---------------- */
initTheme()
buildFilters()
render()
