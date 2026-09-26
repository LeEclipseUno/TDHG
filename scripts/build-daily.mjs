// Freezes the daily puzzles: which roads, interchanges or exits each day #N asks about.
// Mirrors the seeded picking in src/game/session.ts so day #1 stays what it was, and keeps
// every past daily stable when the map data is rebuilt. Run: node scripts/build-daily.mjs
import fs from 'node:fs'

const EPOCH = '2026-09-26'
const ROTATION = ['find', 'quiz', 'junction', 'drag', 'exit']
const DAYS = 1500
const COUNT = 10

function hashString(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function shuffle(arr, rng) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function dateKey(n) {
  const [y, m, d] = EPOCH.split('-').map(Number)
  const dt = new Date(y, m - 1, d + (n - 1))
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const roads = JSON.parse(fs.readFileSync('public/data/roads-core.json', 'utf8')).filter((r) => r.kind === 'A')
const junctions = JSON.parse(fs.readFileSync('public/data/junctions.json', 'utf8'))
const byRef = new Set(roads.map((r) => r.ref))
const exits = JSON.parse(fs.readFileSync('public/data/exits.json', 'utf8')).filter((e) => byRef.has(e.road))

const days = []
for (let n = 1; n <= DAYS; n++) {
  const mode = ROTATION[(n - 1) % ROTATION.length]
  const rng = mulberry32(hashString(`${dateKey(n)}|${mode}|A`))
  if (mode === 'junction') days.push(shuffle(junctions, rng).slice(0, COUNT).map((j) => j.name))
  else if (mode === 'exit') days.push(shuffle(exits, rng).slice(0, COUNT).map((e) => `${e.road}|${e.r}|${e.n}`))
  else days.push(shuffle(roads, rng).slice(0, COUNT).map((r) => r.ref))
}
fs.writeFileSync('public/data/daily.json', JSON.stringify({ epoch: EPOCH, rotation: ROTATION, days }))
console.log(`froze ${DAYS} dailies, #1 (${ROTATION[0]}):`, days[0].join(' '))
