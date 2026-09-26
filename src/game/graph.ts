// Routable graph over the road network, built once from the loaded data.
// Nodes are shared coordinates (the data build keeps every point where two ways meet), edges carry length and road number.
import type { GameData, Road } from '../data'

export interface Graph {
  xs: number[]
  ys: number[]
  adj: number[][] // per node: [neighbour, edge, neighbour, edge, ...]
  edgeLen: number[]
  edgeCost: number[] // length weighted by road class, so motorways win over shortcuts
  edgeRef: (string | null)[]
  index: Map<string, number>
}

export interface RouteResult {
  path: number[] // flat [x, y, ...]
  refs: string[] // road numbers in driving order
  lengthM: number
}

const cache = new WeakMap<GameData, Graph>()

export function buildGraph(data: GameData): Graph {
  const hit = cache.get(data)
  if (hit) return hit
  const index = new Map<string, number>()
  const xs: number[] = []
  const ys: number[] = []
  const adj: number[][] = []
  const edgeLen: number[] = []
  const edgeCost: number[] = []
  const edgeRef: (string | null)[] = []
  const COST: Record<string, number> = { A: 1, N: 1.45, P: 1.9, L: 1.25 }
  const node = (x: number, y: number) => {
    const k = x + ',' + y
    let i = index.get(k)
    if (i === undefined) {
      i = xs.length
      index.set(k, i)
      xs.push(x)
      ys.push(y)
      adj.push([])
    }
    return i
  }
  const addLine = (line: number[], ref: string | null, cls: string) => {
    let prev = node(line[0], line[1])
    for (let i = 2; i < line.length; i += 2) {
      const n = node(line[i], line[i + 1])
      if (n === prev) continue
      const e = edgeLen.length
      const len = Math.hypot(line[i] - line[i - 2], line[i + 1] - line[i - 1])
      edgeLen.push(len)
      edgeCost.push(len * COST[cls])
      edgeRef.push(ref)
      adj[prev].push(n, e)
      adj[n].push(prev, e)
      prev = n
    }
  }
  for (const r of data.roads) for (const line of r.lines) addLine(line, r.ref, r.kind)
  for (const lk of data.links) addLine(lk.l, null, 'L')
  const g = { xs, ys, adj, edgeLen, edgeCost, edgeRef, index }
  cache.set(data, g)
  return g
}

/** Nearest graph node to a point: the closest vertex of the nearest road. */
export function snap(data: GameData, g: Graph, x: number, y: number, maxDist = 25000, filter?: (r: Road) => boolean): number | null {
  const hit = data.index.nearest(x, y, maxDist, filter)
  if (!hit) return null
  let best = -1
  let bestD = Infinity
  for (const line of hit.road.lines) {
    for (let i = 0; i < line.length; i += 2) {
      const d = Math.hypot(line[i] - hit.px, line[i + 1] - hit.py)
      if (d < bestD) {
        bestD = d
        best = g.index.get(line[i] + ',' + line[i + 1]) ?? -1
      }
    }
  }
  return best >= 0 ? best : null
}

class Heap {
  private k: number[] = []
  private v: number[] = []
  get size() {
    return this.k.length
  }
  push(key: number, val: number) {
    const k = this.k
    const v = this.v
    k.push(key)
    v.push(val)
    let i = k.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (k[p] <= k[i]) break
      ;[k[p], k[i]] = [k[i], k[p]]
      ;[v[p], v[i]] = [v[i], v[p]]
      i = p
    }
  }
  pop(): [number, number] {
    const k = this.k
    const v = this.v
    const top: [number, number] = [k[0], v[0]]
    const lk = k.pop()!
    const lv = v.pop()!
    if (k.length) {
      k[0] = lk
      v[0] = lv
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < k.length && k[l] < k[m]) m = l
        if (r < k.length && k[r] < k[m]) m = r
        if (m === i) break
        ;[k[m], k[i]] = [k[i], k[m]]
        ;[v[m], v[i]] = [v[i], v[m]]
        i = m
      }
    }
    return top
  }
}

/** Shortest path by length (direction of travel is ignored; only the sequence of road numbers matters for the game). */
export function route(g: Graph, from: number, to: number): RouteResult | null {
  const n = g.xs.length
  const dist = new Float64Array(n).fill(Infinity)
  const prevNode = new Int32Array(n).fill(-1)
  const prevEdge = new Int32Array(n).fill(-1)
  const done = new Uint8Array(n)
  const heap = new Heap()
  dist[from] = 0
  heap.push(0, from)
  while (heap.size) {
    const [d, u] = heap.pop()
    if (done[u]) continue
    done[u] = 1
    if (u === to) break
    const a = g.adj[u]
    for (let i = 0; i < a.length; i += 2) {
      const v = a[i]
      const e = a[i + 1]
      const nd = d + g.edgeCost[e]
      if (nd < dist[v]) {
        dist[v] = nd
        prevNode[v] = u
        prevEdge[v] = e
        heap.push(nd, v)
      }
    }
  }
  if (!isFinite(dist[to])) return null
  const nodes: number[] = []
  const edges: number[] = []
  for (let u = to; u !== -1; u = prevNode[u]) {
    nodes.push(u)
    if (prevEdge[u] >= 0) edges.push(prevEdge[u])
  }
  nodes.reverse()
  edges.reverse()
  const path: number[] = []
  for (const u of nodes) path.push(g.xs[u], g.ys[u])
  const lengthM = edges.reduce((a, e) => a + g.edgeLen[e], 0)
  // Runs of the same road number; short detours over another number are dropped as noise.
  const runs: { ref: string; len: number }[] = []
  for (const e of edges) {
    const ref = g.edgeRef[e]
    if (!ref) continue
    const last = runs[runs.length - 1]
    if (last && last.ref === ref) last.len += g.edgeLen[e]
    else runs.push({ ref, len: g.edgeLen[e] })
  }
  const kept = runs.filter((r, i) => r.len >= 1500 || i === 0 || i === runs.length - 1)
  const refs: string[] = []
  for (const r of kept) if (refs[refs.length - 1] !== r.ref) refs.push(r.ref)
  return { path, refs, lengthM }
}

/** Longest common subsequence length, used to score an answered road sequence. */
export function lcs(a: string[], b: string[]): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  return dp[a.length][b.length]
}
