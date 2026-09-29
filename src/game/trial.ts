// Proefrit: a free player gets one round per week in a Plus mode of their choice.
import type { ModeId } from './session'

const KEY = 'tdhg:v1:trial'

/** ISO week key such as 2026-W40, so the trial renews on Monday. */
function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function load(): { week: string; mode: ModeId } | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as { week: string; mode: ModeId } | null
  } catch {
    return null
  }
}

/** True while this week's trial round has not been played yet. */
export function trialAvailable(): boolean {
  return load()?.week !== weekKey()
}

export function useTrial(mode: ModeId) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ week: weekKey(), mode }))
  } catch {
    /* ignore */
  }
}
