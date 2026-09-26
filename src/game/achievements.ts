// Badges on the profile, computed from local play data. Unlocks are remembered so the results screen can announce them.
import type { GameData } from '../data'
import { allDailyResults, getStreak } from './daily'
import { loadHistory, loadLabelStats } from './history'
import { MODES } from './session'

export type BadgeId = 'firstRide' | 'perfectDaily' | 'streak7' | 'streak30' | 'streak100' | 'dailies10' | 'dailies100' | 'allA' | 'allN' | 'junctions50' | 'allModes' | 'nightRider' | 'thousand'

export const BADGES: BadgeId[] = ['firstRide', 'perfectDaily', 'streak7', 'streak30', 'streak100', 'dailies10', 'dailies100', 'allA', 'allN', 'junctions50', 'allModes', 'nightRider', 'thousand']

const KEY = 'tdhg:v1:badges'

export function loadBadges(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

/** Which badges the data supports right now. */
export function computeBadges(data: GameData): Set<BadgeId> {
  const out = new Set<BadgeId>()
  const hist = loadHistory()
  const labels = loadLabelStats()
  const dailies = Object.values(allDailyResults())
  const streak = getStreak()
  if (hist.length > 0) out.add('firstRide')
  if (dailies.some((d) => d.total > 0 && d.good === d.total)) out.add('perfectDaily')
  if (streak.best >= 7) out.add('streak7')
  if (streak.best >= 30) out.add('streak30')
  if (streak.best >= 100) out.add('streak100')
  if (dailies.length >= 10) out.add('dailies10')
  if (dailies.length >= 100) out.add('dailies100')
  const known = (ref: string) => (labels[ref]?.r ?? 0) > 0
  const aRoads = data.roads.filter((r) => r.kind === 'A')
  const nRoads = data.roads.filter((r) => r.kind === 'N')
  if (aRoads.length && aRoads.every((r) => known(r.ref))) out.add('allA')
  if (nRoads.length && nRoads.every((r) => known(r.ref))) out.add('allN')
  const junctionHits = data.junctions.reduce((n, j) => n + (labels[j.name]?.r ?? 0), 0)
  if (junctionHits >= 50) out.add('junctions50')
  const played = new Set(hist.map((g) => g.mode))
  if (MODES.every((m) => played.has(m))) out.add('allModes')
  if (hist.some((g) => new Date(g.at).getHours() < 5)) out.add('nightRider')
  if (hist.some((g) => g.score >= 1000)) out.add('thousand')
  return out
}

/** Stores anything newly earned and returns those ids, oldest first. */
export function updateBadges(data: GameData): BadgeId[] {
  const have = loadBadges()
  const now = computeBadges(data)
  const fresh: BadgeId[] = []
  for (const id of BADGES) {
    if (now.has(id) && !have[id]) {
      have[id] = Date.now()
      fresh.push(id)
    }
  }
  if (fresh.length) {
    try {
      localStorage.setItem(KEY, JSON.stringify(have))
    } catch {
      /* ignore */
    }
  }
  return fresh
}
