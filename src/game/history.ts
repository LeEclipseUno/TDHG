// Local play history: game summaries and per-label right/wrong counters. Nothing leaves the device.
import { summarize, type ModeId, type Session } from './session'
import type { Tier } from '../data'

export interface GameRecord {
  mode: ModeId
  tier: Tier
  variant: string
  score: number
  good: number
  total: number
  ms: number
  at: number
}

export interface LabelStat {
  r: number
  w: number
}

const HIST = 'tdhg:v1:history'
const LABELS = 'tdhg:v1:labels'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export function loadHistory(): GameRecord[] {
  return load<GameRecord[]>(HIST, [])
}
export function loadLabelStats(): Record<string, LabelStat> {
  return load<Record<string, LabelStat>>(LABELS, {})
}

export function recordSession(s: Session) {
  const sum = summarize(s)
  const hist = loadHistory()
  hist.push({ mode: s.mode, tier: s.tier, variant: s.variant, score: sum.score, good: sum.good + sum.partial * 0.5, total: sum.total, ms: sum.ms, at: s.finishedAt })
  save(HIST, hist.slice(-300))
  const labels = loadLabelStats()
  for (const r of s.results) {
    const st = labels[r.label] ?? { r: 0, w: 0 }
    if (r.grade === 'bad') st.w++
    else st.r++
    labels[r.label] = st
  }
  save(LABELS, labels)
}

export function clearHistory() {
  try {
    localStorage.removeItem(HIST)
    localStorage.removeItem(LABELS)
  } catch {
    /* ignore */
  }
}
