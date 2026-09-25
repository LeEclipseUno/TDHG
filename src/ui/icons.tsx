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
export const IconReplay = (p: P) => (
  <svg {...line} {...p}>
    <path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5" />
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
    <rect x="11" y="5" width="26" height="14" rx="2.5" fill="#c8102e" stroke="#fff" strokeWidth="2" />
    <rect x="14" y="8" width="20" height="8" rx="1.5" stroke="#fff" strokeWidth="1.2" />
    <path d="M24 22v9M20 27.5l4 4 4-4" />
    <path d="M5 43c7-8 31-8 38 0" strokeWidth="3.2" />
    <path d="M13 40.5h4M22 38.5h4M31 40.5h4" strokeWidth="1.8" strokeDasharray="0" />
  </svg>
)
export const PictFind = (p: P) => (
  <svg {...pict} {...p}>
    <path d="M17 44L22 4M31 44L26 4" strokeWidth="3" />
    <path d="M24 8v4M24 36v4" strokeWidth="2" />
    <circle cx="24" cy="24" r="8" strokeWidth="2.8" />
    <circle cx="24" cy="24" r="2.4" fill="#fff" stroke="none" />
    <path d="M24 13v4M24 31v4M13 24h4M31 24h4" strokeWidth="2.2" />
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

/** A hectometre post pictogram, used as the app's small brand mark. */
export const PictPost = (p: P) => (
  <svg width="16" height="24" viewBox="0 0 16 24" aria-hidden {...p}>
    <rect x="3" y="1" width="10" height="22" rx="1.5" fill="#1f8f4e" />
    <rect x="4.5" y="3" width="7" height="6" rx="0.8" fill="#fff" />
  </svg>
)
