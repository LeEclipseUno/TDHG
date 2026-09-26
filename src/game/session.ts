import type { GameData, Junction, Road, Tier } from '../data'
import { roadsForTier } from '../data'
import { translate, type Lang } from '../i18n'
import type { Deck } from './learn'

export type ModeId = 'drag' | 'find' | 'junction' | 'quiz' | 'exit' | 'route'
export const MODES: ModeId[] = ['drag', 'find', 'junction', 'quiz', 'exit', 'route']
export type Variant = 'normal' | 'nozoom' | 'blind' | 'blitz'
export const VARIANTS: Variant[] = ['normal', 'nozoom', 'blind', 'blitz']
/** Score multiplier for the harder variants. */
export const VARIANT_MULT: Record<Variant, number> = { normal: 1, nozoom: 1.25, blind: 1.5, blitz: 1 }
export const BLITZ_MS = 60_000
export const BLITZ_BONUS_MS = 4_000

export type Grade = 'good' | 'partial' | 'bad'

export interface QuestionResult {
  label: string
  grade: Grade
  points: number
  ms: number
  detail?: string
}

export interface Settings {
  tier: Tier
  timer: boolean
  daily: boolean
  learnDeck: Deck
  sound: boolean
  variant: Variant
}

export interface Session {
  mode: ModeId
  tier: Tier
  timer: boolean
  daily: boolean
  seed: number
  variant: Variant
  /** Score of the player who sent a challenge link, when playing one. */
  challenge?: number
  /** Set when this is today's daily challenge. */
  dailyNumber?: number
  startedAt: number
  finishedAt: number
  results: QuestionResult[]
}

export const QUESTION_COUNT = 10
/** Seconds. drag is a total budget, the others are per question. */
export const TIME_LIMITS: Record<ModeId, number> = { find: 20, quiz: 15, junction: 30, drag: 180, exit: 25, route: 0 }
export const HINT_COST = 30

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function dateKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function dailySeed(mode: ModeId, tier: Tier): number {
  return hashString(`${dateKey()}|${mode}|${tier}`)
}

export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function newSession(mode: ModeId, s: Settings, challenge?: Challenge, daily?: number): Session {
  if (daily) {
    return { mode, tier: 'A', timer: true, daily: true, seed: dailySeed(mode, 'A'), variant: 'normal', dailyNumber: daily, startedAt: Date.now(), finishedAt: 0, results: [] }
  }
  if (challenge) {
    return { mode: challenge.mode, tier: challenge.tier, timer: challenge.timer, daily: false, seed: challenge.seed, variant: challenge.variant, challenge: challenge.score, startedAt: Date.now(), finishedAt: 0, results: [] }
  }
  const seed = s.daily ? dailySeed(mode, s.tier) : Math.floor(Math.random() * 2 ** 31)
  return { mode, tier: s.tier, timer: s.timer, daily: s.daily, seed, variant: mode === 'route' || mode === 'drag' ? (s.variant === 'blitz' ? 'normal' : s.variant) : s.variant, startedAt: Date.now(), finishedAt: 0, results: [] }
}

export interface Challenge {
  mode: ModeId
  tier: Tier
  timer: boolean
  seed: number
  score: number
  variant: Variant
}

/** Challenge links carry mode, tier, timer, seed, score and variant in one query parameter. */
export function challengeParam(s: Session): string {
  return [s.mode, s.tier, s.timer ? 1 : 0, s.seed, summarize(s).score, s.variant].join('.')
}

export function parseChallenge(search: string): Challenge | null {
  const c = new URLSearchParams(search).get('c')
  if (!c) return null
  const [mode, tier, timer, seed, score, variant] = c.split('.')
  if (!MODES.includes(mode as ModeId) || !['A', 'AN', 'ALL'].includes(tier)) return null
  const v = VARIANTS.includes(variant as Variant) ? (variant as Variant) : 'normal'
  const n = Number(seed)
  const sc = Number(score)
  if (!Number.isFinite(n) || !Number.isFinite(sc)) return null
  return { mode: mode as ModeId, tier: tier as Tier, timer: timer === '1', seed: n, score: sc, variant: v }
}

/** Pick n roads for a tier. Mixes kinds so that the harder tiers do not drown in provincial roads. */
export function pickRoads(data: GameData, tier: Tier, n: number, rng: () => number): Road[] {
  const pool = roadsForTier(data, tier)
  if (tier === 'A') return shuffle(pool, rng).slice(0, n)
  const a = shuffle(pool.filter((r) => r.kind === 'A'), rng)
  const nn = shuffle(pool.filter((r) => r.kind === 'N'), rng)
  const p = shuffle(pool.filter((r) => r.kind === 'P'), rng)
  const wantA = Math.round(n * (tier === 'AN' ? 0.6 : 0.4))
  const wantN = tier === 'AN' ? n - wantA : Math.round(n * 0.25)
  const picked = [...a.slice(0, wantA), ...nn.slice(0, wantN), ...p.slice(0, n - wantA - wantN)]
  return shuffle(picked, rng).slice(0, n)
}

export function pickJunctions(data: GameData, n: number, rng: () => number): Junction[] {
  return shuffle(data.junctions, rng).slice(0, n)
}

/** Four options for the quiz: the target plus three lookalikes (close numbers, same colour). */
export function quizOptions(data: GameData, tier: Tier, target: Road, rng: () => number): Road[] {
  const pool = roadsForTier(data, tier).filter((r) => r.ref !== target.ref)
  const sameColour = pool.filter((r) => (r.kind === 'A') === (target.kind === 'A'))
  const byCloseness = sameColour.slice().sort((x, y) => Math.abs(x.num - target.num) - Math.abs(y.num - target.num))
  const near = shuffle(byCloseness.slice(0, 8), rng).slice(0, 2)
  const rest = shuffle(pool.filter((r) => !near.includes(r)), rng)
  const opts = [target, ...near]
  for (const r of rest) {
    if (opts.length >= 4) break
    opts.push(r)
  }
  return shuffle(opts, rng)
}

