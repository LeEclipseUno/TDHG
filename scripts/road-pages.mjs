// Static landing page per A-road and national N-road, plus an index, a shared map and a sitemap.
// Runs after the Vite build (see vite.config.ts) and writes into dist/. Also runnable by hand: node scripts/road-pages.mjs dist
import fs from 'node:fs'
import path from 'node:path'

const SITE = 'https://wegenkenner.nl'
const PROV = { GR: 'Groningen', FR: 'Friesland', DR: 'Drenthe', OV: 'Overijssel', FL: 'Flevoland', GE: 'Gelderland', UT: 'Utrecht', NH: 'Noord-Holland', ZH: 'Zuid-Holland', ZE: 'Zeeland', NB: 'Noord-Brabant', LI: 'Limburg' }

const W = 420 // map width in px

function decode(line) {
  const out = new Array(line.length)
  out[0] = line[0]
  out[1] = line[1]
  for (let i = 2; i < line.length; i += 2) {
    out[i] = out[i - 2] + line[i]
    out[i + 1] = out[i - 1] + line[i + 1]
  }
  return out
}

/** Douglas-Peucker on a flat [x,y,...] array, tolerance in metres. */
function simplify(pts, tol) {
  const n = pts.length / 2
  if (n < 3) return pts
  const keep = new Uint8Array(n)
  keep[0] = keep[n - 1] = 1
  const stack = [[0, n - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const ax = pts[a * 2], ay = pts[a * 2 + 1], bx = pts[b * 2], by = pts[b * 2 + 1]
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    let best = -1, bestD = tol
    for (let i = a + 1; i < b; i++) {
      const px = pts[i * 2], py = pts[i * 2 + 1]
      let d
      if (len2 === 0) d = Math.hypot(px - ax, py - ay)
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
        d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
      }
      if (d > bestD) { bestD = d; best = i }
    }
    if (best > 0) { keep[best] = 1; stack.push([a, best], [best, b]) }
  }
  const out = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1])
  return out
}

