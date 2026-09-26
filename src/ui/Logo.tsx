/** The Wegenkenner sign as inline SVG, so the shield's number can change (type a road number on the home screen). */
export function Logo({ code = 'A', onShieldTap }: { code?: string; onShieldTap?: () => void }) {
  const size = 220
  const w = size
  const h = size * 0.86
  const r = size * 0.13
  const fontSize = code.length > 2 ? size * 0.5 : code.length > 1 ? size * 0.62 : size * 0.78
  const kind = code.startsWith('N') ? 'N' : 'A'
  return (
    <svg className="home-logo" viewBox="0 0 1200 380" role="img" aria-label="Wegenkenner">
      <defs>
        <linearGradient id="wk-sign" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e6be0" />
          <stop offset="0.55" stopColor="#0d4a9c" />
          <stop offset="1" stopColor="#093a80" />
        </linearGradient>
        <linearGradient id="wk-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.10" />
          <stop offset="0.65" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="wk-shield-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e0332b" />
          <stop offset="1" stopColor="#b80d26" />
        </linearGradient>
        <linearGradient id="wk-shield-n" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset="1" stopColor="#f0b400" />
        </linearGradient>
        <filter id="wk-drop" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>
      <g filter="url(#wk-drop)">
        <rect x="20" y="70" width="1080" height="240" rx="26" fill="url(#wk-sign)" />
        <rect x="20" y="70" width="1080" height="240" rx="26" fill="url(#wk-sheen)" />
        <rect x="20" y="70" width="1080" height="240" rx="26" fill="none" stroke="#062a5e" strokeWidth="3" />
        <rect x="36" y="86" width="1048" height="208" rx="16" fill="none" stroke="#fff" strokeWidth="8" />
      </g>
      <text x="66" y="262" fontFamily="'Barlow Condensed', system-ui, sans-serif" fontWeight="800" fontSize="176" fill="#fff" textLength="815" lengthAdjust="spacingAndGlyphs">
        WEGENKENNER
      </text>
      <g transform="translate(1020 190) rotate(-9)" filter="url(#wk-drop)" onClick={onShieldTap} style={onShieldTap ? { cursor: 'pointer' } : undefined}>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={r} fill={kind === 'A' ? 'url(#wk-shield-a)' : 'url(#wk-shield-n)'} stroke={kind === 'A' ? '#fff' : '#111'} strokeWidth={size * 0.05} />
        <rect x={-w / 2 + size * 0.09} y={-h / 2 + size * 0.09} width={w - size * 0.18} height={h - size * 0.18} rx={r * 0.6} fill="none" stroke={kind === 'A' ? '#fff' : '#111'} strokeWidth={size * 0.035} />
        <text x="0" y={h * 0.31 * (fontSize / (size * 0.78)) + (code.length > 1 ? h * 0.08 : 0)} textAnchor="middle" fontFamily="'Barlow Condensed', system-ui, sans-serif" fontWeight="800" fontSize={fontSize} fill={kind === 'A' ? '#fff' : '#111'}>
          {code}
        </text>
      </g>
    </svg>
  )
}
