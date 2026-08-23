import { useState } from 'react'
import { monogram, monogramColor } from '../../lib/tokenLogo'

/**
 * Circular token artwork with a monogram fallback.
 *
 * Uses the DexScreener URL directly — no crossOrigin, since the DOM does not
 * need pixel access and requesting CORS would make the image fail to load
 * entirely. Canvas and PDF go through the proxy in lib/tokenLogo instead.
 *
 * Falls back on both a missing URL and a failed load, so a dead CDN link shows
 * a deliberate monogram rather than a broken-image icon.
 */
export default function TokenAvatar({
  src, symbol, name = '', size = 44, ring = 'rgba(255,255,255,0.14)', style,
}: {
  src?: string | null
  symbol: string
  name?: string
  size?: number
  ring?: string
  style?: React.CSSProperties
}) {
  const [failed, setFailed] = useState(false)
  const showImg = !!src && !failed

  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative',
        background: showImg ? 'var(--fd-fill)' : monogramColor(symbol || name),
        boxShadow: `0 0 0 1px ${ring} inset`,
        ...style,
      }}
      aria-hidden
    >
      {showImg ? (
        <img
          src={src!}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span style={{
          color: '#FFFFFF', fontWeight: 800,
          fontSize: Math.round(size * 0.4),
          fontFamily: 'var(--fd-font-display)',
          lineHeight: 1, userSelect: 'none',
        }}>
          {monogram(symbol, name)}
        </span>
      )}
    </span>
  )
}
