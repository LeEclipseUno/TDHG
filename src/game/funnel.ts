// Anonymous funnel counters: how often the home screen, the Plus page and the checkout are opened.
// One number per day per event in the database, nothing about who: no player id, no cookie, no session.
// Sent with a plain request and the public key, so it needs no account and loads no library.
const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export type FunnelEvent = 'home' | 'plus_view' | 'checkout_open' | 'trial' | 'gift_open'

/** Counts the event once per browser session. Never throws, never blocks. */
export function bump(event: FunnelEvent) {
  if (!URL_ || !KEY || !import.meta.env.PROD) return
  try {
    const flag = `wk:f:${event}`
    if (sessionStorage.getItem(flag)) return
    sessionStorage.setItem(flag, '1')
  } catch {
    /* private mode: count anyway */
  }
  void fetch(`${URL_}/rest/v1/rpc/bump`, {
    method: 'POST',
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_event: event }),
    keepalive: true,
  }).catch(() => {})
}
