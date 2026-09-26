// Daily reminder through Web Push. The subscription is stored under the anonymous player id;
// supabase/functions/remind sends the notification at the chosen hour to players who have not played yet.
import { ensureSession, sb } from './backend'

const KEY = 'tdhg:v1:reminder'
const VAPID = import.meta.env.VITE_VAPID_PUBLIC as string | undefined

export interface Reminder {
  on: boolean
  hour: number
}

export function pushSupported(): boolean {
  return !!VAPID && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function getReminder(): Reminder {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Reminder | null
    if (r && typeof r.hour === 'number') return r
  } catch {
    /* ignore */
  }
  return { on: false, hour: 18 }
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

/** Asks permission, subscribes the browser and stores the subscription. Returns false when anything refuses. */
export async function enableReminder(hour: number, lang: string): Promise<boolean> {
  if (!pushSupported()) return false
  const c = await sb()
  if (!c || !(await ensureSession())) return false
  try {
    if ((await Notification.requestPermission()) !== 'granted') return false
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID!) as BufferSource }))
    const j = sub.toJSON()
    const { error } = await c.from('push_subs').upsert(
      { endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? '', auth: j.keys?.auth ?? '', hour, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam', lang },
      { onConflict: 'endpoint' },
    )
    if (error) return false
    remember({ on: true, hour })
    return true
  } catch {
    return false
  }
}

export async function disableReminder(): Promise<void> {
  remember({ on: false, hour: getReminder().hour })
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    const c = await sb()
    if (c) await c.from('push_subs').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  } catch {
    /* ignore */
  }
}
