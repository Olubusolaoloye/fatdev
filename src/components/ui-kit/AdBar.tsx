/**
 * AdBar — the image carousel above the tools.
 *
 * Image only. Every creative is a 3:1 image supplied by whoever booked the
 * placement, and nothing is drawn on top of it: mixing site-rendered text with
 * a sponsor's own typography reads as two ads fighting, and would mean
 * re-typesetting every placement by hand.
 *
 * Slides cross-fade on a fixed cadence. Placements expire on their own — see
 * statusOf in lib/ads — so a finished booking disappears without anyone
 * remembering to switch it off.
 */
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { visibleAds, safeUrl, AD_ASPECT, ROTATE_SECONDS, type AdsConfig } from '../../lib/ads'

export default function AdBar({ config }: { config: AdsConfig }) {
  /**
   * Re-evaluated on a clock, not just on render: a placement that runs out
   * while someone is sitting on the page should drop out by itself rather than
   * lingering until the next navigation.
   */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  const ads = useMemo(() => visibleAds(config, now), [config, now])

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  // Guard the index against the list shrinking underneath it — an expiring
  // placement must not leave the carousel pointing past the end.
  const safeIndex = ads.length ? index % ads.length : 0

  useEffect(() => {
    if (ads.length <= 1 || paused) return
    const t = window.setTimeout(
      () => setIndex(i => (i + 1) % ads.length),
      ROTATE_SECONDS * 1000,
    )
    return () => window.clearTimeout(t)
  }, [safeIndex, paused, ads.length])

  // Someone who cannot track a rotating banner gets a still one.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => { if (mq.matches) setPaused(true) }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  if (!ads.length) return null

  return (
    <div
      role="region"
      aria-label="Sponsored"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      style={{ marginBottom: 22 }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        // Reserving the ratio up front stops the page reflowing when the image
        // arrives, which otherwise shoves the tool a visitor came for downward.
        aspectRatio: `${AD_ASPECT} / 1`,
        maxHeight: 132,
        overflow: 'hidden',
        borderRadius: 'var(--fd-radius)',
        border: '1px solid var(--fd-border)',
        background: 'var(--fd-fill)',
      }}>
        {ads.map((ad, i) => {
          const img = safeUrl(ad.imageUrl)
          const href = safeUrl(ad.url)
          const isExternal = !!href && !href.startsWith('/')
          if (!img) return null

          // Every slide stays mounted and cross-fades. Swapping the src would
          // flash a blank frame each rotation while the next file decodes.
          const slide = (
            <img
              src={img}
              alt={ad.label || 'Sponsored'}
              loading={i === 0 ? 'eager' : 'lazy'}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover', display: 'block',
                opacity: i === safeIndex ? 1 : 0,
                transition: 'opacity 520ms ease',
                pointerEvents: i === safeIndex ? 'auto' : 'none',
              }}
            />
          )

          if (!href) return <div key={ad.id} aria-hidden={i !== safeIndex}>{slide}</div>

          const common = {
            key: ad.id,
            'aria-hidden': i !== safeIndex,
            // Off-screen slides must not be tab stops.
            tabIndex: i === safeIndex ? 0 : -1,
            style: { display: 'block' as const },
          }

          return isExternal
            ? <a {...common} href={href} target="_blank" rel="noopener noreferrer sponsored">{slide}</a>
            : <Link {...common} to={href}>{slide}</Link>
        })}

        {/* Marks the strip as paid placement rather than site content. */}
        <span style={{
          position: 'absolute', top: 6, left: 8, zIndex: 2,
          fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase',
          fontFamily: 'var(--fd-font-mono)',
          padding: '2px 6px', borderRadius: 3,
          background: 'rgba(10,5,2,0.62)', color: 'rgba(255,248,231,0.8)',
          pointerEvents: 'none',
        }}>Ad</span>

        {ads.length > 1 && (
          <div style={{
            position: 'absolute', bottom: 8, right: 10, zIndex: 2,
            display: 'flex', gap: 5, alignItems: 'center',
          }}>
            {ads.map((ad, i) => (
              <button
                key={ad.id}
                onClick={() => setIndex(i)}
                aria-label={`Show ad ${i + 1} of ${ads.length}`}
                aria-current={i === safeIndex}
                style={{
                  width: i === safeIndex ? 16 : 6, height: 6, padding: 0,
                  borderRadius: 3, border: 'none', cursor: 'pointer',
                  background: i === safeIndex
                    ? 'var(--fd-accent)'
                    : 'rgba(255,248,231,0.45)',
                  boxShadow: '0 0 0 1px rgba(10,5,2,0.35)',
                  transition: 'width 220ms ease, background 220ms ease',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
