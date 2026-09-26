// Crash log: uncaught errors go to a Supabase table so problems on players' phones are visible.
// No third party, nothing personal beyond the anonymous player id, at most a handful per session.
import { ensureSession, ONLINE, sb } from './backend'

const MAX_PER_SESSION = 5
const seen = new Set<string>()
let sent = 0

const IGNORE = [/ResizeObserver loop/, /extension:\/\//, /chrome-extension/, /moz-extension/, /Script error\.?$/, /Load failed/, /Failed to fetch/, /NetworkError/, /AbortError/]

async function report(message: string, stack: string | undefined, where: string) {
  if (!ONLINE || !navigator.onLine || sent >= MAX_PER_SESSION) return
  if (IGNORE.some((re) => re.test(message))) return
  const key = message.slice(0, 120)
  if (seen.has(key)) return
  seen.add(key)
  sent++
  try {
    const c = await sb()
    if (!c || !(await ensureSession())) return
    await c.from('errors').insert({
      message: message.slice(0, 500),
      stack: (stack ?? '').slice(0, 2000),
      where: where.slice(0, 200),
      url: location.href.slice(0, 300),
      ua: navigator.userAgent.slice(0, 300),
      build: typeof __BUILD__ === 'string' ? __BUILD__ : '',
      lang: navigator.language,
      screen: `${window.innerWidth}x${window.innerHeight}`,
    })
  } catch {
    /* never let the logger itself cause trouble */
  }
}

/** Installs the global handlers. Call once at startup. */
export function installErrorLog() {
  window.addEventListener('error', (e) => {
    const err = e.error as Error | undefined
    void report(err?.message ?? e.message ?? 'error', err?.stack, `${e.filename ?? ''}:${e.lineno ?? 0}`)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as Error | string | undefined
    const message = typeof r === 'string' ? r : (r?.message ?? 'unhandled rejection')
    void report(message, typeof r === 'object' ? r?.stack : undefined, 'promise')
  })
}

/** For caught errors that are still worth knowing about. */
export function logError(err: unknown, where: string) {
  const e = err as Error
  void report(e?.message ?? String(err), e?.stack, where)
}
