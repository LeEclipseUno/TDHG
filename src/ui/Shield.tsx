import type { RoadKind } from '../data'

export interface ShieldProps {
  code: string
  kind: RoadKind
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

/** A Dutch road number sign. A-roads are red with white text, N-roads yellow with black text. */
export function Shield({ code, kind, size = 'md', className = '' }: ShieldProps) {
  return <span className={`shield shield-${kind === 'A' ? 'A' : 'N'} shield-${size} ${className}`}>{code}</span>
}
