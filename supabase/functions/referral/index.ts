// Referral code for a Plus player: a personal 50% discount code in Lemon Squeezy, made once and remembered.
// Deploy with: supabase functions deploy referral
// Secrets: LEMON_API_KEY (Settings, API in Lemon Squeezy), LEMON_STORE_ID (the number in the store's URL in the dashboard).
import { createClient } from 'npm:@supabase/supabase-js@2'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' }

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return 'WK' + [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return new Response('method', { status: 405, headers: cors })
  const apiKey = Deno.env.get('LEMON_API_KEY')
  const storeId = Deno.env.get('LEMON_STORE_ID')
  const paddleKey = Deno.env.get('PADDLE_API_KEY')
  const paddleBase = Deno.env.get('PADDLE_ENV') === 'sandbox' ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com'
  const paddlePrice = Deno.env.get('PADDLE_PRICE_PLUS') ?? ''
  // Which shop the code must work in: the SHOP secret, or 'paddle' asked for by the app while testing.
  let bodyShop = ''
  let action = ''
  try {
    const b = (await req.json()) as { action?: string; shop?: string }
    action = String(b.action ?? '')
    bodyShop = String(b.shop ?? '')
  } catch {
    /* no body */
  }
  const usePaddle = !!paddleKey && (Deno.env.get('SHOP') === 'paddle' || bodyShop === 'paddle')
  if (!usePaddle && (!apiKey || !storeId)) return new Response(JSON.stringify({ error: 'not configured' }), { status: 503, headers: { ...cors, 'content-type': 'application/json' } })

  // Who is asking: the player's own JWT.
  const auth = req.headers.get('authorization') ?? ''
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: userData } = await anon.auth.getUser()
  const user = userData.user
  if (!user || user.is_anonymous) return new Response(JSON.stringify({ error: 'sign in' }), { status: 401, headers: { ...cors, 'content-type': 'application/json' } })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: plus } = await admin.from('premium').select('until').eq('player_id', user.id).maybeSingle()
  if (!plus || Date.parse(plus.until as string) < Date.now()) return new Response(JSON.stringify({ error: 'no plus' }), { status: 403, headers: { ...cors, 'content-type': 'application/json' } })

  const { data: existing } = await admin.from('referrals').select('code, discount_id').eq('player_id', user.id).maybeSingle()
  const ok = (body: unknown) => new Response(JSON.stringify(body), { headers: { ...cors, 'content-type': 'application/json' } })
  if (usePaddle) {
    const hdr = { authorization: `Bearer ${paddleKey}`, 'content-type': 'application/json' }
    if (action === 'stats') {
      if (!existing?.discount_id) return ok({ uses: 0, saved: 0 })
      const res = await fetch(`${paddleBase}/discounts/${existing.discount_id}`, { headers: hdr })
      if (!res.ok) return new Response(JSON.stringify({ error: `shop ${res.status}` }), { status: 502, headers: { ...cors, 'content-type': 'application/json' } })
      const d = (await res.json()) as { data?: { times_used?: number } }
      const uses = Number(d.data?.times_used ?? 0)
      return ok({ uses, saved: uses * 200 })
    }
    if (existing?.code && existing.discount_id) return ok({ code: existing.code })
    const code = existing?.code ?? randomCode()
    const res = await fetch(`${paddleBase}/discounts`, {
      method: 'POST',
      headers: hdr,
      body: JSON.stringify({ description: `Vriend van ${user.id.slice(0, 8)}`, type: 'percentage', amount: '50', enabled_for_checkout: true, code, usage_limit: 25, recur: false, ...(paddlePrice ? { restrict_to: [paddlePrice] } : {}) }),
    })
    if (!res.ok) return new Response(JSON.stringify({ error: `shop ${res.status}` }), { status: 502, headers: { ...cors, 'content-type': 'application/json' } })
    const made = (await res.json()) as { data?: { id?: string } }
    const { error } = await admin.from('referrals').upsert({ player_id: user.id, code, discount_id: made.data?.id ?? null })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })
    return ok({ code })
  }
  if (action === 'stats') {
    // How often the code was redeemed and the total discount given, from the shop's own records.
    if (!existing?.code) return new Response(JSON.stringify({ uses: 0, saved: 0 }), { headers: { ...cors, 'content-type': 'application/json' } })
    const hdr = { authorization: `Bearer ${apiKey}`, accept: 'application/vnd.api+json' }
    const list = await fetch(`https://api.lemonsqueezy.com/v1/discounts?filter[store_id]=${storeId}&page[size]=100`, { headers: hdr })
    if (!list.ok) return new Response(JSON.stringify({ error: `shop ${list.status}` }), { status: 502, headers: { ...cors, 'content-type': 'application/json' } })
    const discounts = ((await list.json()) as { data?: { id: string; attributes: { code: string } }[] }).data ?? []
    const mine = discounts.find((d) => d.attributes.code === existing.code)
    if (!mine) return new Response(JSON.stringify({ uses: 0, saved: 0 }), { headers: { ...cors, 'content-type': 'application/json' } })
    const red = await fetch(`https://api.lemonsqueezy.com/v1/discount-redemptions?filter[discount_id]=${mine.id}&page[size]=100`, { headers: hdr })
    if (!red.ok) return new Response(JSON.stringify({ error: `shop ${red.status}` }), { status: 502, headers: { ...cors, 'content-type': 'application/json' } })
    const rows = ((await red.json()) as { data?: { attributes: { amount: number } }[] }).data ?? []
    const saved = rows.reduce((a, r) => a + (Number(r.attributes.amount) || 0), 0)
    return new Response(JSON.stringify({ uses: rows.length, saved }), { headers: { ...cors, 'content-type': 'application/json' } })
  }
  if (existing?.code) return new Response(JSON.stringify({ code: existing.code }), { headers: { ...cors, 'content-type': 'application/json' } })

  const code = randomCode()
  const res = await fetch('https://api.lemonsqueezy.com/v1/discounts', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, accept: 'application/vnd.api+json', 'content-type': 'application/vnd.api+json' },
    body: JSON.stringify({
      data: {
        type: 'discounts',
        attributes: { name: `Vriend van ${user.id.slice(0, 8)}`, code, amount: 50, amount_type: 'percent', is_limited_redemptions: true, max_redemptions: 25 },
        relationships: { store: { data: { type: 'stores', id: String(storeId) } } },
      },
    }),
  })
  if (!res.ok) return new Response(JSON.stringify({ error: `shop ${res.status}` }), { status: 502, headers: { ...cors, 'content-type': 'application/json' } })
  const { error } = await admin.from('referrals').insert({ player_id: user.id, code })
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, 'content-type': 'application/json' } })
  return new Response(JSON.stringify({ code }), { headers: { ...cors, 'content-type': 'application/json' } })
})
