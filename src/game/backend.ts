// Online features on Supabase: friend groups, daily percentile, share previews.
// Everything degrades silently when the project is not configured (no env vars) or the player is offline.
import type { SupabaseClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const SHARE_BASE = (import.meta.env.VITE_SHARE_BASE as string | undefined) || (URL ? `${URL}/functions/v1/s` : '')
export const ONLINE = Boolean(URL && KEY)

let clientPromise: Promise<SupabaseClient | null> | null = null
let session: Promise<boolean> | null = null

/** The library loads on first use only, so the game itself stays small. */
export function sb(): Promise<SupabaseClient | null> {
  if (!ONLINE) return Promise.resolve(null)
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce' } }))
      .catch(() => null)
  }
  return clientPromise
}

/** Anonymous sign-in: gives this device a stable id without any account. */
export async function ensureSession(): Promise<boolean> {
  const c = await sb()
  if (!c) return false
  if (!session) {
    session = (async () => {
      const { data } = await c.auth.getSession()
      if (data.session) return true
      const { error } = await c.auth.signInAnonymously()
      return !error
    })().catch(() => false)
  }
  return session
}

const NICK_KEY = 'tdhg:v1:nick'
export function getNickname(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? ''
  } catch {
    return ''
  }
}
export function setNickname(n: string) {
  try {
    localStorage.setItem(NICK_KEY, n)
  } catch {
    /* ignore */
  }
}
import { tidyName, validGroupName, validNickname } from './clean'
export { validNickname, validGroupName }

export interface Group {
  code: string
  name: string
  members: number
}
export interface BoardRow {
  nickname: string
  score: number
  good: number
  total: number
  ms: number
  played: boolean
  is_me: boolean
  plus?: boolean
  avatar?: string | null
}
export interface WeekRow {
  nickname: string
  total: number
  days: number
  is_me: boolean
  plus?: boolean
  avatar?: string | null
}

/** Puts the player's picture on the boards of every group they are in. */
export async function updateMemberAvatar(avatar: string | undefined) {
  await rpc<null>('update_member', { p_avatar: avatar ?? '' })
}

const GROUPS_SEEN = 'tdhg:v1:groupsSeen'
export function markGroupsSeen() {
  try {
    localStorage.setItem(GROUPS_SEEN, String(Date.now()))
  } catch {
    /* ignore */
  }
}
/** True when a fellow group member posted a score since the groups screen was last opened. */
export async function groupsHaveNews(): Promise<boolean> {
  const latest = await rpc<string | null>('group_activity', {})
  if (!latest) return false
  let seen = 0
  try {
    seen = Number(localStorage.getItem(GROUPS_SEEN) ?? 0)
  } catch {
    /* ignore */
  }
  return Date.parse(latest) > seen
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const c = await sb()
  if (!c || !(await ensureSession())) return null
  const { data, error } = await c.rpc(fn, args)
  if (error) {
    console.warn('rpc', fn, error.message)
    return null
  }
  return data as T
}

export interface Percentile {
  betterThan: number | null
  players: number
}

export async function submitDaily(daily: number, score: number, good: number, total: number, ms: number): Promise<Percentile | null> {
  if (!(await ensureSession())) return null
  await rpc<null>('submit_daily', { p_daily: daily, p_score: score, p_good: good, p_total: total, p_ms: ms, p_nick: getNickname() })
  const rows = await rpc<{ better_than: number | null; players: number }[]>('daily_percentile', { p_daily: daily, p_score: score })
  const r = rows?.[0]
  return r ? { betterThan: r.better_than === null ? null : Number(r.better_than), players: r.players } : null
}

export async function createGroup(name: string, nick: string): Promise<Group | null> {
  if (!validGroupName(name) || !validNickname(nick)) return null
  const rows = await rpc<{ code: string; name: string }[]>('create_group', { p_name: tidyName(name), p_nick: tidyName(nick) })
  const g = rows?.[0]
  return g ? { ...g, members: 1 } : null
}
export async function joinGroup(code: string, nick: string): Promise<Group | null> {
  if (!validNickname(nick)) return null
  const rows = await rpc<{ code: string; name: string }[]>('join_group', { p_code: code, p_nick: tidyName(nick) })
  const g = rows?.[0]
  return g ? { ...g, members: 0 } : null
}
export async function myGroups(): Promise<Group[]> {
  return (await rpc<Group[]>('my_groups', {})) ?? []
}
export async function groupBoard(code: string, daily: number): Promise<BoardRow[]> {
  return (await rpc<BoardRow[]>('group_board', { p_code: code, p_daily: daily })) ?? []
}
export interface RivalRow {
  nickname: string
  beat_me: number
  i_beat: number
}
/** Head to head counts over the last 30 dailies, for the nemesis tag. */
export async function groupRivals(code: string, daily: number): Promise<RivalRow[]> {
  return (await rpc<RivalRow[]>('group_rivals', { p_code: code, p_daily: daily })) ?? []
}
export async function groupWeek(code: string, daily: number): Promise<WeekRow[]> {
  return (await rpc<WeekRow[]>('group_week', { p_code: code, p_daily: daily })) ?? []
}
export async function leaveGroup(code: string): Promise<boolean> {
  return (await rpc<boolean>('leave_group', { p_code: code })) === true
}

