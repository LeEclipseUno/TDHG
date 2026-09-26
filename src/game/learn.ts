import type { GameData, Tier } from '../data'
import { roadsForTier } from '../data'
import { review, type CardState, type Rating } from './fsrs'

export type CardKind = 'rec' | 'loc' | 'kp' // recognise a highlighted road, locate a road by number, locate an interchange
export type Deck = 'roads' | 'junctions'

export interface Card {
  id: string
  kind: CardKind
  ref?: string
  junction?: string
}

export type CardStates = Record<string, CardState>

const KEY = 'tdhg:v1:fsrs'

export function loadStates(): CardStates {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as CardStates) : {}
  } catch {
    return {}
  }
}

export function saveStates(states: CardStates) {
  try {
    localStorage.setItem(KEY, JSON.stringify(states))
  } catch {
    /* ignore */
  }
}

export function buildDeck(data: GameData, tier: Tier, deck: Deck, province = ''): Card[] {
  if (deck === 'junctions') return data.junctions.filter((j) => !province || j.p?.includes(province)).map((j) => ({ id: `kp:${j.name}`, kind: 'kp', junction: j.name }))
  const cards: Card[] = []
  for (const r of roadsForTier(data, tier, province)) {
    cards.push({ id: `rec:${r.ref}`, kind: 'rec', ref: r.ref })
    cards.push({ id: `loc:${r.ref}`, kind: 'loc', ref: r.ref })
  }
  return cards
}

export interface DeckStats {
  total: number
  seen: number
  due: number
  mature: number
}

export function deckStats(cards: Card[], states: CardStates, now = Date.now()): DeckStats {
  let seen = 0
  let due = 0
  let mature = 0
  for (const c of cards) {
    const st = states[c.id]
    if (!st) continue
    seen++
    if (st.due <= now) due++
    if (st.s >= 21) mature++
  }
  return { total: cards.length, seen, due, mature }
}

/** Due cards first (most overdue first), then new cards, capped per session. */
export function pickSession(cards: Card[], states: CardStates, now = Date.now(), max = 20, newLimit = 8): Card[] {
  const due = cards.filter((c) => states[c.id] && states[c.id].due <= now).sort((a, b) => states[a.id].due - states[b.id].due)
  const fresh = cards.filter((c) => !states[c.id])
  // Pair up the two card kinds of the same road so a new road is learned both ways in one session.
  const pick = [...due.slice(0, max)]
  for (const c of fresh) {
    if (pick.length >= max || pick.filter((p) => !states[p.id]).length >= newLimit) break
    pick.push(c)
  }
  return pick
}

/** Turn a game answer into an FSRS rating: wrong is Again, otherwise faster is better. */
export function ratingFor(correct: boolean, ms: number): Rating {
  if (!correct) return 1
  if (ms < 4000) return 4
  if (ms < 12000) return 3
  return 2
}

export function applyReview(states: CardStates, card: Card, rating: Rating, now = Date.now()): CardState {
  const next = review(states[card.id] ?? null, rating, now)
  states[card.id] = next
  saveStates(states)
  return next
}
