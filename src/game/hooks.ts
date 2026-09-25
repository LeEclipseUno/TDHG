import { useEffect, useRef, useState } from 'react'

/** A timestamp that ticks while active. Drives all timers. */
export function useNow(active: boolean, interval = 100): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), interval)
    return () => window.clearInterval(id)
  }, [active, interval])
  return now
}

/** Runs fn once after ms; cancelled on unmount or when key changes. */
export function useTimeout(fn: (() => void) | null, ms: number, key: unknown) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    if (!fnRef.current) return
    const id = window.setTimeout(() => fnRef.current?.(), ms)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ms])
}

/** Short-lived UI message. */
export function useToast(): [string | null, (msg: string, ms?: number) => void] {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef(0)
  const show = (m: string, ms = 1600) => {
    setMsg(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), ms)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return [msg, show]
}
