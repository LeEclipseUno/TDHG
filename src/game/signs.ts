// Direction-sign questions: what a real blue sign at an interchange would say, built from the map data.
import type { GameData, Junction, Place, Road } from '../data'
import { shuffle } from './session'

export interface SignQuestion {
  road: Road
  junction: Junction
  /** Destinations straight ahead, nearest first. */
  ahead: string[]
  /** The crossing road and the destination its exit points to. */
  exit: { road: Road; to: string } | null
}

interface Along {
  cum: number[]
  main: number[]
}

function alongData(road: Road): Along {
  const main = road.lines.reduce((a, b) => (b.length > a.length ? b : a))
  const cum = [0]
  for (let i = 2; i < main.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(main[i] - main[i - 2], main[i + 1] - main[i - 1]))
  return { cum, main }
}

/** Position along the road (metres from its start) and distance from it, for a point. */
function project(a: Along, x: number, y: number): { t: number; d: number } {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < a.main.length; i += 2) {
    const d = Math.hypot(a.main[i] - x, a.main[i + 1] - y)
    if (d < bestD) {
      bestD = d
      best = i / 2
    }
  }
  return { t: a.cum[best], d: bestD }
}

/** Cities within reach of the road, ordered along it. */
function citiesAlong(data: GameData, road: Road, a: Along): { p: Place; t: number }[] {
  const out: { p: Place; t: number }[] = []
  for (const p of data.places) {
    if (!p.c) continue
    if (p.x < road.bbox[0] - 8000 || p.x > road.bbox[2] + 8000 || p.y < road.bbox[1] - 8000 || p.y > road.bbox[3] + 8000) continue
    const pr = project(a, p.x, p.y)
    if (pr.d <= 7000) out.push({ p, t: pr.t })
  }
  return out.sort((u, v) => u.t - v.t)
}

/** Builds n sign questions for the roads given, skipping roads without a usable interchange. */
export function buildSignQuestions(data: GameData, roads: Road[], rng: () => number, n: number): SignQuestion[] {
  const out: SignQuestion[] = []
  const alongCache = new Map<string, Along>()
  const along = (r: Road) => {
    let a = alongCache.get(r.ref)
    if (!a) {
      a = alongData(r)
      alongCache.set(r.ref, a)
    }
    return a
  }
  for (const road of roads) {
    if (out.length >= n) break
    const a = along(road)
    const cities = citiesAlong(data, road, a)
    const junctions = shuffle(
      data.junctions.filter((j) => j.roads.includes(road.ref) && j.roads.some((ref) => ref !== road.ref && data.byRef.get(ref)?.kind !== 'P' && data.byRef.has(ref))),
      rng,
    )
    let made = false
    for (const junction of junctions) {
      const tj = project(a, junction.x, junction.y).t
      const forward = rng() < 0.5
      const aheadCities = (forward ? cities.filter((c) => c.t > tj + 3000) : cities.filter((c) => c.t < tj - 3000).reverse()).map((c) => c.p.n)
      const ahead = [...new Set(aheadCities)].slice(0, 2)
      if (ahead.length === 0) continue
      const crossRef = shuffle(junction.roads.filter((ref) => ref !== road.ref && data.byRef.has(ref) && data.byRef.get(ref)!.kind !== 'P'), rng)[0]
      const cross = crossRef ? data.byRef.get(crossRef) : undefined
      let exit: SignQuestion['exit'] = null
      if (cross) {
        const ca = along(cross)
        const cc = citiesAlong(data, cross, ca)
        const tc = project(ca, junction.x, junction.y).t
        const side = rng() < 0.5
        const to = (side ? cc.filter((c) => c.t > tc + 3000) : cc.filter((c) => c.t < tc - 3000).reverse()).map((c) => c.p.n).filter((name) => !ahead.includes(name))[0]
        if (to) exit = { road: cross, to }
      }
      out.push({ road, junction, ahead, exit })
      made = true
      break
    }
    if (!made) continue
  }
  return out
}