export function junctionPoints(distM: number): { points: number; grade: Grade } {
  if (distM <= 800) return { points: 100, grade: 'good' }
  if (distM <= 2000) return { points: 80, grade: 'good' }
  if (distM <= 5000) return { points: 55, grade: 'partial' }
  if (distM <= 10000) return { points: 30, grade: 'partial' }
  if (distM <= 20000) return { points: 10, grade: 'bad' }
  return { points: 0, grade: 'bad' }
}

/** Bonus for answering quickly: up to 50 points, linear in the remaining time. */
export function timeBonus(remainingMs: number, limitMs: number): number {
  if (limitMs <= 0) return 0
  return Math.round((Math.max(0, remainingMs) / limitMs) * 50)
}

export function streakBonus(results: QuestionResult[]): number {
  let streak = 0
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i].grade === 'good') streak++
    else break
  }
  return streak >= 2 ? Math.min(streak, 5) * 10 : 0
}

export interface Summary {
  score: number
  good: number
  partial: number
  bad: number
  total: number
  ms: number
  accuracy: number
}

export function summarize(s: Session): Summary {
  const score = s.results.reduce((a, r) => a + r.points, 0)
  const good = s.results.filter((r) => r.grade === 'good').length
  const partial = s.results.filter((r) => r.grade === 'partial').length
  const total = s.results.length
  return { score, good, partial, bad: total - good - partial, total, ms: Math.max(0, s.finishedAt - s.startedAt), accuracy: total ? (good + partial * 0.5) / total : 0 }
}

/** Compact result marks for sharing: check, tilde, cross. Plain characters, no emoji. */
export function marksLine(s: Session): string {
  return s.results.map((r) => (r.grade === 'good' ? '✓' : r.grade === 'partial' ? '~' : '✗')).join(' ')
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function rankKey(accuracy: number): 'rank_4' | 'rank_3' | 'rank_2' | 'rank_1' {
  if (accuracy >= 0.9) return 'rank_4'
  if (accuracy >= 0.65) return 'rank_3'
  if (accuracy >= 0.35) return 'rank_2'
  return 'rank_1'
}

export function shareText(s: Session, lang: Lang, url: string, streak = 0): string {
  const sum = summarize(s)
  const dot = ' · '
  const modeName = translate(lang, `mode_${s.mode}` as const)
  const tierName = translate(lang, `tier_${s.tier}_short` as const)
  const daily = s.daily ? dot + dateKey() : ''
  const timer = s.timer ? '' : dot + translate(lang, 'timer') + ' ' + translate(lang, 'timerOff').toLowerCase()
  const variant = s.variant !== 'normal' ? dot + translate(lang, `variant_${s.variant}` as const) : ''
  const vs = s.challenge !== undefined ? dot + `${translate(lang, 'challenger')} ${s.challenge}` : ''
  const head = s.dailyNumber ? `Wegenkenner #${s.dailyNumber}` + dot + modeName : 'Wegenkenner' + dot + modeName + dot + tierName + daily + timer + variant
  const streakLine = s.dailyNumber && streak > 1 ? dot + `${translate(lang, 'streak').toLowerCase()} ${streak}` : ''
  return [
    head,
    `${sum.score} ${translate(lang, 'points')}` + dot + `${sum.good}${sum.partial ? `+${sum.partial}` : ''}/${sum.total}` + dot + formatTime(sum.ms) + vs + streakLine,
    marksLine(s),
    url.includes('/functions/') ? url : s.dailyNumber ? `${url}#daily` : `${url}?c=${challengeParam(s)}`,
  ].join('\n')
}

// ---- persistence ----

const SETTINGS_KEY = 'tdhg:v1:settings'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Settings>
      return { tier: p.tier === 'AN' || p.tier === 'ALL' ? p.tier : 'A', timer: p.timer !== false, daily: p.daily === true, learnDeck: p.learnDeck === 'junctions' ? 'junctions' : 'roads', sound: p.sound !== false, variant: VARIANTS.includes(p.variant as Variant) ? (p.variant as Variant) : 'normal' }
    }
  } catch {
    /* ignore */
  }
  return { tier: 'A', timer: true, daily: false, learnDeck: 'roads', sound: true, variant: 'normal' }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

export interface Best {
  score: number
  accuracy: number
  ms: number
  date: string
}

function bestKey(mode: ModeId, tier: Tier, timer: boolean, variant: Variant = 'normal') {
  return `tdhg:v1:best:${mode}:${tier}:${timer ? 't' : 'u'}${variant === 'normal' ? '' : ':' + variant}`
}

export function getBest(mode: ModeId, tier: Tier, timer: boolean, variant: Variant = 'normal'): Best | null {
  try {
    const raw = localStorage.getItem(bestKey(mode, tier, timer, variant))
    return raw ? (JSON.parse(raw) as Best) : null
  } catch {
    return null
  }
}

/** Stores the session as best score when it beats the previous one. Returns true when it did. */
export function submitBest(s: Session): boolean {
  const sum = summarize(s)
  if (sum.score <= 0) return false
  const prev = getBest(s.mode, s.tier, s.timer, s.variant)
  if (prev && prev.score >= sum.score) return false
  try {
    localStorage.setItem(bestKey(s.mode, s.tier, s.timer, s.variant), JSON.stringify({ score: sum.score, accuracy: sum.accuracy, ms: sum.ms, date: dateKey() } satisfies Best))
  } catch {
    /* ignore */
  }
  return true
}
