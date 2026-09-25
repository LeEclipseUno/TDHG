// Map data types, runtime loader and a small spatial index for hit-testing.
// Coordinates are metres on a local grid (x grows east, y grows south), produced by scripts/build-data.py.

export type RoadKind = 'A' | 'N' | 'P' // A = motorway, N = national N-road (1-2 digits), P = provincial N-road (3 digits)
export type Tier = 'A' | 'AN' | 'ALL'

export interface Road {
  ref: string
  kind: RoadKind
  num: number
  km: number
  bbox: [number, number, number, number]
  anchor: [number, number]
  lines: number[][] // flat [x0,y0,x1,y1,...] per polyline
}

export interface Junction {
  name: string
  x: number
  y: number
  roads: string[]
}

/** A ramp or connector road of an interchange. k: A = motorway link, N = trunk link. */
export interface Link {
  k: 'A' | 'N'
  b: [number, number, number, number]
  l: number[]
}

export interface LandPoly {
  name: string
  rings: number[][]
}

export interface Bounds {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface NearestRoad {
  road: Road
  dist: number
  px: number
  py: number
}

export function tierIncludes(tier: Tier, kind: RoadKind): boolean {
  if (kind === 'A') return true
  if (kind === 'N') return tier !== 'A'
  return tier === 'ALL'
}

const CELL = 2500

interface Seg {
  r: number
  ax: number
  ay: number
  bx: number
  by: number
}

export class SpatialIndex {
  private cells = new Map<string, Seg[]>()
  private roads: Road[]

  constructor(roads: Road[]) {
    this.roads = roads
    roads.forEach((road, r) => {
      for (const line of road.lines) {
        for (let i = 0; i + 3 < line.length; i += 2) {
          const seg: Seg = { r, ax: line[i], ay: line[i + 1], bx: line[i + 2], by: line[i + 3] }
          const i0 = Math.floor(Math.min(seg.ax, seg.bx) / CELL)
          const i1 = Math.floor(Math.max(seg.ax, seg.bx) / CELL)
          const j0 = Math.floor(Math.min(seg.ay, seg.by) / CELL)
          const j1 = Math.floor(Math.max(seg.ay, seg.by) / CELL)
          for (let ci = i0; ci <= i1; ci++) {
            for (let cj = j0; cj <= j1; cj++) {
              const key = ci + ',' + cj
              let arr = this.cells.get(key)
              if (!arr) {
                arr = []
                this.cells.set(key, arr)
              }
              arr.push(seg)
            }
          }
        }
      }
    })
  }

  /** Nearest road to (x, y) within maxDist metres, optionally filtered. */
  nearest(x: number, y: number, maxDist: number, filter?: (r: Road) => boolean): NearestRoad | null {
    const i0 = Math.floor((x - maxDist) / CELL)
    const i1 = Math.floor((x + maxDist) / CELL)
    const j0 = Math.floor((y - maxDist) / CELL)
    const j1 = Math.floor((y + maxDist) / CELL)
    let best: NearestRoad | null = null
    let bestD = maxDist
    for (let ci = i0; ci <= i1; ci++) {
      for (let cj = j0; cj <= j1; cj++) {
        const arr = this.cells.get(ci + ',' + cj)
        if (!arr) continue
        for (const s of arr) {
          const road = this.roads[s.r]
          if (filter && !filter(road)) continue
          const dx = s.bx - s.ax
          const dy = s.by - s.ay
          const l2 = dx * dx + dy * dy
          let t = l2 === 0 ? 0 : ((x - s.ax) * dx + (y - s.ay) * dy) / l2
          t = Math.max(0, Math.min(1, t))
          const px = s.ax + t * dx
          const py = s.ay + t * dy
          const d = Math.hypot(x - px, y - py)
          if (d < bestD) {
            bestD = d
            best = { road, dist: d, px, py }
          }
        }
      }
    }
    return best
  }
}

export interface GameData {
  roads: Road[]
  links: Link[]
  land: LandPoly[]
  junctions: Junction[]
  byRef: Map<string, Road>
  world: Bounds
  index: SpatialIndex
}

/** Polylines are stored delta encoded: [x0, y0, dx1, dy1, ...]. */
function decode(line: number[]): number[] {
  const out = new Array<number>(line.length)
  out[0] = line[0]
  out[1] = line[1]
  for (let i = 2; i < line.length; i += 2) {
    out[i] = out[i - 2] + line[i]
    out[i + 1] = out[i - 1] + line[i + 1]
  }
  return out
}

export async function loadData(): Promise<GameData> {
  const base = import.meta.env.BASE_URL
  const get = async <T,>(name: string): Promise<T> => {
    const res = await fetch(`${base}data/${name}`)
    if (!res.ok) throw new Error(`Failed to load ${name}: ${res.status}`)
    return (await res.json()) as T
  }
  const [roads, links, land, junctions] = await Promise.all([get<Road[]>('roads.json'), get<Link[]>('links.json'), get<LandPoly[]>('land.json'), get<Junction[]>('junctions.json')])
  for (const r of roads) r.lines = r.lines.map(decode)
  for (const lk of links) lk.l = decode(lk.l)
  const world: Bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  for (const poly of land) {
    for (const ring of poly.rings) {
      for (let i = 0; i < ring.length; i += 2) {
        world.x0 = Math.min(world.x0, ring[i])
        world.x1 = Math.max(world.x1, ring[i])
        world.y0 = Math.min(world.y0, ring[i + 1])
        world.y1 = Math.max(world.y1, ring[i + 1])
      }
    }
  }
  return { roads, links, land, junctions, byRef: new Map(roads.map((r) => [r.ref, r])), world, index: new SpatialIndex(roads) }
}

export function roadsForTier(data: GameData, tier: Tier): Road[] {
  return data.roads.filter((r) => tierIncludes(tier, r.kind))
}

export function boundsOfPoints(pts: [number, number][], pad = 0): Bounds {
  const b: Bounds = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  for (const [x, y] of pts) {
    b.x0 = Math.min(b.x0, x - pad)
    b.x1 = Math.max(b.x1, x + pad)
    b.y0 = Math.min(b.y0, y - pad)
    b.y1 = Math.max(b.y1, y + pad)
  }
  return b
}
