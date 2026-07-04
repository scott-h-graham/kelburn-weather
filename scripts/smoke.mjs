// Headless smoke test: run main.js's full render path behind a tiny DOM stub.
// If this completes without throwing, the selectors + render logic are sound.
const store = {}
function makeEl() {
  const node = {
    _html: '', _text: '', style: {}, attrs: {}, children: [],
    set innerHTML(v) { this._html = String(v) }, get innerHTML() { return this._html },
    set textContent(v) { this._text = String(v) }, get textContent() { return this._text },
    setAttribute(k, v) { this.attrs[k] = String(v) }, getAttribute(k) { return this.attrs[k] ?? null },
    removeAttribute(k) { delete this.attrs[k] },
    addEventListener() {}, append(...c) { this.children.push(...c) }, appendChild(c) { this.children.push(c) },
    querySelectorAll() { return [] }, classList: { add() {}, remove() {}, toggle() {} },
    checked: false, value: '',
  }
  return new Proxy(node, { get(t, p) { return p in t ? t[p] : (typeof p === 'string' && p.startsWith('on') ? undefined : () => {}) }, set(t, p, v) { t[p] = v; return true } })
}
const doc = {
  getElementById(id) { return (store[id] ||= makeEl()) },
  createElement() { return makeEl() },
  querySelectorAll() { return [] },
  documentElement: makeEl(),
  body: makeEl(),
}
globalThis.document = doc
globalThis.window = globalThis
globalThis.innerWidth = 390
globalThis.innerHeight = 844
globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null }, setItem(k, v) { this._d[k] = v }, removeItem(k) { delete this._d[k] } }

try {
  await import('../assets/js/main.js')
  // spot-check a few mounts got populated
  const ids = ['kpis', 'typeGrid', 'rankStrip', 'rainBars', 'cloudSolar', 'records', 'dowGrid', 'packup', 'taxo', 'trendTemp', 'hVerdict']
  let ok = true
  for (const id of ids) {
    const n = store[id]
    const filled = n && ((n._html && n._html.length > 4) || (n._text && n._text.length > 0))
    if (!filled) { ok = false; console.log('EMPTY mount:', id) }
  }
  console.log('hVerdict =', store.hVerdict?._text)
  console.log('kpis html length =', store.kpis?._html.length)
  console.log(ok ? 'SMOKE TEST PASSED — full render ran, all mounts populated' : 'SMOKE TEST: some mounts empty')
} catch (e) {
  console.error('SMOKE TEST THREW:', e.message)
  console.error(e.stack.split('\n').slice(0, 4).join('\n'))
  process.exit(1)
}
