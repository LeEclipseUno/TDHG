// Account self-service: export everything stored about the player as JSON, or delete the account and all of its rows.
// Deploy with: supabase functions deploy account
// Body: { "action": "export" } or { "action": "delete" }. Needs the player's JWT (the app sends it).
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const auth = req.headers.get('authorization') ?? ''
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: userData } = await anon.auth.getUser()
  const user = userData.user
  if (!user) return json({ error: 'sign in' }, 401)
  let action = ''
  try {
    action = String(((await req.json()) as { action?: string }).action ?? '')
  } catch {
    /* no body */
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const id = user.id

  if (action === 'export') {
    const [scores, members, premium, subs, state, referrals, shares] = await Promise.all([
      admin.from('daily_scores').select('daily, nickname, score, good, total, ms, created_at').eq('player_id', id),
      admin.from('members').select('nickname, joined_at, groups(code, name)').eq('player_id', id),
      admin.from('premium').select('until, source, updated_at').eq('player_id', id),
      admin.from('push_subs').select('hour, minute, tz, lang, updated_at').eq('player_id', id),
      admin.from('player_state').select('state, updated_at').eq('player_id', id),
      admin.from('referrals').select('code, created_at').eq('player_id', id),
      admin.from('shares').select('id, title, text, created_at').eq('player_id', id),
    ])
    return json({
      exported_at: new Date().toISOString(),
      account: { id, email: user.email ?? null, created_at: user.created_at, providers: user.app_metadata?.providers ?? [], anonymous: !!user.is_anonymous },
      daily_scores: scores.data ?? [],
      groups: members.data ?? [],
      plus: premium.data ?? [],
      reminders: subs.data ?? [],
      cloud_save: state.data ?? [],
      referral: referrals.data ?? [],
      shares: shares.data ?? [],
    })
  }

  if (action === 'delete') {
    // Groups the player created stay for the other members; only the membership goes.
    for (const table of ['push_subs', 'referrals', 'player_state', 'premium', 'daily_scores', 'members', 'shares', 'errors']) {
      const { error } = await admin.from(table).delete().eq('player_id', id)
      if (error && !/does not exist/.test(error.message)) return json({ error: `${table}: ${error.message}` }, 500)
    }
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) return json({ error: error.message }, 500)
    return json({ deleted: true })
  }

  return json({ error: 'unknown action' }, 400)
})