/** Uploads the card and registers a share. Returns the preview link, or null when offline. */
export async function createShare(blob: Blob, title: string, text: string, param: string | null): Promise<string | null> {
  const c = await sb()
  if (!c || !(await ensureSession())) return null
  const { data: u } = await c.auth.getUser()
  if (!u.user) return null
  const id = Math.random().toString(36).slice(2, 10)
  const path = `${u.user.id}/${id}.png`
  const up = await c.storage.from('cards').upload(path, blob, { contentType: 'image/png', upsert: false })
  if (up.error) return null
  const image = c.storage.from('cards').getPublicUrl(path).data.publicUrl
  const { error } = await c.from('shares').insert({ id, player_id: u.user.id, title, text, image, param })
  if (error) return null
  return `${SHARE_BASE}/${id}`
}

// ---------- account ----------

export interface Account {
  signedIn: boolean
  /** Player id (also the anonymous device id when not signed in). */
  id?: string
  email?: string
  name?: string
  avatar?: string
  /** Wegenkenner Plus valid until this time (ms), when bought. */
  plusUntil?: number
}

/** Signed in means a real (Google) identity, not the anonymous device account. */
export async function getAccount(): Promise<Account> {
  const c = await sb()
  if (!c) return { signedIn: false }
  const { data } = await c.auth.getUser()
  const u = data.user
  if (!u) return { signedIn: false }
  const plus = await c.from('premium').select('until').eq('player_id', u.id).maybeSingle()
  const plusUntil = plus.data?.until ? Date.parse(plus.data.until as string) : undefined
  if (u.is_anonymous) return { signedIn: false, id: u.id, plusUntil }
  // Name and picture: from the user metadata, or from the Google identity itself when the metadata lacks them
  // (a re-created account after a deletion, or a sign-in through the identity-already-exists fallback).
  const m = (u.user_metadata ?? {}) as Record<string, unknown>
  const idData = ((u.identities ?? []).find((i) => i.provider === 'google')?.identity_data ?? {}) as Record<string, unknown>
  const str = (k: string) => {
    for (const src of [m, idData]) {
      const v = src[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return undefined
  }
  return { signedIn: true, id: u.id, email: u.email ?? undefined, name: str('full_name') ?? str('name') ?? str('given_name'), avatar: str('avatar_url') ?? str('picture'), plusUntil }
}

export async function isSignedIn(): Promise<boolean> {
  return (await getAccount()).signedIn
}

/** Links the anonymous device account to Google (keeps groups and scores), or signs in fresh. Redirects away. */
export async function signInWithGoogle(fresh = false): Promise<'redirect' | 'off' | 'error'> {
  const c = await sb()
  if (!c || !(await ensureSession())) return 'error'
  const redirectTo = `${location.origin}${import.meta.env.BASE_URL}`
  const { data } = await c.auth.getUser()
  // Linking keeps this device's groups and scores. When the Google account already belongs to another
  // player (signed in on a phone first), Supabase refuses the link and we sign in as that player instead.
  const link = !fresh && data.user?.is_anonymous ? await c.auth.linkIdentity({ provider: 'google', options: { redirectTo } }) : null
  if (link && !link.error) return 'redirect'
  const res = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
  if (res.error) return /not enabled|unsupported|disabled/i.test(res.error.message) ? 'off' : 'error'
  return 'redirect'
}

export async function signOut() {
  const c = await sb()
  if (!c) return
  await c.auth.signOut()
  session = null
}

export async function loadRemoteState(): Promise<Record<string, string> | null> {
  const c = await sb()
  if (!c || !(await ensureSession())) return null
  const { data, error } = await c.from('player_state').select('state').maybeSingle()
  if (error) {
    console.warn('cloud save load', error.message)
    return null
  }
  return (data?.state as Record<string, string> | undefined) ?? null
}

export async function saveRemoteState(state: Record<string, string>): Promise<boolean> {
  const c = await sb()
  if (!c || !(await ensureSession())) return false
  const { data: u } = await c.auth.getUser()
  if (!u.user) return false
  const { error } = await c.from('player_state').upsert({ player_id: u.user.id, state, updated_at: new Date().toISOString() })
  if (error) console.warn('cloud save', error.message)
  return !error
}

// ---------- referral and gift codes (edge functions) ----------

/** The player's personal 50% code for friends. Needs Plus and a signed-in account. */
export async function getReferralCode(): Promise<{ code?: string; error?: string }> {
  const c = await sb()
  if (!c) return { error: 'offline' }
  const { data, error } = await c.functions.invoke<{ code?: string; error?: string }>('referral', { body: {} })
  if (error) return { error: (data && data.error) || error.message }
  return data ?? { error: 'empty' }
}

/** How often the referral code was used and what friends saved together, in cents. */
export async function getReferralStats(): Promise<{ uses: number; saved: number } | null> {
  const c = await sb()
  if (!c) return null
  const { data, error } = await c.functions.invoke<{ uses?: number; saved?: number }>('referral', { body: { action: 'stats' } })
  if (error || !data || typeof data.uses !== 'number') return null
  return { uses: data.uses, saved: data.saved ?? 0 }
}

/** The gift code the webhook made for a Paddle gift transaction; null while it is not there yet. */
export async function fetchGiftCode(txn: string): Promise<string | null> {
  const c = await sb()
  if (!c) return null
  const { data, error } = await c.functions.invoke<{ code?: string }>('paddle-gift', { body: { txn } })
  if (error || !data?.code) return null
  return data.code
}

/** Turns a gift license key into a year of Plus on this account. */
export async function redeemGift(key: string): Promise<{ until?: string; error?: string }> {
  const c = await sb()
  if (!c) return { error: 'offline' }
  const { data, error } = await c.functions.invoke<{ until?: string; error?: string }>('redeem', { body: { key } })
  if (error) return { error: (data && data.error) || error.message }
  return data ?? { error: 'empty' }
}

// ---------- account self-service (edge function account) ----------

/**
 * Export everything the server holds about the player.
 * On failure returns a short code for the notice: E1 offline build, E2 no session, E3 network,
 * E<status> the function answered with that HTTP status (plus its message), E4 empty answer.
 */
export async function exportAccount(): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; code: string }> {
  const c = await sb()
  if (!c) return { ok: false, code: 'E1' }
  const { data: s } = await c.auth.getSession()
  if (!s.session) return { ok: false, code: 'E2' }
  try {
    const { data, error } = await c.functions.invoke<Record<string, unknown>>('account', { body: { action: 'export' } })
    if (error) {
      const res = (error as { context?: Response }).context
      if (!res || typeof res.status !== 'number') return { ok: false, code: 'E3' }
      let msg = ''
      try {
        msg = String(((await res.clone().json()) as { error?: string }).error ?? '')
      } catch {
        /* no json body */
      }
      return { ok: false, code: `E${res.status}${msg ? ' ' + msg : ''}` }
    }
    if (!data || typeof data !== 'object') return { ok: false, code: 'E4' }
    return { ok: true, data }
  } catch {
    return { ok: false, code: 'E3' }
  }
}

/** Deletes the server-side account and everything tied to it. The caller clears local storage afterwards. */
export async function deleteAccount(): Promise<{ ok: true } | { ok: false; code: string }> {
  const c = await sb()
  if (!c) return { ok: false, code: 'E1' }
  const { data: s } = await c.auth.getSession()
  if (!s.session) return { ok: false, code: 'E2' }
  try {
    const { data, error } = await c.functions.invoke<{ deleted?: boolean; error?: string }>('account', { body: { action: 'delete' } })
    if (error) {
      const res = (error as { context?: Response }).context
      if (!res || typeof res.status !== 'number') return { ok: false, code: 'E3' }
      let msg = ''
      try {
        msg = String(((await res.clone().json()) as { error?: string }).error ?? '')
      } catch {
        /* no json body */
      }
      return { ok: false, code: `E${res.status}${msg ? ' ' + msg : ''}` }
    }
    if (!data?.deleted) return { ok: false, code: `E4${data?.error ? ' ' + data.error : ''}` }
  } catch {
    return { ok: false, code: 'E3' }
  }
  await c.auth.signOut().catch(() => {})
  session = null
  return { ok: true }
}
