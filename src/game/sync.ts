// Cloud save: the browser's local state (streak, daily results, records, stats, learn progress, settings)
// merged with the copy stored for a signed-in account, so progress follows the player across devices.
import { isSignedIn, loadRemoteState, saveRemoteState } from './backend'

const PREFIX = 'tdhg:v1:'
const EXTRA = ['tdhg:lang']
type State = Record<string, string>

export function collectLocal(): State {
  const out: State = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k.startsWith(PREFIX) || EXTRA.includes(k))) out[k] = localStorage.getItem(k) ?? ''
    }
  } catch {
    /* ignore */
  }
  return out
}

function json<T>(s: string | undefined, fallback: T): T {
  if (!s) return fallback
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}

/** Union of both sides: the better score, the longer streak, the later review, never a loss. */
export function merge(local: State, remote: State): State {
  const out: State = { ...remote, ...local }
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
  for (const k of keys) {
    const l = local[k]
    const r = remote[k]
    if (l === undefined || r === undefined || l === r) continue
    if (k === PREFIX + 'daily') {
      const a = json<Record<string, { score: number }>>(l, {})
      const b = json<Record<string, { score: number }>>(r, {})
      const m = { ...b }
      for (const [day, v] of Object.entries(a)) if (!m[day] || m[day].score < v.score) m[day] = v
      out[k] = JSON.stringify(m)
    } else if (k === PREFIX + 'streak') {
      const a = json<{ count: number; last: string; best: number; freeze?: string; repair?: string }>(l, { count: 0, last: '', best: 0 })
      const b = json<{ count: number; last: string; best: number; freeze?: string; repair?: string }>(r, { count: 0, last: '', best: 0 })
      const later = a.last >= b.last ? a : b
      const freeze = [a.freeze, b.freeze].filter(Boolean).sort().pop()
      const repair = [a.repair, b.repair].filter(Boolean).sort().pop()
      out[k] = JSON.stringify({ count: a.last === b.last ? Math.max(a.count, b.count) : later.count, last: later.last, best: Math.max(a.best, b.best), ...(freeze ? { freeze } : {}), ...(repair ? { repair } : {}) })
    } else if (k.startsWith(PREFIX + 'best:')) {
      const a = json<{ score: number }>(l, { score: 0 })
      const b = json<{ score: number }>(r, { score: 0 })
      out[k] = a.score >= b.score ? l : r
    } else if (k === PREFIX + 'history') {
      const a = json<{ at: number; mode: string }[]>(l, [])
      const b = json<{ at: number; mode: string }[]>(r, [])
      const seen = new Set<string>()
      const all = [...a, ...b].filter((g) => {
        const id = g.at + ':' + g.mode
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
      all.sort((x, y) => x.at - y.at)
      out[k] = JSON.stringify(all.slice(-300))
    } else if (k === PREFIX + 'labels') {
      const a = json<Record<string, { r: number; w: number }>>(l, {})
      const b = json<Record<string, { r: number; w: number }>>(r, {})
      const m = { ...b }
      for (const [label, v] of Object.entries(a)) m[label] = m[label] ? { r: Math.max(m[label].r, v.r), w: Math.max(m[label].w, v.w) } : v
      out[k] = JSON.stringify(m)
    } else if (k === PREFIX + 'badges') {
      const a = json<Record<string, number>>(l, {})
      const b = json<Record<string, number>>(r, {})
      const m = { ...b }
      for (const [id, at] of Object.entries(a)) m[id] = m[id] ? Math.min(m[id], at) : at
      out[k] = JSON.stringify(m)
    } else if (k === PREFIX + 'fsrs') {
      const a = json<Record<string, { last: number }>>(l, {})
      const b = json<Record<string, { last: number }>>(r, {})
      const m = { ...b }
      for (const [card, v] of Object.entries(a)) if (!m[card] || m[card].last < v.last) m[card] = v
      out[k] = JSON.stringify(m)
    }
    // settings, nickname, language: the device wins (already in out)
  }
  return out
}

let lastPushed = ''

/** Pull, merge, write back locally and push. Returns true when anything came in from the cloud. */
export async function syncNow(): Promise<boolean> {
  if (!(await isSignedIn())) return false
  const remote = (await loadRemoteState()) ?? {}
  const local = collectLocal()
  const merged = merge(local, remote)
  let changed = false
  try {
    for (const [k, v] of Object.entries(merged)) {
      if (localStorage.getItem(k) !== v) {
        localStorage.setItem(k, v)
        changed = true
      }
    }
  } catch {
    /* ignore */
  }
  const payload = JSON.stringify(merged)
  if (payload !== lastPushed) {
    lastPushed = payload
    await saveRemoteState(merged)
  }
  return changed
}

let timer = 0
/** Push soon after a change, without hammering the server. */
export function pushSoon() {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    void syncNow()
  }, 2000)
}
