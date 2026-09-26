// Daily reminder: called once an hour (pg_cron, see schema.sql). Sends a push to every subscription whose
// local hour is now and whose player has not played today's daily yet.
// Deploy with: supabase functions deploy remind --no-verify-jwt
// Secrets: VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT (mailto:you@example.com), CRON_SECRET.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const EPOCH = Date.UTC(2026, 8, 26) // daily #1, see src/game/daily.ts
const SITE = 'https://wegenkenner.nl/'

const TEXT = {
  nl: { title: 'Wegenkenner', body: 'De dagelijkse puzzel van vandaag staat klaar. Houd je reeks in leven.' },
  en: { title: 'Wegenkenner', body: "Today's daily puzzle is waiting. Keep your streak alive." },
}

function localParts(now: Date, tz: string): { hour: number; date: string } {
  try {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' })
    const parts = Object.fromEntries(f.formatToParts(now).map((p) => [p.type, p.value]))
    return { hour: Number(parts.hour) % 24, date: `${parts.year}-${parts.month}-${parts.day}` }
  } catch {
    return localParts(now, 'Europe/Amsterdam')
  }
}

function dailyNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86_400_000) + 1
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('forbidden', { status: 403 })
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@wegenkenner.nl', Deno.env.get('VAPID_PUBLIC')!, Deno.env.get('VAPID_PRIVATE')!)
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const now = new Date()
  const { data: subs, error } = await supabase.from('push_subs').select('player_id, endpoint, p256dh, auth, hour, tz, lang')
  if (error) return new Response(error.message, { status: 500 })

  const due = (subs ?? []).filter((s) => localParts(now, s.tz).hour === s.hour)
  let sent = 0
  const gone: string[] = []
  for (const s of due) {
    const { date } = localParts(now, s.tz)
    const n = dailyNumber(date)
    const { data: played } = await supabase.from('daily_scores').select('daily').eq('player_id', s.player_id).eq('daily', n).maybeSingle()
    if (played) continue
    const t = TEXT[s.lang === 'en' ? 'en' : 'nl']
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: `${t.title} #${n}`, body: t.body, url: `${SITE}#daily` }), { TTL: 3600 })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) gone.push(s.endpoint)
    }
  }
  if (gone.length) await supabase.from('push_subs').delete().in('endpoint', gone)
  return new Response(JSON.stringify({ due: due.length, sent, removed: gone.length }), { headers: { 'content-type': 'application/json' } })
})
