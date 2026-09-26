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
function sb(): Promise<SupabaseClient | null> {
  if (!ONLINE) return Promise.resolve(null)
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, flowType: 'pkce' } }))
      .catch(() => null)
  }
  return clientPromise
}

/** Anonymous sign-in: gives this device a stable id without any account. */
async function ensureSession(): Promise<boolean> {
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
const BLOCK = ['kanker', 'hoer', 'kut', 'nazi', 'hitler', 'neger', 'fuck', 'shit', 'cunt', 'nigger']
export function validNickname(n: string): boolean {
  const s = n.trim()
  if (s.length < 2 || s.length > 16) return false
  if (!/^[\p{L}\p{N} _.-]+$/u.test(s)) return false
  const low = s.toLowerCase()
  return !BLOCK.some((w) => low.includes(w))
}

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
}
export interface WeekRow {
  nickname: string
  total: number
  days: number
  is_me: boolean
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
  const rows = await rpc<{ code: string; name: string }[]>('create_group', { p_name: name, p_nick: nick })
  const g = rows?.[0]
  return g ? { ...g, members: 1 } : null
}
export async function joinGroup(code: string, nick: string): Promise<Group | null> {
  const rows = await rpc<{ code: string; name: string }[]>('join_group', { p_code: code, p_nick: nick })
  const g = rows?.[0]
  return g ? { ...g, members: 0 } : null
}
export async function myGroups(): Promise<Group[]> {
  return (await rpc<Group[]>('my_groups', {})) ?? []
}
export async function groupBoard(code: string, daily: number): Promise<BoardRow[]> {
  return (await rpc<BoardRow[]>('group_board', { p_code: code, p_daily: daily })) ?? []
}
export async function groupWeek(code: string, daily: number): Promise<WeekRow[]> {
  return (await rpc<WeekRow[]>('group_week', { p_code: code, p_daily: daily })) ?? []
}
export async function leaveGroup(code: string): Promise<boolean> {
  const c = await sb()
  if (!c || !(await ensureSession())) return false
  const { data: g } = await c.from('groups').select('id').eq('code', code).maybeSingle()
  if (!g) return false
  const { data: u } = await c.auth.getUser()
  if (!u.user) return false
  const { error } = await c.from('members').delete().eq('group_id', g.id).eq('player_id', u.user.id)
  return !error
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
  email?: string
  name?: string
  avatar?: string
}

/** Signed in means a real (Google) identity, not the anonymous device account. */
export async function getAccount(): Promise<Account> {
  const c = await sb()
  if (!c) return { signedIn: false }
  const { data } = await c.auth.getUser()
  const u = data.user
  if (!u || u.is_anonymous) return { signedIn: false }
  const m = (u.user_metadata ?? {}) as Record<string, unknown>
  const str = (k: string) => (typeof m[k] === 'string' && (m[k] as string).trim() ? (m[k] as string).trim() : undefined)
  return { signedIn: true, email: u.email ?? undefined, name: str('full_name') ?? str('name') ?? str('given_name'), avatar: str('avatar_url') ?? str('picture') }
}

export async function isSignedIn(): Promise<boolean> {
  return (await getAccount()).signedIn
}

/** Links the anonymous device account to Google (keeps groups and scores), or signs in fresh. Redirects away. */
export async function signInWithGoogle(): Promise<'redirect' | 'off' | 'error'> {
  const c = await sb()
  if (!c || !(await ensureSession())) return 'error'
  const redirectTo = `${location.origin}${import.meta.env.BASE_URL}`
  const { data } = await c.auth.getUser()
  const link = data.user?.is_anonymous ? await c.auth.linkIdentity({ provider: 'google', options: { redirectTo } }) : null
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
  const { data } = await c.from('player_state').select('state').maybeSingle()
  return (data?.state as Record<string, string> | undefined) ?? null
}

export async function saveRemoteState(state: Record<string, string>): Promise<boolean> {
  const c = await sb()
  if (!c || !(await ensureSession())) return false
  const { data: u } = await c.auth.getUser()
  if (!u.user) return false
  const { error } = await c.from('player_state').upsert({ player_id: u.user.id, state, updated_at: new Date().toISOString() })
  return !error
}
