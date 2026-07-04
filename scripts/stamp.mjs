// stamp.mjs — cache-busting. Stamps ?v=<package version> onto local asset URLs and
// relative module imports so browsers fetch fresh files after an update instead of
// serving a stale cached copy. Idempotent (re-run after bumping the version).
// Run after any change to CSS/JS: `node scripts/stamp.mjs`.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const V = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version
const q = `?v=${V}`

function edit(rel, patterns) {
  const p = join(ROOT, rel)
  let s = readFileSync(p, 'utf8')
  for (const { re, repl } of patterns) s = s.replace(re, repl)
  writeFileSync(p, s)
}

// index.html: the two <link>/<script> asset references
edit('index.html', [
  { re: /(assets\/css\/styles\.css)(\?v=[^"']*)?/g, repl: `$1${q}` },
  { re: /(assets\/js\/main\.js)(\?v=[^"']*)?/g, repl: `$1${q}` },
])

// module graph: relative imports of our own files
for (const f of ['assets/js/main.js', 'assets/js/charts.js']) {
  edit(f, [{ re: /(from '\.\/(?:data|metrics|charts|format)\.js)(\?v=[^']*)?'/g, repl: `$1${q}'` }])
}

console.log(`Stamped ?v=${V} onto index.html + module imports`)
