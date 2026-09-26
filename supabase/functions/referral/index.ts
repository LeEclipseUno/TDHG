// Referral code for a Plus player: a personal 50% discount code in Lemon Squeezy, made once and remembered.
// Deploy with: supabase functions deploy referral
// Secrets: LEMON_API_KEY (Settings, API in Lemon Squeezy), LEMON_STORE_ID (the number in the store's URL in the dashboard).
import { createClient } from 'npm:@supabase/supabase-js@2'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS' }

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return 'WK' + [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return new Response('method', { status: 405, headers: cors })
  const apiKey = Deno.env.get('LEMON_API_KEY')
  const storeId = Deno.env.get('LEMON_STORE_ID')
  if (!apiKey || !storeId) return new Response(JSON.stringify({ error: 'not configured' }), { status: 503, headers: { ...cors, 'content-type': 'application/json' } })

  // Who is asking: the player's own JWT.
  const auth = req.headers.get('authorization') ?? ''
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: userData } = await anon.auth.getUser()
  const user = userData.user
  if (!user || user.is_anonymous) return new Response(JSON.stringify({ error: 'sign in' }), { status: 401, headers: { ...cors, 'content-type': 'application/json' } })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: plus } = await admin.from('premium').select('until').eq('player_id', user.id).maybeSingle()
  if (!plus || Date.parse(plus.until as string) < Date.now()) return new Response(JSON.stringify({ error: 'no plus' }), { status: 403, headers: { ...cors, 'content-type': 'application/json' } })

  const { data: existing } = await admin.from('referrals').select('code').eq('player_id', user.id).maybeSingle()
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
