// Gift code: a Lemon Squeezy license key from the "Plus cadeau" product. Activating it here grants a year of Plus.
// Deploy with: supabase functions deploy redeem
// No secrets needed: the license activation endpoint is public and single-use per key (activation limit 1 on the product).
import { createClient } from 'npm:@supabase/supabase-js@2'

const YEAR = 365 * 24 * 3600 * 1000
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const auth = req.headers.get('authorization') ?? ''
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: userData } = await anon.auth.getUser()
  const user = userData.user
  if (!user || user.is_anonymous) return json({ error: 'sign in' }, 401)

  let key = ''
  try {
    key = String(((await req.json()) as { key?: string }).key ?? '').trim()
  } catch {
    /* no body */
  }
  if (!/^[0-9A-Fa-f-]{20,}$/.test(key)) return json({ error: 'bad key' }, 400)

  const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ license_key: key, instance_name: user.id }),
  })
  const out = (await res.json().catch(() => ({}))) as { activated?: boolean; error?: string }
  if (!res.ok || !out.activated) return json({ error: out.error ?? 'invalid' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: existing } = await admin.from('premium').select('until').eq('player_id', user.id).maybeSingle()
  const base = Math.max(Date.now(), existing?.until ? Date.parse(existing.until as string) : 0)
  const until = new Date(base + YEAR).toISOString()
  const { error } = await admin.from('premium').upsert({ player_id: user.id, until, source: `gift:${key.slice(0, 8)}`, updated_at: new Date().toISOString() })
  if (error) return json({ error: error.message }, 500)
  return json({ until })
})
