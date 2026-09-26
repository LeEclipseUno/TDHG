// Cloudflare Worker: serves share previews from wegenkenner.nl/s/<id> by proxying to the Supabase function.
// Setup: move the domain's DNS to Cloudflare (free plan), keep the GitHub Pages A records (proxy on or off),
// create a Worker with this code, add the route  wegenkenner.nl/s/*  to it, and set the variable SUPABASE_URL
// (for example https://ppkpzvyzlmambyqdiorw.supabase.co). Then set VITE_SHARE_BASE=https://wegenkenner.nl/s
// in .env.production so the app hands out the short links.
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const id = url.pathname.replace(/^\/s\/?/, '').split('/')[0]
    if (!id) return Response.redirect('https://wegenkenner.nl/', 302)
    const upstream = `${env.SUPABASE_URL}/functions/v1/s/${encodeURIComponent(id)}`
    const res = await fetch(upstream, { headers: { 'user-agent': request.headers.get('user-agent') ?? '' } })
    const headers = new Headers(res.headers)
    headers.set('cache-control', 'public, max-age=300')
    return new Response(res.body, { status: res.status, headers })
  },
}