/** Join the pieces of a road into one ordered polyline, dropping the second carriageway. */
function chainLines(lines) {
  const len = (l) => { let d = 0; for (let i = 2; i < l.length; i += 2) d += Math.hypot(l[i] - l[i - 2], l[i + 1] - l[i - 1]); return d }
  const rest = [...lines].sort((a, b) => len(b) - len(a))
  let chain = rest.shift().slice()
  const nearChain = (x, y) => { let best = Infinity; for (let i = 0; i < chain.length; i += 2) best = Math.min(best, Math.hypot(chain[i] - x, chain[i + 1] - y)); return best }
  const duplicate = (l) => {
    const n = l.length / 2
    const idx = [Math.floor(n * 0.25), Math.floor(n * 0.5), Math.floor(n * 0.75)]
    return idx.every((i) => nearChain(l[i * 2], l[i * 2 + 1]) < 400)
  }
  while (rest.length) {
    const hx = chain[0], hy = chain[1], tx = chain[chain.length - 2], ty = chain[chain.length - 1]
    let best = null
    rest.forEach((l, i) => {
      const ax = l[0], ay = l[1], bx = l[l.length - 2], by = l[l.length - 1]
      const opts = [
        { d: Math.hypot(tx - ax, ty - ay), i, end: 'tail', rev: false },
        { d: Math.hypot(tx - bx, ty - by), i, end: 'tail', rev: true },
        { d: Math.hypot(hx - bx, hy - by), i, end: 'head', rev: false },
        { d: Math.hypot(hx - ax, hy - ay), i, end: 'head', rev: true },
      ]
      for (const o of opts) if (!best || o.d < best.d) best = o
    })
    if (!best || best.d > 6000) break
    const [l] = rest.splice(best.i, 1)
    if (duplicate(l)) continue
    let pts = l.slice()
    if (best.rev) { const r = []; for (let i = pts.length - 2; i >= 0; i -= 2) r.push(pts[i], pts[i + 1]); pts = r }
    chain = best.end === 'tail' ? chain.concat(pts) : pts.concat(chain)
  }
  return chain
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function listNl(items) {
  if (items.length <= 1) return items.join('')
  return items.slice(0, -1).join(', ') + ' en ' + items[items.length - 1]
}

export function buildRoadPages(dist) {
  const dataDir = path.resolve('public/data')
  const load = (n) => JSON.parse(fs.readFileSync(path.join(dataDir, n), 'utf8'))
  const roads = load('roads-core.json').filter((r) => r.kind === 'A' || r.kind === 'N')
  const land = load('land.json')
  const abroad = load('abroad.json')
  const junctions = load('junctions.json')
  const exits = load('exits.json')
  const places = load('places.json')
  for (const r of roads) r.lines = r.lines.map(decode)

  // Projection: fit the land bbox into W px wide.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const poly of land) for (const ring of poly.rings) for (let i = 0; i < ring.length; i += 2) {
    x0 = Math.min(x0, ring[i]); x1 = Math.max(x1, ring[i]); y0 = Math.min(y0, ring[i + 1]); y1 = Math.max(y1, ring[i + 1])
  }
  const pad = 6000
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad
  const scale = W / (x1 - x0)
  const H = Math.round((y1 - y0) * scale)
  const px = (x) => ((x - x0) * scale).toFixed(1)
  const py = (y) => ((y - y0) * scale).toFixed(1)
  const pathOf = (pts, tol, close = false) => {
    const s = simplify(pts, tol)
    if (s.length < 4) return ''
    let d = `M${px(s[0])} ${py(s[1])}`
    for (let i = 2; i < s.length; i += 2) d += `L${px(s[i])} ${py(s[i + 1])}`
    return close ? d + 'Z' : d
  }
  const bigEnough = (ring, min) => {
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity
    for (let i = 0; i < ring.length; i += 2) { bx0 = Math.min(bx0, ring[i]); bx1 = Math.max(bx1, ring[i]); by0 = Math.min(by0, ring[i + 1]); by1 = Math.max(by1, ring[i + 1]) }
    return Math.hypot(bx1 - bx0, by1 - by0) > min
  }

  // Shared base map: neighbours, land, all A and N roads faint.
  let base = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`
  base += `<rect width="${W}" height="${H}" fill="#0a1628"/>`
  base += '<g fill="#15243a">'
  for (const poly of abroad) for (const ring of poly.rings) if (bigEnough(ring, 8000)) base += `<path d="${pathOf(ring, 500, true)}"/>`
  base += '</g><g fill="#1b4a8d">'
  for (const poly of land) for (const ring of poly.rings) if (bigEnough(ring, 2500)) base += `<path d="${pathOf(ring, 300, true)}"/>`
  base += '</g><g fill="none" stroke="#ffd23f" stroke-width="0.9" stroke-opacity="0.45" stroke-linejoin="round" stroke-linecap="round">'
  for (const r of roads) if (r.kind === 'N') for (const l of r.lines) base += `<path d="${pathOf(l, 600)}"/>`
  base += '</g><g fill="none" stroke="#fff" stroke-width="1.3" stroke-opacity="0.6" stroke-linejoin="round" stroke-linecap="round">'
  for (const r of roads) if (r.kind === 'A') for (const l of r.lines) base += `<path d="${pathOf(l, 600)}"/>`
  base += '</g></svg>'
  fs.mkdirSync(path.join(dist, 'wegen'), { recursive: true })
  fs.writeFileSync(path.join(dist, 'wegen', 'kaart.svg'), base)

  const byRef = new Map(roads.map((r) => [r.ref, r]))
  const cities = places.filter((p) => p.c === 1)
  const nearestPlace = (x, y) => {
    let best = null, bestD = Infinity
    for (const p of cities) { const d = Math.hypot(p.x - x, p.y - y); if (d < bestD) { bestD = d; best = p } }
    if (bestD > 7000) for (const p of places) { const d = Math.hypot(p.x - x, p.y - y); if (d < bestD) { bestD = d; best = p } }
    return best
  }
  const exitNum = (r) => parseInt(String(r).replace(/\D.*$/, ''), 10) || 0

  const shieldHtml = (r, cls = '') => `<span class="shield shield-${r.kind} ${cls}">${esc(r.ref)}</span>`
  const roadLink = (r) => `<a class="shield-link" href="/${r.ref}/">${shieldHtml(r)}</a>`

  const css = `
:root{--bg:#0a1628;--blue:#0d4a9c;--ink:#f7f8fa;--dim:rgba(255,255,255,.72);--orange:#ef712f}
*{box-sizing:border-box}
@font-face{font-family:'Barlow';font-weight:400;font-display:swap;src:url('/fonts/Barlow-400.woff2') format('woff2')}
@font-face{font-family:'Barlow';font-weight:600;font-display:swap;src:url('/fonts/Barlow-600.woff2') format('woff2')}
@font-face{font-family:'Barlow Condensed';font-weight:700;font-display:swap;src:url('/fonts/BarlowCondensed-700.woff2') format('woff2')}
@font-face{font-family:'Overpass';font-weight:800;font-display:swap;src:url('/fonts/Overpass-800.woff2') format('woff2')}
body{margin:0;background:var(--bg);color:var(--ink);font-family:'Barlow',system-ui,sans-serif;line-height:1.45}
.wrap{max-width:560px;margin:0 auto;padding:16px 16px 40px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.top img{height:48px;width:auto}
.top a{color:var(--dim);text-decoration:none;font-size:14px}
.board{background:var(--blue);border-radius:8px;padding:5px;box-shadow:0 12px 32px rgba(0,0,0,.4);margin-bottom:14px}
.inner{border:3px solid #fff;border-radius:5px;padding:16px 16px 18px}
.title{font-family:'Barlow Condensed',sans-serif;font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.7);margin:0 0 8px}
h1{display:flex;align-items:center;gap:12px;margin:0 0 4px;font-family:'Barlow Condensed',sans-serif;font-size:34px;line-height:1}
h2{margin:0 0 8px;font-family:'Barlow Condensed',sans-serif;font-size:22px}
p{margin:0 0 10px}
.sub{color:var(--dim);margin:0}
.shield{display:inline-block;font-family:'Overpass',sans-serif;font-weight:800;font-size:22px;line-height:1;padding:6px 10px 4px;border-radius:5px;white-space:nowrap}
.shield-A{background:#c8102e;color:#fff;box-shadow:inset 0 0 0 2px #c8102e,inset 0 0 0 3.5px #fff}
.shield-N{background:#ffd23f;color:#111;box-shadow:inset 0 0 0 2px #ffd23f,inset 0 0 0 3.5px #111}
.shield-sm{font-size:15px;padding:4px 7px 3px;box-shadow:inset 0 0 0 1.5px currentColor}
.shield-A.shield-sm{box-shadow:inset 0 0 0 1.5px #c8102e,inset 0 0 0 2.5px #fff}
.shield-N.shield-sm{box-shadow:inset 0 0 0 1.5px #ffd23f,inset 0 0 0 2.5px #111}
.map{display:block;width:100%;height:auto;border-radius:5px;background:#0a1628}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0}
dt{color:var(--dim)}
dd{margin:0}
ul{margin:0;padding-left:0;list-style:none;columns:2;column-gap:16px}
li{break-inside:avoid;padding:2px 0}
li .n{display:inline-block;min-width:2.2em;color:var(--dim)}
.shields{display:flex;flex-wrap:wrap;gap:8px}
.shield-link{text-decoration:none}
.cta{display:flex;flex-direction:column;gap:8px}
.btn{display:flex;align-items:center;justify-content:space-between;background:#fff;color:var(--blue);text-decoration:none;font-weight:600;padding:12px 14px;border-radius:5px;font-size:17px}
.btn.alt{background:var(--orange);color:#fff}
.btn:after{content:'\\2192';font-weight:400}
a{color:#fff}
.foot{color:var(--dim);font-size:13px;text-align:center}
.foot a{color:var(--dim)}
@media(min-width:600px){ul{columns:3}}
`

  const shell = (title, desc, canonical, body, extraHead = '') => `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0a1628">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico">
${extraHead}
<style>${css}</style>
</head>
<body>
<div class="wrap">
<div class="top"><a href="/"><img src="/logo.png" alt="Wegenkenner, The Dutch Highway Guesser"></a><a href="/wegen/">Alle wegen</a></div>
${body}
<p class="foot"><a href="/">Wegenkenner</a> is een gratis spel over het Nederlandse wegennet. Kaartgegevens: OpenStreetMap, CBS.</p>
</div>
</body>
</html>
`

  const today = new Date().toISOString().slice(0, 10)
  const urls = [`${SITE}/`, `${SITE}/wegen/`]

  for (const r of roads) {
    const main = chainLines(r.lines)
    // Interchanges on this road, ordered along it.
    const cum = [0]
    for (let i = 2; i < main.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(main[i] - main[i - 2], main[i + 1] - main[i - 1]))
    const along = (x, y) => {
      let best = 0, bestD = Infinity
      for (let i = 0; i < main.length; i += 2) { const d = Math.hypot(main[i] - x, main[i + 1] - y); if (d < bestD) { bestD = d; best = i / 2 } }
      return cum[best]
    }
    const myExits = exits.filter((e) => e.road === r.ref).sort((a, b) => exitNum(a.r) - exitNum(b.r) || a.r.localeCompare(b.r))
    // Orient start/end so that exit numbers count up from the start.
    let flip = false
    if (myExits.length >= 2) {
      const first = myExits[0], last = myExits[myExits.length - 1]
      flip = along(first.x, first.y) > along(last.x, last.y)
    }
    let startPt = flip ? [main[main.length - 2], main[main.length - 1]] : [main[0], main[1]]
    let endPt = flip ? [main[0], main[1]] : [main[main.length - 2], main[main.length - 1]]
    if (cum[cum.length - 1] < r.km * 1000 * 0.8) {
      // The road has a gap the chain could not bridge: take the two line ends that lie farthest apart.
      const ends = r.lines.flatMap((l) => [[l[0], l[1]], [l[l.length - 2], l[l.length - 1]]])
      let bd = -1
      for (const a of ends) for (const b of ends) { const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (d > bd) { bd = d; startPt = a; endPt = b } }
      if (myExits.length) {
        const e = myExits[0]
        if (Math.hypot(e.x - endPt[0], e.y - endPt[1]) < Math.hypot(e.x - startPt[0], e.y - startPt[1])) [startPt, endPt] = [endPt, startPt]
      }
    }
    const from = nearestPlace(startPt[0], startPt[1])
    const to = nearestPlace(endPt[0], endPt[1])
    const myJunctions = junctions
      .filter((j) => j.roads.includes(r.ref))
      .map((j) => ({ ...j, t: along(j.x, j.y) }))
      .sort((a, b) => (flip ? b.t - a.t : a.t - b.t))
    const neighbours = [...new Set(myJunctions.flatMap((j) => j.roads))].filter((ref) => ref !== r.ref && byRef.has(ref)).map((ref) => byRef.get(ref))
    neighbours.sort((a, b) => a.kind.localeCompare(b.kind) || a.num - b.num)
    const provs = (r.p ?? []).map((c) => PROV[c]).filter(Boolean)
    const kindName = r.kind === 'A' ? 'snelweg' : 'N-weg'
    const route = from && to && from.n !== to.n ? `van ${from.n} naar ${to.n}` : from ? `bij ${from.n}` : ''

    const title = `${r.ref}: ${kindName} ${route} | Wegenkenner`
    const desc = `De ${r.ref} is ${r.km} km lang en loopt ${route || 'door Nederland'}${provs.length ? `, door ${listNl(provs)}` : ''}. ${myJunctions.length ? `${myJunctions.length} knooppunten, ` : ''}${myExits.length} afritten. Kun jij de ${r.ref} op de kaart aanwijzen?`

    // Map: base image plus this road in orange and its interchanges.
    let svg = `<svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="De ${esc(r.ref)} op de kaart van Nederland"><image href="/wegen/kaart.svg" width="${W}" height="${H}"/>`
    svg += '<g fill="none" stroke="#0a1628" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" stroke-opacity="0.8">'
    for (const l of r.lines) svg += `<path d="${pathOf(l, 150)}"/>`
    svg += `</g><g fill="none" stroke="#ef712f" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">`
    for (const l of r.lines) svg += `<path d="${pathOf(l, 150)}"/>`
    svg += '</g>'
    for (const j of myJunctions) svg += `<circle cx="${px(j.x)}" cy="${py(j.y)}" r="3" fill="#fff" stroke="#0a1628" stroke-width="1.2"/>`
    svg += '</svg>'

    const facts = `<dl>
<dt>Type</dt><dd>${r.kind === 'A' ? 'Autosnelweg' : 'Nationale weg'}</dd>
<dt>Lengte</dt><dd>${r.km} km</dd>
${route ? `<dt>Loop</dt><dd>${esc(route.replace(/^van /, 'Van ').replace(/^bij /, 'Bij '))}</dd>` : ''}
${provs.length ? `<dt>Provincies</dt><dd>${esc(listNl(provs))}</dd>` : ''}
<dt>Knooppunten</dt><dd>${myJunctions.length}</dd>
<dt>Afritten</dt><dd>${myExits.length}</dd>
</dl>`

    const junctionList = myJunctions.length
      ? `<div class="board"><div class="inner"><h2>Knooppunten op de ${esc(r.ref)}</h2><ul>${myJunctions
          .map((j) => {
            const others = j.roads.filter((x) => x !== r.ref).map((x) => (byRef.has(x) ? `<a href="/${x}/">${esc(x)}</a>` : esc(x)))
            return `<li>${esc(j.name)}${others.length ? ` <span class="n">${others.join(', ')}</span>` : ''}</li>`
          })
          .join('')}</ul></div></div>`
      : ''
    const exitList = myExits.length
      ? `<div class="board"><div class="inner"><h2>Afritten van de ${esc(r.ref)}</h2><ul>${myExits.map((e) => `<li><span class="n">${esc(e.r)}</span>${esc(e.n)}</li>`).join('')}</ul></div></div>`
      : ''
    const neighbourList = neighbours.length
      ? `<div class="board"><div class="inner"><h2>Sluit aan op</h2><div class="shields">${neighbours.map((n) => roadLink(n)).join('')}</div></div></div>`
      : ''

    const jsonld = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Wegenkenner', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Alle wegen', item: `${SITE}/wegen/` },
        { '@type': 'ListItem', position: 3, name: r.ref, item: `${SITE}/${r.ref}/` },
      ],
    }

    const body = `
<div class="board"><div class="inner">
<p class="title">${r.kind === 'A' ? 'Autosnelweg' : 'Nationale weg'}</p>
<h1>${shieldHtml(r)} <span>${esc(r.ref)}</span></h1>
<p class="sub">${r.km} km${route ? `, ${esc(route)}` : ''}</p>
</div></div>
<div class="board"><div class="inner">${svg}</div></div>
<div class="board"><div class="inner"><h2>In het kort</h2>${facts}</div></div>
<div class="board"><div class="inner"><h2>Ken jij de ${esc(r.ref)}?</h2>
<p>In Wegenkenner krijg je alleen het nummer en wijs je de weg aan op een lege kaart. Geen namen, geen hints.</p>
<div class="cta"><a class="btn alt" href="/#find">Speel Vind de weg</a><a class="btn" href="/#daily">Speel de dagelijkse puzzel</a></div>
</div></div>
${junctionList}
${exitList}
${neighbourList}
`
    const dir = path.join(dist, r.ref)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), shell(title, desc, `${SITE}/${r.ref}/`, body, `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`))
    urls.push(`${SITE}/${r.ref}/`)
  }

  // Index of every road.
  const A = roads.filter((r) => r.kind === 'A').sort((a, b) => a.num - b.num)
  const N = roads.filter((r) => r.kind === 'N').sort((a, b) => a.num - b.num)
  const totalKm = roads.reduce((s, r) => s + r.km, 0)
  const indexBody = `
<div class="board"><div class="inner">
<p class="title">Wegwijzer</p>
<h1>Alle snelwegen en N-wegen</h1>
<p class="sub">${A.length} snelwegen en ${N.length} nationale N-wegen, samen ${totalKm} km. Per weg de loop, de knooppunten en de afritten.</p>
</div></div>
<div class="board"><div class="inner"><h2>Snelwegen</h2><div class="shields">${A.map(roadLink).join('')}</div></div></div>
<div class="board"><div class="inner"><h2>N-wegen</h2><div class="shields">${N.map(roadLink).join('')}</div></div></div>
<div class="board"><div class="inner"><h2>Hoe goed ken jij ze?</h2>
<p>Wegenkenner is een gratis spel: sleep de borden naar de juiste weg, vind de weg op een lege kaart of wijs het knooppunt aan. Elke dag een nieuwe puzzel.</p>
<div class="cta"><a class="btn alt" href="/#daily">Speel de puzzel van vandaag</a><a class="btn" href="/">Naar het spel</a></div>
</div></div>
`
  fs.writeFileSync(
    path.join(dist, 'wegen', 'index.html'),
    shell('Alle snelwegen en N-wegen van Nederland op de kaart | Wegenkenner', `Overzicht van alle ${A.length} snelwegen en ${N.length} nationale N-wegen van Nederland, met per weg de loop, de knooppunten en de afritten. Test daarna of je ze op de kaart kunt vinden.`, `${SITE}/wegen/`, indexBody),
  )

  fs.writeFileSync(
    path.join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`,
  )
  fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`)
  return roads.length
}

if (process.argv[1] && process.argv[1].endsWith('road-pages.mjs')) {
  const dist = path.resolve(process.argv[2] ?? 'dist')
  console.log(`wrote ${buildRoadPages(dist)} road pages into ${dist}`)
}
