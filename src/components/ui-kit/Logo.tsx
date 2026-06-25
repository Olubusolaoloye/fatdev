interface LogoProps {
  size?: number
  variant?: 'mark' | 'full' | 'full-stacked'
}

export default function Logo({ size = 40, variant = 'full' }: LogoProps) {
  const s = size
  const gradId = `fd-grad-${s}`

  const Mark = (
    <svg width={s} height={s} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00CFFF" />
          <stop offset="1" stopColor="#00E57A" />
        </linearGradient>
      </defs>
      {/* Rounded square bg */}
      <rect x="0.5" y="0.5" width="39" height="39" rx="9.5" fill="#131B35" stroke={`url(#${gradId})`} />
      {/* F — vertical stem */}
      <rect x="10" y="11" width="4" height="18" rx="1" fill="#EEF2FF" />
      {/* F — top bar */}
      <rect x="10" y="11" width="14" height="4" rx="1" fill="#EEF2FF" />
      {/* F — mid bar */}
      <rect x="10" y="19" width="10" height="4" rx="1" fill="#EEF2FF" />
      {/* Deploy beam — 4 ascending pixel blocks, cyan→green, shrinking */}
      <rect x="22" y="20" width="4" height="4" rx="0.8" fill="#00CFFF" opacity="1"   />
      <rect x="26" y="17" width="3" height="3" rx="0.6" fill="#33D9FF" opacity="0.85"/>
      <rect x="29" y="14" width="2.5" height="2.5" rx="0.5" fill="#66E4A3" opacity="0.7" />
      <rect x="31.5" y="11.5" width="2" height="2" rx="0.4" fill="#00E57A" opacity="0.55" />
    </svg>
  )

  const Wordmark = (
    <span style={{
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: 0,
      letterSpacing: '-0.02em',
      fontSize: s * 0.42,
      lineHeight: 1,
      userSelect: 'none',
    }}>
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: '#EEF2FF' }}>Fat</span>
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 400, color: '#00CFFF' }}>Dev</span>
    </span>
  )

  if (variant === 'mark') return Mark

  if (variant === 'full-stacked') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: s * 0.2 }}>
        {Mark}
        {Wordmark}
      </div>
    )
  }

  // 'full' — side by side
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: s * 0.25 }}>
      {Mark}
      {Wordmark}
    </div>
  )
}
