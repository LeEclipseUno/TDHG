import type { Road } from '../data'

export interface DirectionSignProps {
  junction: string
  ahead: string[]
  exit: { road: Road; to: string } | null
}

/** A Dutch overhead direction sign: blue, white border, straight-ahead panel and an exit panel with the crossing road's shield. */
export function DirectionSign({ junction, ahead, exit }: DirectionSignProps) {
  const rows = ahead.length + (exit ? 1 : 0)
  const h = 74 + rows * 58
  return (
    <svg className="direction-sign" viewBox={`0 0 420 ${h}`} width="420" height={h} role="img" aria-label={`${junction}: ${ahead.join(', ')}${exit ? `, ${exit.road.ref} ${exit.to}` : ''}`}>
      <rect x="2" y="2" width="416" height={h - 4} rx="14" fill="#0d4a9c" stroke="#062a5e" strokeWidth="2" />
      <rect x="12" y="12" width="396" height={h - 24} rx="8" fill="none" stroke="#fff" strokeWidth="4" />
      <text x="30" y="48" fontFamily="'Barlow Condensed', system-ui, sans-serif" fontSize="22" fontWeight="600" fill="#fff" opacity="0.85">
        Knooppunt {junction}
      </text>
      <line x1="24" y1="62" x2="396" y2="62" stroke="#fff" strokeWidth="2" opacity="0.6" />
      {ahead.map((name, i) => (
        <g key={name} transform={`translate(0 ${70 + i * 58})`}>
          <path d="M40 46 V16 M28 28 L40 14 L52 28" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <text x="72" y="42" fontFamily="'Barlow Condensed', system-ui, sans-serif" fontSize="38" fontWeight="700" fill="#fff">
            {name}
          </text>
        </g>
      ))}
      {exit && (
        <g transform={`translate(0 ${70 + ahead.length * 58})`}>
          <path d="M28 46 L48 18 M36 16 L50 14 L52 28" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="70" y="10" width={exit.road.ref.length > 2 ? 78 : 62} height="34" rx="5" fill={exit.road.kind === 'A' ? '#c8102e' : '#ffd23f'} stroke="#fff" strokeWidth="2.5" />
          <text x={70 + (exit.road.ref.length > 2 ? 39 : 31)} y="35" textAnchor="middle" fontFamily="Overpass, 'Barlow Condensed', system-ui, sans-serif" fontSize="24" fontWeight="800" fill={exit.road.kind === 'A' ? '#fff' : '#111'}>
            {exit.road.ref}
          </text>
          <text x={70 + (exit.road.ref.length > 2 ? 92 : 76)} y="42" fontFamily="'Barlow Condensed', system-ui, sans-serif" fontSize="38" fontWeight="700" fill="#fff">
            {exit.to}
          </text>
        </g>
      )}
    </svg>
  )
}
