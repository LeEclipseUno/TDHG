import type { Grade } from '../game/session'
import { IconLock } from './icons'

/** Countdown styled as a Dutch speed limit sign: white disc, red ring that depletes. */
export function SpeedSign({ remainingMs, totalMs, size = 48 }: { remainingMs: number; totalMs: number; size?: number }) {
  const r = size / 2 - 4
  const c = 2 * Math.PI * r
  const frac = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 1
  const secs = Math.ceil(remainingMs / 1000)
  const urgent = frac < 0.2
  return (
    <div className={'speed' + (urgent ? ' speed-urgent' : '')} style={{ width: size, height: size }} role="timer" aria-label={`${secs}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="#fff" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e6e6e6" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#c8102e"
          strokeWidth="6"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .1s linear' }}
        />
      </svg>
      <span className="speed-text">{secs}</span>
    </div>
  )
}

/** Score on a matrix sign: dark panel, amber digits. */
export function Matrix({ value, label, big = false }: { value: string | number; label?: string; big?: boolean }) {
  return (
    <div className={'matrix' + (big ? ' matrix-big' : '')}>
      {label && <span className="matrix-label">{label}</span>}
      <span className="matrix-value">{value}</span>
    </div>
  )
}

/** Progress as hectometre posts along a road strip. */
export function RouteStrip({ grades, total, current = -1 }: { grades: (Grade | undefined)[]; total: number; current?: number }) {
  const posts = Array.from({ length: total }, (_, i) => grades[i])
  return (
    <div className="strip" aria-hidden>
      {posts.map((g, i) => (
        <span key={i} className={'post' + (g ? ` post-${g}` : i === current ? ' post-current' : '')} />
      ))}
    </div>
  )
}

/** A sign board: blue panel with the white inner border of Dutch motorway signage. */
export function Board({ children, className = '', tone = 'blue' }: { children: React.ReactNode; className?: string; tone?: 'blue' | 'dark' | 'orange' }) {
  return (
    <div className={`board board-${tone} ${className}`}>
      <div className="board-inner">{children}</div>
    </div>
  )
}

/** Segmented control in the style of a sign plate. Locked options show a lock and still call onChange (the caller opens Plus). */
export function Seg<T extends string>({ value, options, onChange, label, wide = false }: { value: T; options: { v: T; label: string; title?: string; locked?: boolean }[]; onChange: (v: T) => void; label: string; wide?: boolean }) {
  return (
    <div className={'seg' + (wide ? ' seg-wide' : '') + (options.length > 3 ? ' seg-wrap' : '')} role="group" aria-label={label}>
      {options.map((o, i) => (
        <button key={o.v} type="button" className={'seg-btn' + (value === o.v ? ' seg-on' : '') + (o.locked ? ' seg-locked' : '') + (options.length > 3 && i % 3 === 0 ? ' row-start' : '') + (i >= 3 ? ' row-next' : '')} onClick={() => onChange(o.v)} title={o.title}>
          {o.locked && <IconLock className="seg-lock" />}
          {o.label}
        </button>
      ))}
    </div>
  )
}
