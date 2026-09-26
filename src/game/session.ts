import type { Exit, GameData, Junction, Road, Tier } from '../data'
import { roadsForTier } from '../data'
import { THEME_NAMES, type ThemeName } from '../map/theme'
import { translate, type Lang } from '../i18n'
import type { Deck } from './learn'

export type ModeId = 'drag' | 'find' | 'junction' | 'quiz' | 'exit' | 'route' | 'distance' | 'sign'
export const MODES: ModeId[] = ['drag', 'find', 'junction', 'quiz', 'exit', 'sign', 'distance', 'route']
export type Variant = 'normal' | 'nozoom' | 'blind' | 'mirror' | 'blitz'
export const VARIANTS: Variant[] = ['normal', 'nozoom', 'blind', 'mirror', 'blitz']
/** Score multiplier for the harder variants. */
export const VARIANT_MULT: Record<Variant, number> = { normal: 1, nozoom: 1.25, blind: 1.5, mirror: 1.25, blitz: 1 }
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
  /** Province code, or '' for the whole country. */
  province: string
  /** Map look; paper and night need Plus. */
  theme: ThemeName
}

export interface Session {
  mode: ModeId
  tier: Tier
  timer: boolean
  daily: boolean
  seed: number
  variant: Variant
  province: string
  /** Score of the player who sent a challenge link, when playing one. */
  challenge?: number
  /** Set when this is a daily challenge (today's, or one from the archive). */
  dailyNumber?: number
  /** Frozen questions of a daily: road refs, interchange names or exit keys. */
  picks?: string[]
  /** A replay of a daily already scored today: nothing is recorded or posted. */
  practice?: boolean
  startedAt: number
  finishedAt: number
  results: QuestionResult[]
}

export const QUESTION_COUNT = 10
/** Seconds. drag is a total budget, the others are per question. */
export const TIME_LIMITS: Record<ModeId, number> = { find: 20, quiz: 15, junction: 30, drag: 180, exit: 25, route: 0, distance: 25, sign: 20 }
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
  return dailySeedOn(dateKey(), mode, tier)
}
export function dailySeedOn(key: string, mode: ModeId, tier: Tier): number {
  return hashString(`${key}|${mode}|${tier}`)
}

export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function newSession(mode: ModeId, s: Settings, challenge?: Challenge, daily?: number, extra?: { picks?: string[]; practice?: boolean; seed?: number }): Session {
  if (daily) {
    return { mode, tier: 'A', timer: true, daily: true, seed: extra?.seed ?? dailySeed(mode, 'A'), variant: 'normal', province: '', dailyNumber: daily, picks: extra?.picks, practice: extra?.practice, startedAt: Date.now(), finishedAt: 0, results: [] }
  }
  if (challenge) {
    return { mode: challenge.mode, tier: challenge.tier, timer: challenge.timer, daily: false, seed: challenge.seed, variant: challenge.variant, province: challenge.province, challenge: challenge.score, startedAt: Date.now(), finishedAt: 0, results: [] }
  }
  const seed = s.daily ? dailySeed(mode, s.tier) : Math.floor(Math.random() * 2 ** 31)
  return { mode, tier: s.tier, timer: s.timer, daily: s.daily, seed, variant: mode === 'route' || mode === 'drag' || mode === 'distance' ? (s.variant === 'blitz' ? 'normal' : s.variant) : s.variant, province: mode === 'route' ? '' : s.province, startedAt: Date.now(), finishedAt: 0, results: [] }
}

export interface Challenge {
  mode: ModeId
  tier: Tier
  timer: boolean
  seed: number
  score: number
  variant: Variant
  province: string
}

/** Challenge links carry mode, tier, timer, seed, score and variant in one query parameter. */
export function challengeParam(s: Session): string {
  return [s.mode, s.tier, s.timer ? 1 : 0, s.seed, summarize(s).score, s.variant, s.province || '-'].join('.')
}

export function parseChallenge(search: string): Challenge | null {
  const c = new URLSearchParams(search).get('c')
  if (!c) return null
  const [mode, tier, timer, seed, score, variant, province] = c.split('.')
  if (!MODES.includes(mode as ModeId) || !['A', 'N', 'AN'].includes(tier)) return null
  const v = VARIANTS.includes(variant as Variant) ? (variant as Variant) : 'normal'
  const n = Number(seed)
  const sc = Number(score)
  if (!Number.isFinite(n) || !Number.isFinite(sc)) return null
  return { mode: mode as ModeId, tier: tier as Tier, timer: timer === '1', seed: n, score: sc, variant: v, province: province && province !== '-' && /^[A-Z]{2}$/.test(province) ? province : '' }
}

