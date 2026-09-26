// Lemon Squeezy webhook: a paid order for the Plus pass adds one year to the buyer's account.
// Deploy with: supabase functions deploy plus-hook --no-verify-jwt
// Secrets: LEMON_SIGNING_SECRET (the signing secret of the webhook in the Lemon Squeezy dashboard).
// The checkout link must carry checkout[custom][player_id]=<player id>; the app adds that itself.
import { createClient } from 'npm:@supabase/supabase-js@2'

const YEAR = 365 * 24 * 3600 * 1000

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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 })
  const secret = Deno.env.get('LEMON_SIGNING_SECRET')
  if (!secret) return new Response('not configured', { status: 500 })
  const body = await req.text()
  const given = req.headers.get('x-signature') ?? ''
  if (!same(given.toLowerCase(), await hmacHex(secret, body))) return new Response('bad signature', { status: 401 })

  const event = JSON.parse(body)
  const name: string = event?.meta?.event_name ?? ''
  const playerId: string | undefined = event?.meta?.custom_data?.player_id
  const attrs = event?.data?.attributes ?? {}
  const paid = (name === 'order_created' && attrs.status === 'paid') || name === 'subscription_payment_success'
  if (!paid) return new Response('ignored', { status: 200 })
  if (!playerId || !/^[0-9a-f-]{36}$/i.test(playerId)) return new Response('no player', { status: 200 })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: existing } = await supabase.from('premium').select('until').eq('player_id', playerId).maybeSingle()
  const base = Math.max(Date.now(), existing?.until ? Date.parse(existing.until as string) : 0)
  const until = new Date(base + YEAR).toISOString()
  const { error } = await supabase.from('premium').upsert({ player_id: playerId, until, source: `lemon:${attrs.identifier ?? event?.data?.id ?? ''}`, updated_at: new Date().toISOString() })
  if (error) return new Response(error.message, { status: 500 })
  return new Response('ok', { status: 200 })
})
