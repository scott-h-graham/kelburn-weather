// Produce a single self-contained HTML fragment (for an Artifact preview) from the multi-file site.
// The deployed GitHub Pages site uses the real multi-file version; this is only for previewing.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

const css = read('assets/css/styles.css')

// concatenate modules in dependency order, stripping module syntax so they share one scope
let main = read('assets/js/main.js').replace(
  /import \* as C from '\.\/charts\.js(\?v=[^']*)?'/,
  'const C = { typeGrid, rainBars, rankStrip, cloudSolar, trendLine, nightLows }'
)
const modules = [read('assets/js/data.js'), read('assets/js/format.js'), read('assets/js/metrics.js'), read('assets/js/charts.js'), main]
const bundle = modules.join('\n\n')
  .replace(/^\s*import[^\n]*\n/gm, '')  // drop import lines
  .replace(/^export\s+/gm, '')          // drop export keyword

// pull the <body> inner out of index.html and drop the module <script>
const html = read('index.html')
const bodyInner = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/<script type="module"[^>]*><\/script>/, '')
  .trim()

const fragment = `<title>Kelburn WX — Garden Party weather</title>
<style>${css}</style>
${bodyInner}
<script>${bundle}</script>`

mkdirSync(join(ROOT, 'dist'), { recursive: true })
writeFileSync(join(ROOT, 'dist', 'preview.html'), fragment)
console.log('Wrote dist/preview.html —', fragment.length, 'bytes')
