// Sanity checks after a map data rebuild. Exits non-zero when something a player would notice is off.
// Run: node scripts/check-data.mjs   (also part of: npm run data)
import fs from 'node:fs'

const load = (n) => JSON.parse(fs.readFileSync(`public/data/${n}`, 'utf8'))
const roads = load('roads-core.json')
const junctions = load('junctions.json')
const exits = load('exits.json')
const daily = load('daily.json')
const notes = JSON.parse(fs.readFileSync('scripts/road-notes.json', 'utf8'))
const jnotes = JSON.parse(fs.readFileSync('scripts/junction-notes.json', 'utf8'))

let problems = 0
const warn = (msg) => {
  problems++
  console.log('PROBLEM:', msg)
}

// 1. Frozen dailies: every pick must still exist, otherwise a past puzzle changes for players.
const refs = new Set(roads.map((r) => r.ref))
const names = new Set(junctions.map((j) => j.name))
const exitKeys = new Set(exits.map((e) => `${e.road}|${e.r}|${e.n}`))
const today = Math.floor((Date.now() - Date.parse(daily.epoch + 'T00:00:00')) / 86_400_000) + 1
daily.days.forEach((picks, i) => {
  const n = i + 1
  const mode = daily.rotation[i % daily.rotation.length]
  const pool = mode === 'junction' ? names : mode === 'exit' ? exitKeys : refs
  const missing = picks.filter((p) => !pool.has(p))
  if (missing.length) warn(`daily #${n} (${mode}${n <= today ? ', already played' : ''}) lost picks: ${missing.join(', ')}`)
})

// 2. Road notes: every playable road should have its paragraph on the landing page.
const playable = roads.filter((r) => r.kind === 'A' || r.kind === 'N')
const noNote = playable.filter((r) => !notes[r.ref]).map((r) => r.ref)
if (noNote.length) warn(`roads without a note in scripts/road-notes.json: ${noNote.join(' ')}`)
const orphanNotes = Object.keys(notes).filter((ref) => !refs.has(ref))
if (orphanNotes.length) console.log('note: notes for roads no longer in the data:', orphanNotes.join(' '))

const noJNote = junctions.filter((j) => !jnotes[j.name]).map((j) => j.name)
if (noJNote.length) warn(`interchanges without a note in scripts/junction-notes.json: ${noJNote.join(', ')}`)

// 3. Rough plausibility of the data itself.
if (playable.length < 60) warn(`only ${playable.length} playable roads, expected around 73`)
if (junctions.length < 90) warn(`only ${junctions.length} interchanges, expected around 107`)
if (exits.length < 500) warn(`only ${exits.length} exits, expected 600+`)
for (const r of playable) if (!r.lines.length || r.km < 1) warn(`${r.ref} has no geometry`)
const dupJunction = junctions.map((j) => j.name).filter((n, i, a) => a.indexOf(n) !== i)
if (dupJunction.length) warn(`duplicate interchange names: ${[...new Set(dupJunction)].join(', ')}`)

console.log(problems ? `${problems} problem(s) found` : `data ok: ${playable.length} roads, ${junctions.length} interchanges, ${exits.length} exits, ${daily.days.length} frozen dailies`)
process.exit(problems ? 1 : 0)
