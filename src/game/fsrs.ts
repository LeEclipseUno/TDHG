// FSRS-5 spaced repetition scheduler (Free Spaced Repetition Scheduler).
// Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
// A card has a difficulty (1..10), a stability (days until recall probability drops to 90%) and a due time.

export type Rating = 1 | 2 | 3 | 4 // Again, Hard, Good, Easy

export interface CardState {
  d: number // difficulty
  s: number // stability in days
  due: number // ms timestamp
  last: number // ms timestamp of the last review
  reps: number
  lapses: number
}

const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621]
const DECAY = -0.5
const FACTOR = 19 / 81
const DAY = 86_400_000
const RELEARN_MS = 10 * 60_000
export const RETENTION = 0.9

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Probability of recall after `elapsedDays` for a card with stability `s`. */
export function retrievability(elapsedDays: number, s: number): number {
  return Math.pow(1 + (FACTOR * elapsedDays) / s, DECAY)
}

function initStability(g: Rating): number {
  return Math.max(0.1, W[g - 1])
}

function initDifficulty(g: Rating): number {
  return clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10)
}

function nextDifficulty(d: number, g: Rating): number {
  const delta = -W[6] * (g - 3)
  const damped = d + (delta * (10 - d)) / 9
  return clamp(W[7] * initDifficulty(4) + (1 - W[7]) * damped, 1, 10)
}

function nextRecallStability(d: number, s: number, r: number, g: Rating): number {
  const hard = g === 2 ? W[15] : 1
  const easy = g === 4 ? W[16] : 1
  return s * (Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy + 1)
}

function nextForgetStability(d: number, s: number, r: number): number {
  return Math.min(W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)), s)
}

function shortTermStability(s: number, g: Rating): number {
  return s * Math.exp(W[17] * (g - 3 + W[18]))
}

/** Days until recall probability drops to the target retention. */
export function intervalDays(s: number, retention = RETENTION): number {
  return Math.max(1, Math.round((s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1)))
}

/** Apply a review and return the new card state. `card` is null for a first review. */
export function review(card: CardState | null, g: Rating, now = Date.now()): CardState {
  let d: number
  let s: number
  if (!card) {
    d = initDifficulty(g)
    s = initStability(g)
  } else {
    const elapsed = (now - card.last) / DAY
    if (elapsed < 1) {
      s = shortTermStability(card.s, g)
    } else {
      const r = retrievability(elapsed, card.s)
      s = g === 1 ? nextForgetStability(card.d, card.s, r) : nextRecallStability(card.d, card.s, r, g)
    }
    d = nextDifficulty(card.d, g)
  }
  s = Math.max(0.1, s)
  const due = g === 1 ? now + RELEARN_MS : now + intervalDays(s) * DAY
  return { d, s, due, last: now, reps: (card?.reps ?? 0) + 1, lapses: (card?.lapses ?? 0) + (g === 1 ? 1 : 0) }
}

/** Human readable time until the next review. */
export function formatDue(state: CardState, now = Date.now(), lang: 'nl' | 'en' = 'nl'): string {
  const ms = state.due - now
  if (ms < DAY) {
    const min = Math.max(1, Math.round(ms / 60_000))
    return `${min} min`
  }
  const days = Math.round(ms / DAY)
  if (days < 30) return `${days} ${lang === 'nl' ? (days === 1 ? 'dag' : 'dagen') : days === 1 ? 'day' : 'days'}`
  const months = Math.round(days / 30)
  return `${months} ${lang === 'nl' ? (months === 1 ? 'maand' : 'maanden') : months === 1 ? 'month' : 'months'}`
}
