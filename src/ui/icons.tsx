import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const line = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export const IconBack = (p: P) => (
  <svg {...line} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)
export const IconClose = (p: P) => (
  <svg {...line} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const IconShare = (p: P) => (
  <svg {...line} {...p}>
    <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5M5 13v7h14v-7" />
  </svg>
)
export const IconCopy = (p: P) => (
  <svg {...line} {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </svg>
)
export const IconReplay = (p: P) => (
  <svg {...line} {...p}>
    <path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5" />
  </svg>
)
export const IconHouse = (p: P) => (
  <svg {...line} {...p}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v10h5v-6h2v6h5V10" />
  </svg>
)
export const IconCalendar = (p: P) => (
  <svg {...line} {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <path d="M9 14l2 2 4-4" />
  </svg>
)
export const IconPeople = (p: P) => (
  <svg {...line} {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <circle cx="16.5" cy="9.5" r="2.5" />
    <path d="M3.5 19c.5-3.5 2.8-5 5.5-5s5 1.5 5.5 5" />
    <path d="M15 14.5c2.5 0 4.5 1.3 5 4.5" />
  </svg>
)
export const IconUser = (p: P) => (
  <svg {...line} {...p}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" />
  </svg>
)
export const IconMenu = (p: P) => (
  <svg {...line} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)
export const IconPlus = (p: P) => (
  <svg {...line} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const IconMinus = (p: P) => (
  <svg {...line} {...p}>
    <path d="M5 12h14" />
  </svg>
)
export const IconFit = (p: P) => (
  <svg {...line} {...p}>
    <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
  </svg>
)
export const IconHint = (p: P) => (
  <svg {...line} {...p}>
    <path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" />
  </svg>
)
export const IconCheck = (p: P) => (
  <svg {...line} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
)
export const IconCross = (p: P) => (
  <svg {...line} {...p}>
    <path d="M7 7l10 10M17 7L7 17" />
  </svg>
)
export const IconTilde = (p: P) => (
  <svg {...line} {...p}>
    <path d="M4 13c2-4 5-4 8 0s6 4 8 0" />
  </svg>
)
export const IconClock = (p: P) => (
  <svg {...line} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)
export const IconFlag = (p: P) => (
  <svg {...line} {...p}>
    <path d="M5 21V4h11l-2 4 2 4H5" />
  </svg>
)
export const IconImage = (p: P) => (
  <svg {...line} {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <path d="M7 15l3.5-4 3 3 2-2 2.5 3" />
    <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)
/** Seasonal marks: crown, mitre, snowflake, confetti. */
export const SeasonIcon = ({ season }: { season: 'kingsday' | 'sinterklaas' | 'christmas' | 'carnaval' }) => {
  const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
  if (season === 'kingsday')
    return (
      <svg {...base}>
        <path d="M4 18h16l1-10-5 4-4-6-4 6-5-4z" fill="#ef712f" stroke="#ef712f" />
      </svg>
    )
  if (season === 'sinterklaas')
    return (
      <svg {...base}>
        <path d="M7 20V9l5-6 5 6v11z" fill="#c90002" stroke="#c90002" />
        <path d="M12 8v9" stroke="#fff" />
      </svg>
    )
  if (season === 'christmas')
    return (
      <svg {...base}>
        <path d="M12 3v18M4 7.5l16 9M4 16.5l16-9M12 3l-2 2M12 3l2 2M12 21l-2-2M12 21l2-2" />
      </svg>
    )
  return (
    <svg {...base}>
      <circle cx="6" cy="7" r="2" fill="#ef712f" stroke="none" />
      <circle cx="17" cy="5" r="2" fill="#ffd23f" stroke="none" />
      <circle cx="19" cy="15" r="2" fill="#34d17c" stroke="none" />
      <circle cx="9" cy="17" r="2" fill="#c90002" stroke="none" />
      <path d="M12 11l1 2" />
    </svg>
  )
}

export const IconPencil = (p: P) => (
  <svg {...line} {...p}>
    <path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20z" />
    <path d="M13.5 7.5l3 3" />
  </svg>
)

export const IconLock = (p: P) => (
  <svg {...line} {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
)

export const IconFreeze = (p: P) => (
  <svg {...line} {...p} width="14" height="14" strokeWidth="2">
    <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5" />
  </svg>
)
export const IconGoogle = (p: P) => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden {...p}>
    <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" />
    <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
    <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" />
    <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z" />
  </svg>
)
export const IconChat = (p: P) => (
  <svg {...line} {...p}>
    <path d="M4 5.5h16v10H9l-5 4z" />
    <path d="M8 9h8M8 12h5" />
  </svg>
)

/** The filled arrow used on Dutch direction signs. */
export const IconSignArrow = (p: P) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M3 9.5h10V4l8 8-8 8v-5.5H3z" />
  </svg>
)

/* ---- mode pictograms, white on a sign, 48x48 ---- */

const pict = { width: 48, height: 48, viewBox: '0 0 48 48', fill: 'none', stroke: '#fff', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

export const PictDrag = (p: P) => (
  <svg {...pict} {...p}>
    <path d="M4 44c8-9 32-9 40 0" strokeWidth="3.4" />
    <rect x="15" y="26" width="18" height="11" rx="1.8" strokeWidth="1.8" strokeDasharray="3 2.2" />
    <path d="M24 17.5v5.5" strokeWidth="2.2" />
    <path d="M20.5 20l3.5 3.5 3.5-3.5" strokeWidth="2.2" />
    <g transform="rotate(-6 24 10)">
      <rect x="14" y="4" width="20" height="12" rx="2" fill="#c8102e" stroke="#fff" strokeWidth="1.8" />
      <text x="24" y="13.6" textAnchor="middle" fontFamily="'Barlow Condensed', system-ui, sans-serif" fontSize="10" fontWeight="800" fill="#fff" stroke="none">
        A2
      </text>
    </g>
  </svg>
)
export const PictFind = (p: P) => (
  <svg {...pict} {...p}>
    <circle cx="18" cy="19" r="11.5" strokeWidth="3" />
    <path d="M7.5 21c4 1.5 5.5-6.5 10.5-6.5s5 6.5 10 3" strokeWidth="3.2" />
    <path d="M27 28l13 13" strokeWidth="4.5" />
    <rect x="31" y="4" width="14" height="10" rx="2" fill="#c8102e" stroke="#fff" strokeWidth="1.8" />
    <text x="38" y="11.8" textAnchor="middle" fontFamily="'Barlow Condensed', system-ui, sans-serif" fontSize="8.5" fontWeight="800" fill="#fff" stroke="none">
      A2
    </text>
  </svg>
)
export const PictJunction = (p: P) => (
  <svg {...pict} {...p}>
    <path d="M24 3v42M3 24h42" strokeWidth="3.6" />
    <path d="M24 16a7 7 0 1 1-8 8" strokeWidth="2.4" />
    <path d="M32 24a7 7 0 1 1-8-8" strokeWidth="2.4" />
    <path d="M24 32a7 7 0 1 1 8-8" strokeWidth="2.4" />
    <path d="M16 24a7 7 0 1 1 8 8" strokeWidth="2.4" />
  </svg>
)
export const PictQuiz = (p: P) => (
  <svg {...pict} {...p}>
    <rect x="10" y="7" width="28" height="16" rx="2.5" fill="#c8102e" stroke="#fff" strokeWidth="2" />
    <text x="24" y="19.5" textAnchor="middle" fontFamily="'Barlow Condensed', system-ui, sans-serif" fontSize="15" fontWeight="800" fill="#fff" stroke="none">
      A?
    </text>
    <path d="M5 43c7-8 31-8 38 0" strokeWidth="3.2" />
    <path d="M24 28v6" strokeWidth="2.2" />
  </svg>
)

export const PictLearn = (p: P) => (
  <svg {...pict} {...p}>
    <rect x="14" y="8" width="28" height="18" rx="2.5" strokeWidth="2.2" />
    <rect x="9" y="14" width="28" height="18" rx="2.5" fill="#0d4a9c" strokeWidth="2.2" />
    <rect x="4" y="20" width="28" height="18" rx="2.5" fill="#0d4a9c" strokeWidth="2.2" />
    <rect x="9" y="25" width="18" height="8" rx="1.5" fill="#c8102e" stroke="#fff" strokeWidth="1.4" />
    <path d="M36 40l4 4 6-8" strokeWidth="2.6" />
  </svg>
)

export const PictExit = (p: P) => (
  <svg {...pict} {...p}>
    <path d="M14 44V4" strokeWidth="3.4" />
    <path d="M16 26c6 3 10 8 11 18" strokeWidth="3" />
    <rect x="24" y="6" width="19" height="13" rx="2" fill="#fff" stroke="none" />
    <text x="33.5" y="16" textAnchor="middle" fontFamily="'Barlow Condensed', system-ui, sans-serif" fontSize="11" fontWeight="800" fill="#0d4a9c" stroke="none">
      12
    </text>
    <path d="M33 22v6M30 25l3 3 3-3" strokeWidth="2.2" />
  </svg>
)
export const PictRoute = (p: P) => (
  <svg {...pict} {...p}>
    <circle cx="10" cy="38" r="5" fill="#fff" stroke="none" />
    <circle cx="38" cy="10" r="5" fill="#fff" stroke="none" />
    <path d="M10 33c0-10 6-12 14-12s14-2 14-11" strokeWidth="3" strokeDasharray="5 4" />
    <rect x="18" y="19" width="14" height="8" rx="1.5" fill="#c8102e" stroke="#fff" strokeWidth="1.4" />
  </svg>
)
export const PictDistance = (p: P) => (
  <svg {...pict} {...p}>
    <circle cx="9" cy="36" r="4.5" fill="#fff" stroke="none" />
    <circle cx="39" cy="12" r="4.5" fill="#fff" stroke="none" />
    <path d="M9 31c0-9 6-11 15-11s15-2 15-8" strokeWidth="3" />
    <path d="M6 44h36" strokeWidth="2.4" />
    <path d="M10 41v6M17 42v4M24 41v6M31 42v4M38 41v6" strokeWidth="2" />
    <text x="24" y="15" textAnchor="middle" fontFamily="'Barlow Condensed', system-ui, sans-serif" fontSize="12" fontWeight="800" fill="#fff" stroke="none">
      km?
    </text>
  </svg>
)
export const PictSign = (p: P) => (
  <svg {...pict} {...p}>
    <rect x="5" y="7" width="38" height="24" rx="3" fill="#0d4a9c" stroke="#fff" strokeWidth="2.2" />
    <path d="M12 21V13M9 16l3-3 3 3" strokeWidth="2.2" />
    <path d="M20 16h14M20 22h10" strokeWidth="2.6" />
    <path d="M15 31v13M33 31v13" strokeWidth="3" />
    <rect x="30" y="12" width="9" height="6" rx="1" fill="#c8102e" stroke="#fff" strokeWidth="1" />
  </svg>
)
export const PictStats = (p: P) => (
  <svg {...pict} {...p}>
    <path d="M8 40h32" strokeWidth="3" />
    <rect x="11" y="24" width="7" height="14" rx="1" fill="#fff" stroke="none" />
    <rect x="21" y="14" width="7" height="24" rx="1" fill="#fff" stroke="none" />
    <rect x="31" y="20" width="7" height="18" rx="1" fill="#fff" stroke="none" />
  </svg>
)

export const PictGroup = (p: P) => (
  <svg {...pict} {...p}>
    <circle cx="10" cy="22" r="4" strokeWidth="2.4" />
    <path d="M4 34c0-4.5 2.7-7 6-7s6 2.5 6 7" strokeWidth="2.4" />
    <circle cx="24" cy="14.5" r="4.5" strokeWidth="2.4" />
    <path d="M17 28c0-5 3-7.5 7-7.5s7 2.5 7 7.5" strokeWidth="2.4" />
    <circle cx="38" cy="24" r="4" strokeWidth="2.4" />
    <path d="M32 36c0-4.5 2.7-7 6-7s6 2.5 6 7" strokeWidth="2.4" />
    <rect x="4" y="36" width="12" height="8" rx="1" fill="#fff" stroke="none" />
    <rect x="18" y="30" width="12" height="14" rx="1" fill="#fff" stroke="none" />
    <rect x="32" y="38" width="12" height="6" rx="1" fill="#fff" stroke="none" />
    <text x="24" y="41.5" textAnchor="middle" fontFamily="'Barlow Condensed', system-ui, sans-serif" fontSize="11" fontWeight="800" fill="#0d4a9c" stroke="none">
      1
    </text>
  </svg>
)

/** A hectometre post pictogram, used as the app's small brand mark. */
export const PictPost = (p: P) => (
  <svg width="16" height="24" viewBox="0 0 16 24" aria-hidden {...p}>
    <rect x="3" y="1" width="10" height="22" rx="1.5" fill="#1f8f4e" />
    <rect x="4.5" y="3" width="7" height="6" rx="0.8" fill="#fff" />
  </svg>
)

/** Small gold shield with a plus, shown next to Plus members. */
/** The Plus pass: a blue motorway sign with a bold plus on it. */
export const IconPlusSign = (p: P) => (
  <svg width="36" height="36" viewBox="0 0 48 48" aria-hidden {...p}>
    <rect x="3" y="8" width="42" height="32" rx="5" fill="#154889" />
    <rect x="6.5" y="11.5" width="35" height="25" rx="3" fill="none" stroke="#fff" strokeWidth="1.8" />
    <path d="M24 16.5v15M16.5 24h15" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
    <rect x="30" y="4" width="15" height="9" rx="2" fill="#ffb000" stroke="#0a1628" strokeWidth="1.2" />
    <path d="M37.5 6v5M35 8.5h5" stroke="#0a1628" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

export const PlusMark = (p: P) => (
  <svg width="18" height="14" viewBox="0 0 18 14" className="plus-mark" aria-label="Plus" {...p}>
    <rect x="0.5" y="0.5" width="17" height="13" rx="2.5" fill="#ffb000" stroke="#0a1628" strokeWidth="1" />
    <rect x="2.5" y="2.5" width="13" height="9" rx="1.5" fill="none" stroke="#0a1628" strokeWidth="1" />
    <path d="M9 4v6M6 7h6" stroke="#0a1628" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

/** Red road shield with initials: the avatar of a Plus player without a picture. */
const SHIELD_LOOK: Record<string, { bg: string; ink: string }> = {
  A: { bg: '#c8102e', ink: '#fff' },
  N: { bg: '#ffd23f', ink: '#111' },
  E: { bg: '#1f8f4e', ink: '#fff' },
  B: { bg: '#0d4a9c', ink: '#fff' },
}
export const InitialsShield = ({ text, size = 38, style = 'A' }: { text: string; size?: number; style?: string }) => {
  const look = SHIELD_LOOK[style] ?? SHIELD_LOOK.A
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="3" y="9" width="42" height="30" rx="5" fill={look.bg} />
      <rect x="7" y="13" width="34" height="22" rx="3" fill="none" stroke={look.ink} strokeWidth="2.2" />
      <text x="24" y="31" textAnchor="middle" fontFamily="Overpass, 'Barlow Condensed', system-ui, sans-serif" fontSize={text.length > 1 ? 15 : 18} fontWeight="800" fill={look.ink}>
        {text}
      </text>
    </svg>
  )
}
