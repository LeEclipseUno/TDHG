// Paddle webhook: a completed transaction for the Plus price adds one year to the buyer's account,
// one for the gift price creates a gift code the buyer can pass on.
// Deploy with: supabase functions deploy paddle-hook --no-verify-jwt
// Secrets: PADDLE_WEBHOOK_SECRET (the notification destination's secret key), PADDLE_PRICE_PLUS, PADDLE_PRICE_GIFT.
// The checkout carries custom data { player_id, kind }; the app adds that itself.
import { createClient } from 'npm:@supabase/supabase-js@2'

const YEAR = 365 * 24 * 3600 * 1000
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

function giftCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const s = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
  return `WKG-${s.slice(0, 4)}-${s.slice(4, 8)}`
}

interface Item {
  price?: { id?: string }
  quantity?: number
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 })
  const secret = Deno.env.get('PADDLE_WEBHOOK_SECRET')
  if (!secret) return new Response('not configured', { status: 500 })
  const body = await req.text()
  // Paddle-Signature: ts=<unix>;h1=<hex>  over "<ts>:<body>"
  const header = req.headers.get('paddle-signature') ?? ''
  const parts = Object.fromEntries(header.split(';').map((p) => p.split('=') as [string, string]))
  const ts = parts.ts ?? ''
  const h1 = (parts.h1 ?? '').toLowerCase()
  if (!ts || !h1 || !same(h1, await hmacHex(secret, `${ts}:${body}`))) return new Response('bad signature', { status: 401 })
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return new Response('stale', { status: 401 })

  const event = JSON.parse(body) as { event_type?: string; data?: { id?: string; custom_data?: Record<string, string>; items?: Item[]; customer_id?: string } }
  if (event.event_type !== 'transaction.completed') return new Response('ignored', { status: 200 })
  const data = event.data ?? {}
  const txn = String(data.id ?? '')
  const custom = data.custom_data ?? {}
  const playerId = custom.player_id && /^[0-9a-f-]{36}$/i.test(custom.player_id) ? custom.player_id : null
  const pricePlus = Deno.env.get('PADDLE_PRICE_PLUS') ?? ''
  const priceGift = Deno.env.get('PADDLE_PRICE_GIFT') ?? ''
  const prices = (data.items ?? []).map((i) => i.price?.id ?? '')
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  if (prices.includes(priceGift) || custom.kind === 'gift') {
    // One code per transaction; a repeated delivery of the same event changes nothing.
    const { error } = await supabase.from('gifts').upsert({ code: giftCode(), txn_id: txn, buyer: playerId }, { onConflict: 'txn_id', ignoreDuplicates: true })
    if (error) return new Response(error.message, { status: 500 })
    await supabase.rpc('bump', { p_event: 'purchase_gift' })
    return new Response('gift', { status: 200 })
  }

  if (!prices.includes(pricePlus) && custom.kind !== 'plus') return new Response('ignored', { status: 200 })
  if (!playerId) return new Response('no player', { status: 200 })
  const { data: existing } = await supabase.from('premium').select('until, source').eq('player_id', playerId).maybeSingle()
  if (existing?.source === `paddle:${txn}`) return new Response('already', { status: 200 })
  const base = Math.max(Date.now(), existing?.until ? Date.parse(existing.until as string) : 0)
  const until = new Date(base + YEAR).toISOString()
  const { error } = await supabase.from('premium').upsert({ player_id: playerId, until, source: `paddle:${txn}`, updated_at: new Date().toISOString() })
  if (error) return new Response(error.message, { status: 500 })
  await supabase.rpc('bump', { p_event: 'purchase' })
  return new Response('ok', { status: 200 })
})
