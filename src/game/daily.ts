// The daily challenge: one numbered puzzle per day, the same for everyone, plus the play streak.
import type { Tier } from '../data'
import { dateKey, marksLine, type ModeId, type Session } from './session'
import { hasPlus } from './premium'

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

/** Stores the first result of a daily. Only today's daily advances the streak; archive days just get recorded. */
export function saveDailyResult(n: number, r: DailyResult): Streak {
  try {
    const all = JSON.parse(localStorage.getItem(RESULTS_KEY) ?? '{}') as Record<string, DailyResult>
    if (!all[n]) all[n] = r
    localStorage.setItem(RESULTS_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
  return n === dailyNumber() ? bumpStreak() : getStreak()
}

/** Every daily played so far, keyed by number. */
export function allDailyResults(): Record<string, DailyResult> {
  try {
    return JSON.parse(localStorage.getItem(RESULTS_KEY) ?? '{}') as Record<string, DailyResult>
  } catch {
    return {}
  }
}

/** Local date of daily #n. */
export function dailyDate(n: number): Date {
  const [y, m, d] = DAILY_EPOCH.split('-').map(Number)
  return new Date(y, m - 1, d + (n - 1))
}

export interface Streak {
  count: number
  last: string // date key of the last daily played
  best: number
  /** Month (YYYY-MM) in which the Plus streak freeze was used, if any. */
  freeze?: string
  /** Year in which the Plus streak repair was used, if any. */
  repair?: string
}

/** A broken streak that Plus may restore: once a year, within two weeks, three days or longer. */
export function canRepairStreak(): { days: number } | null {
  try {
    const s = JSON.parse(localStorage.getItem(STREAK_KEY) ?? 'null') as Streak | null
    if (!s || s.count < 3 || !s.last) return null
    const today = dateKey()
    const yesterday = dateKey(new Date(Date.now() - DAY))
    if (s.last === today || s.last === yesterday) return null
    const age = (localMidnight(today) - localMidnight(s.last)) / DAY
    if (age > 14) return null
    if (s.repair === today.slice(0, 4)) return null
    return { days: s.count }
  } catch {
    return null
  }
}

/** Moves the streak up to yesterday so today's daily continues it. */
export function repairStreak(): Streak | null {
  try {
    const s = JSON.parse(localStorage.getItem(STREAK_KEY) ?? 'null') as Streak | null
    if (!s) return null
    const next: Streak = { ...s, last: dateKey(new Date(Date.now() - DAY)), repair: dateKey().slice(0, 4) }
    localStorage.setItem(STREAK_KEY, JSON.stringify(next))
    return next
  } catch {
    return null
  }
}

const PERSONAL_KEY = 'tdhg:v1:personal'
export interface PersonalResult {
  date: string
  score: number
  good: number
  total: number
}
export function getPersonal(): PersonalResult | null {
  try {
    const r = JSON.parse(localStorage.getItem(PERSONAL_KEY) ?? 'null') as PersonalResult | null
    return r && r.date === dateKey() ? r : null
  } catch {
    return null
  }
}
export function savePersonal(r: Omit<PersonalResult, 'date'>) {
  try {
    localStorage.setItem(PERSONAL_KEY, JSON.stringify({ ...r, date: dateKey() }))
  } catch {
    /* ignore */
  }
}

const monthOf = (key: string) => key.slice(0, 7)

export function getStreak(): Streak {
  try {
    const s = JSON.parse(localStorage.getItem(STREAK_KEY) ?? 'null') as Streak | null
    if (!s) return { count: 0, last: '', best: 0 }
    // A missed day breaks the streak, but we only reset when reading so the number shown is honest.
    const today = dateKey()
    const yesterday = dateKey(new Date(Date.now() - DAY))
    if (s.last === today || s.last === yesterday) return s
    // Plus: one missed day per month is forgiven. The streak is moved up to yesterday and the freeze is spent.
    const twoAgo = dateKey(new Date(Date.now() - 2 * DAY))
    if (s.last === twoAgo && s.freeze !== monthOf(today) && hasPlus({ signedIn: false })) {
      const thawed: Streak = { ...s, last: yesterday, freeze: monthOf(today) }
      try {
        localStorage.setItem(STREAK_KEY, JSON.stringify(thawed))
      } catch {
        /* ignore */
      }
      return thawed
    }
    return { count: 0, last: s.last, best: s.best, freeze: s.freeze, repair: s.repair }
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
  const next: Streak = { count, last: today, best: Math.max(s.best, count), freeze: s.freeze, repair: s.repair }
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
