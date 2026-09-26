// Share link preview: an HTML page with the player's own card as Open Graph image that sends people on to the game.
// Deploy with: supabase functions deploy s --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2'

const SITE = 'https://wegenkenner.nl/'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const id = url.pathname.split('/').filter(Boolean).pop() ?? ''
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data } = await supabase.from('shares').select('title, text, image, param').eq('id', id).maybeSingle()
  const target = data?.param ? `${SITE}?c=${encodeURIComponent(data.param)}` : SITE
  const title = data?.title ?? 'Wegenkenner'
  const text = data?.text ?? 'Ken jij het Nederlandse wegennet uit je hoofd?'
  const image = data?.image ?? `${SITE}og.jpg`
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(text)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(target)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a1628;color:#f7f8fa;font-family:system-ui,sans-serif}a{color:#ffb000}</style>
</head><body><p><a href="${esc(target)}">${esc(title)}</a></p><script>location.replace(${JSON.stringify(target)})</script></body></html>`
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } })
})
