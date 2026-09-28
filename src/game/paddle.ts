// Paddle checkout: the overlay from Paddle.js, opened for the Plus year or the gift, with the player id as custom data
// so the webhook knows whose year it is. Paddle shows iDEAL, Wero and Bancontact next to cards for Dutch and Belgian buyers.
const TOKEN = (import.meta.env.VITE_PADDLE_TOKEN as string | undefined) ?? ''
const ENV = (import.meta.env.VITE_PADDLE_ENV as string | undefined) ?? 'production'
const PRICE_PLUS = (import.meta.env.VITE_PADDLE_PRICE_PLUS as string | undefined) ?? ''
const PRICE_GIFT = (import.meta.env.VITE_PADDLE_PRICE_GIFT as string | undefined) ?? ''

export const paddleConfigured = !!TOKEN && !!PRICE_PLUS
export const paddleGiftConfigured = paddleConfigured && !!PRICE_GIFT

export interface PaddleEvent {
  name: string
  data?: { transaction_id?: string; custom_data?: Record<string, string>; status?: string }
}

interface PaddleJs {
  Environment: { set: (env: 'sandbox' | 'production') => void }
  Initialize: (opts: { token: string; eventCallback?: (e: PaddleEvent) => void }) => void
  Checkout: { open: (opts: Record<string, unknown>) => void; close: () => void }
}

declare global {
  interface Window {
    Paddle?: PaddleJs
  }
}

const listeners = new Set<(e: PaddleEvent) => void>()
/** Listen for checkout events (checkout.completed carries the transaction id). Returns the unsubscribe. */
export function onPaddleEvent(fn: (e: PaddleEvent) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let loading: Promise<PaddleJs | null> | null = null
function paddle(): Promise<PaddleJs | null> {
  if (!paddleConfigured) return Promise.resolve(null)
  if (!loading) {
    loading = new Promise<PaddleJs | null>((resolve) => {
      const done = () => {
        const P = window.Paddle
        if (!P) return resolve(null)
        if (ENV === 'sandbox') P.Environment.set('sandbox')
        P.Initialize({ token: TOKEN, eventCallback: (e) => listeners.forEach((l) => l(e)) })
        resolve(P)
      }
      if (window.Paddle) return done()
      const s = document.createElement('script')
      s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
      s.async = true
      s.onload = done
      s.onerror = () => resolve(null)
      document.head.appendChild(s)
    })
  }
  return loading
}

/** Opens the overlay. Returns false when Paddle could not be loaded (offline, blocked). */
export async function openCheckout(kind: 'plus' | 'gift', opts: { playerId?: string; email?: string; discountCode?: string; locale?: string }): Promise<boolean> {
  const P = await paddle()
  if (!P) return false
  const priceId = kind === 'gift' ? PRICE_GIFT : PRICE_PLUS
  if (!priceId) return false
  P.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    customData: { player_id: opts.playerId ?? '', kind },
    ...(opts.email ? { customer: { email: opts.email } } : {}),
    ...(opts.discountCode ? { discountCode: opts.discountCode } : {}),
    settings: { displayMode: 'overlay', theme: 'dark', locale: opts.locale ?? 'nl', showAddDiscounts: true, allowLogout: false },
  })
  return true
}
