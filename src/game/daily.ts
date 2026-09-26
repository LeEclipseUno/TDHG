// The daily challenge: one numbered puzzle per day, the same for everyone, plus the play streak.
import type { Tier } from '../data'
import { dateKey, marksLine, type ModeId, type Session } from './session'

export const marksOf = (s: Session) => marksLine(s)

/** Day #1 of the daily challenge. */
export const DAILY_EPOCH = '2026-09-26'
/** Modes rotate so the daily stays varied; the tier is A-roads so everyone can join. */
const ROTATION: ModeId[] = ['find', 'quiz', 'junction', 'drag', 'exit']
export const DAILY_TIER: Tier = 'A'

const DAY = 86_400_000

function localMidnight(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

export function dailyNumber(d = new Date()): number {
  return Math.floor((localMidnight(dateKey(d)) - localMidnight(DAILY_EPOCH)) / DAY) + 1
}

export function dailyMode(n = dailyNumber()): ModeId {
  return ROTATION[((n - 1) % ROTATION.length + ROTATION.length) % ROTATION.length]
}

/** Milliseconds until the next daily unlocks (local midnight). */
export function msUntilNextDaily(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  return next - now.getTime()
}

export interface DailyResult {
  score: number
  good: number
  total: number
  ms: number
  marks: string
}

const RESULTS_KEY = 'tdhg:v1:daily'
const STREAK_KEY = 'tdhg:v1:streak'

export function getDailyResult(n = dailyNumber()): DailyResult | null {
  try {
    const all = JSON.parse(localStorage.getItem(RESULTS_KEY) ?? '{}') as Record<string, DailyResult>
    return all[n] ?? null
  } catch {
    return null
  }
}

/** Stores today's result (keeps the best of the day) and advances the streak. Returns the streak. */
export function saveDailyResult(n: number, r: DailyResult): Streak {
  try {
    const all = JSON.parse(localStorage.getItem(RESULTS_KEY) ?? '{}') as Record<string, DailyResult>
    if (!all[n] || all[n].score < r.score) all[n] = r
    localStorage.setItem(RESULTS_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
  return bumpStreak()
}

export interface Streak {
  count: number
  last: string // date key of the last daily played
  best: number
}

export function getStreak(): Streak {
  try {
    const s = JSON.parse(localStorage.getItem(STREAK_KEY) ?? 'null') as Streak | null
    if (!s) return { count: 0, last: '', best: 0 }
    // A missed day breaks the streak, but we only reset when reading so the number shown is honest.
    const today = dateKey()
    const yesterday = dateKey(new Date(Date.now() - DAY))
    if (s.last !== today && s.last !== yesterday) return { count: 0, last: s.last, best: s.best }
    return s
  } catch {
    return { count: 0, last: '', best: 0 }
  }
}

function bumpStreak(): Streak {
  const s = getStreak()
  const today = dateKey()
  if (s.last === today) return s
  const yesterday = dateKey(new Date(Date.now() - DAY))
  const count = s.last === yesterday ? s.count + 1 : 1
  const next: Streak = { count, last: today, best: Math.max(s.best, count) }
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

/** App icon badge on installed apps: a dot while today's daily is still open. */
export function updateBadge() {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  try {
    if (getDailyResult()) void nav.clearAppBadge?.()
    else void nav.setAppBadge?.(1)
  } catch {
    /* ignore */
  }
}
