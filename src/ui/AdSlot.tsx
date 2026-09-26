import { useEffect, useRef } from 'react'

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined
const SLOTS: Record<string, string | undefined> = {
  home: import.meta.env.VITE_ADSENSE_SLOT_HOME as string | undefined,
  results: import.meta.env.VITE_ADSENSE_SLOT_RESULTS as string | undefined,
}

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

let scriptAdded = false
function ensureScript() {
  if (scriptAdded || !CLIENT) return
  scriptAdded = true
  const s = document.createElement('script')
  s.async = true
  s.crossOrigin = 'anonymous'
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CLIENT)}`
  document.head.appendChild(s)
}

/** One responsive AdSense unit. Renders nothing without a configured client, for Plus players, or offline. */
export function AdSlot({ place, plus }: { place: 'home' | 'results'; plus: boolean }) {
  const ref = useRef<HTMLModElement>(null)
  const slot = SLOTS[place]
  const show = !!CLIENT && !!slot && !plus && navigator.onLine
  useEffect(() => {
    if (!show) return
    ensureScript()
    try {
      ;(window.adsbygoogle = window.adsbygoogle ?? []).push({})
    } catch {
      /* blocked */
    }
  }, [show])
  if (!show) return null
  return (
    <div className="ad-slot">
      <ins ref={ref} className="adsbygoogle" style={{ display: 'block' }} data-ad-client={CLIENT} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </div>
  )
}
