// Wegenkenner Plus: a yearly pass tied to the Google account. Unlocks the archive and the extra modes.
import type { ModeId } from './session'
import type { Account } from './backend'

export const PLUS_MODES: ModeId[] = ['junction', 'exit', 'route', 'distance', 'sign']

const KEY = 'tdhg:v1:plus'

export function isPlusMode(mode: ModeId): boolean {
  return PLUS_MODES.includes(mode)
}

/** True while the pass is valid. Falls back to the last known state so an installed app works offline. */
export function hasPlus(account: Account): boolean {
  const until = account.plusUntil ?? cachedUntil()
  return !!until && until > Date.now()
}

function cachedUntil(): number {
  try {
    return Number(localStorage.getItem(KEY) ?? 0)
  } catch {
    return 0
  }
}

/** Expiry of the pass in ms, from the server answer or the offline cache. */
export function plusUntil(account: Account): number | undefined {
  const until = account.plusUntil ?? cachedUntil()
  return until > 0 ? until : undefined
}

export function rememberPlus(until: number | undefined) {
  try {
    if (until) localStorage.setItem(KEY, String(until))
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Checkout link with the player id attached, so the webhook knows who paid. Empty when no shop is configured. */
export function checkoutUrl(playerId: string, email?: string): string {
  const base = import.meta.env.VITE_PLUS_CHECKOUT as string | undefined
  if (!base) return ''
  const u = new URL(base)
  u.searchParams.set('checkout[custom][player_id]', playerId)
  if (email) u.searchParams.set('checkout[email]', email)
  const ref = pendingReferral()
  if (ref) u.searchParams.set('checkout[discount_code]', ref)
  return u.toString()
}

/** Checkout of the gift product (a license key by mail), or empty when not configured. */
export const GIFT_CHECKOUT = (import.meta.env.VITE_PLUS_GIFT_CHECKOUT as string | undefined) ?? ''

const REF_KEY = 'tdhg:v1:refcode'

/** A friend's referral code from a #plus-CODE link, kept until the purchase. */
export function pendingReferral(): string {
  try {
    return localStorage.getItem(REF_KEY) ?? ''
  } catch {
    return ''
  }
}
export function rememberReferral(code: string) {
  try {
    if (/^[A-Z0-9]{4,20}$/.test(code)) localStorage.setItem(REF_KEY, code)
  } catch {
    /* ignore */
  }
}
export function referralLink(code: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}#plus-${code}`
}

export const PLUS_PRICE = (import.meta.env.VITE_PLUS_PRICE as string | undefined) ?? ''
