interface LogoProps {
  size?: number
  variant?: 'mark' | 'full' | 'full-stacked'
}

export default function Logo({ size = 40, variant = 'full' }: LogoProps) {
  const s = size

  const Mark = (
    <img
      src="/logo.png"
      alt="FatDev"
      width={s}
      height={s}
      style={{ borderRadius: s * 0.24, objectFit: 'contain', display: 'block', flexShrink: 0 }}
    />
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

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: s * 0.25 }}>
      {Mark}
      {Wordmark}
    </div>
  )
}
