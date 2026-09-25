export interface TimerRingProps {
  remainingMs: number
  totalMs: number
  size?: number
}

/** Circular countdown. Turns orange under 40% and red under 20%. */
export function TimerRing({ remainingMs, totalMs, size = 46 }: TimerRingProps) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const frac = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 1
  const secs = Math.ceil(remainingMs / 1000)
  const color = frac < 0.2 ? 'var(--bad)' : frac < 0.4 ? 'var(--accent)' : 'var(--good)'
  return (
    <div className={'timer-ring' + (frac < 0.2 ? ' timer-urgent' : '')} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .1s linear, stroke .3s' }}
        />
      </svg>
      <span className="timer-ring-text" style={{ color }}>
        {secs}
      </span>
    </div>
  )
}