/** Pick n roads for a tier. Mixes kinds so that the harder tiers do not drown in provincial roads. */
export function pickRoads(data: GameData, tier: Tier, n: number, rng: () => number, province = ''): Road[] {
  const pool = roadsForTier(data, tier, province)
  if (tier !== 'AN') return shuffle(pool, rng).slice(0, n)
  const a = shuffle(pool.filter((r) => r.kind === 'A'), rng)
  const nn = shuffle(pool.filter((r) => r.kind === 'N'), rng)
  const wantA = Math.round(n * 0.6)
  return shuffle([...a.slice(0, wantA), ...nn.slice(0, n - wantA)], rng).slice(0, n)
}

/** Questions of a frozen daily, in the frozen order. Unknown entries (data changed) are skipped. */
export function roadsFromPicks(data: GameData, picks: string[]): Road[] {
  return picks.map((ref) => data.byRef.get(ref)).filter((r): r is Road => !!r)
}
export function junctionsFromPicks(data: GameData, picks: string[]): Junction[] {
  return picks.map((name) => data.junctions.find((j) => j.name === name)).filter((j): j is Junction => !!j)
}
export function exitsFromPicks(data: GameData, picks: string[]): Exit[] {
  return picks.map((k) => data.exits.find((e) => `${e.road}|${e.r}|${e.n}` === k)).filter((e): e is Exit => !!e)
}

export function pickJunctions(data: GameData, n: number, rng: () => number, province = ''): Junction[] {
  return shuffle(province ? data.junctions.filter((j) => j.p?.includes(province)) : data.junctions, rng).slice(0, n)
}

/** Four options for the quiz: the target plus three lookalikes (close numbers, same colour). */
export function quizOptions(data: GameData, tier: Tier, target: Road, rng: () => number, province = ''): Road[] {
  let pool = roadsForTier(data, tier, province).filter((r) => r.ref !== target.ref)
  if (pool.length < 3) pool = roadsForTier(data, tier).filter((r) => r.ref !== target.ref)
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

/** Share line for a finished daily, from the home board. */
export function dailyShareText(n: number, score: number, lang: Lang, url: string): string {
  return [`Wegenkenner #${n}`, `${score} ${translate(lang, 'points', { n: score })}`, `${url}#daily`].join(String.fromCharCode(10))
}

export function shareText(s: Session, lang: Lang, url: string): string {
  const sum = summarize(s)
  const head = s.dailyNumber ? `Wegenkenner #${s.dailyNumber}` : `Wegenkenner · ${translate(lang, `mode_${s.mode}` as const)}`
  return [head, `${sum.score} ${translate(lang, 'points', { n: sum.score })}`, url.includes('/functions/') ? url : s.dailyNumber ? `${url}#daily` : `${url}?c=${challengeParam(s)}`].join('\n')
}

// ---- persistence ----

const SETTINGS_KEY = 'tdhg:v1:settings'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Settings>
      const tier: Tier = p.tier === 'AN' || p.tier === 'N' ? p.tier : (p.tier as string) === 'ALL' ? 'AN' : 'A'
      return { tier, timer: p.timer !== false, daily: p.daily === true, learnDeck: p.learnDeck === 'junctions' ? 'junctions' : 'roads', sound: p.sound !== false, variant: VARIANTS.includes(p.variant as Variant) ? (p.variant as Variant) : 'normal', province: typeof p.province === 'string' && /^[A-Z]{2}$/.test(p.province) ? p.province : '', theme: THEME_NAMES.includes(p.theme as ThemeName) ? (p.theme as ThemeName) : 'signage' }
    }
  } catch {
    /* ignore */
  }
  return { tier: 'A', timer: true, daily: false, learnDeck: 'roads', sound: true, variant: 'normal', province: '', theme: 'signage' }
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

function bestKey(mode: ModeId, tier: Tier, timer: boolean, variant: Variant = 'normal', province = '') {
  return `tdhg:v1:best:${mode}:${tier}:${timer ? 't' : 'u'}${variant === 'normal' ? '' : ':' + variant}${province ? ':' + province : ''}`
}

export function getBest(mode: ModeId, tier: Tier, timer: boolean, variant: Variant = 'normal', province = ''): Best | null {
  try {
    const raw = localStorage.getItem(bestKey(mode, tier, timer, variant, province))
    return raw ? (JSON.parse(raw) as Best) : null
  } catch {
    return null
  }
}

/** Stores the session as best score when it beats the previous one. Returns true when it did. */
export function submitBest(s: Session): boolean {
  const sum = summarize(s)
  if (sum.score <= 0) return false
  const prev = getBest(s.mode, s.tier, s.timer, s.variant, s.province)
  if (prev && prev.score >= sum.score) return false
  try {
    localStorage.setItem(bestKey(s.mode, s.tier, s.timer, s.variant, s.province), JSON.stringify({ score: sum.score, accuracy: sum.accuracy, ms: sum.ms, date: dateKey() } satisfies Best))
  } catch {
    /* ignore */
  }
  return true
}
