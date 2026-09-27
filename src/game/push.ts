// Daily reminder through Web Push. The subscription is stored under the anonymous player id;
// supabase/functions/remind sends the notification at the chosen hour to players who have not played yet.
import { ensureSession, sb } from './backend'

const KEY = 'tdhg:v1:reminder'
const VAPID = import.meta.env.VITE_VAPID_PUBLIC as string | undefined

export interface Reminder {
  on: boolean
  hour: number
  minute: number
}

export function pushSupported(): boolean {
  return !!VAPID && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function getReminder(): Reminder {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Reminder | null
    if (r && typeof r.hour === 'number') return { on: !!r.on, hour: r.hour, minute: typeof r.minute === 'number' ? r.minute : 0 }
  } catch {
    /* ignore */
  }
  return { on: false, hour: 18, minute: 0 }
}

function remember(r: Reminder) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r))
  } catch {
    /* ignore */
  }
}

function keyBytes(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** The service worker registration, or null when none takes control within a few seconds. */
async function swReady(ms = 5000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => window.setTimeout(() => r(null), ms))])
}

/**
 * Asks permission, subscribes the browser and stores the subscription.
 * Returns null when it worked, otherwise a short reason: 'unsupported', 'offline', 'permission' or 'server: ...'.
 */
export async function enableReminder(hour: number, minute: number, lang: string): Promise<string | null> {
  if (!pushSupported()) return 'unsupported'
  const c = await sb()
  if (!c || !(await ensureSession())) return 'offline'
  try {
    if ((await Notification.requestPermission()) !== 'granted') return 'permission'
    const reg = await swReady()
    if (!reg) return 'push: no service worker'
    const subscribe = () => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID!) as BufferSource })
    const save = async (sub: PushSubscription) => {
      const j = sub.toJSON()
      const { error } = await c.from('push_subs').upsert(
        { endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? '', auth: j.keys?.auth ?? '', hour, minute, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam', lang },
        { onConflict: 'endpoint' },
      )
      return error
    }
    const existing = await reg.pushManager.getSubscription()
    let error = await save(existing ?? (await subscribe()))
    if (error && existing) {
      // The old subscription's row belongs to another account (signed out and in again): start a fresh one.
      await existing.unsubscribe().catch(() => {})
      error = await save(await subscribe())
    }
    if (error) return `server: ${error.message}`
    remember({ on: true, hour, minute })
    return null
  } catch (e) {
    return `push: ${(e as Error)?.message ?? e}`
  }
}

/** Keep the chosen time even while the reminder is off, so switching it on later uses it. */
export function setReminderTime(hour: number, minute: number) {
  remember({ ...getReminder(), hour, minute })
}

export async function disableReminder(): Promise<void> {
  remember({ ...getReminder(), on: false })
  try {
    const reg = await swReady()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    const c = await sb()
    if (c) await c.from('push_subs').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  } catch {
    /* ignore */
  }
}
