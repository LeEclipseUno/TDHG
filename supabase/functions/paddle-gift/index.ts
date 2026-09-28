// After a gift purchase through Paddle, the app asks for the code that the webhook created for that transaction.
// Deploy with: supabase functions deploy paddle-gift
// Body: { "txn": "txn_..." }. The transaction id is only known to the buyer's browser, which is what makes this safe.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type', 'access-control-allow-methods': 'POST, OPTIONS' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  let txn = ''
  try {
    txn = String(((await req.json()) as { txn?: string }).txn ?? '').trim()
  } catch {
    /* no body */
  }
  if (!/^txn_[a-z0-9]{20,40}$/i.test(txn)) return json({ error: 'bad transaction' }, 400)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await admin.from('gifts').select('code').eq('txn_id', txn).maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!data) return json({ pending: true }, 202)
  return json({ code: data.code })
})
