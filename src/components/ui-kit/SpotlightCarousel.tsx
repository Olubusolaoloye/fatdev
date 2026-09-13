/**
 * SpotlightCarousel — horizontally scrolling token cards on the scanner page.
 *
 * Native scroll-snap does the heavy lifting (touch, trackpad, keyboard all work
 * for free); a timer nudges it one card along every few seconds, pausing on
 * hover, focus, touch and reduced-motion.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSpotlight } from '../../hooks/useSpotlight'
import { scannerLink, scoreColor, type SpotlightToken } from '../../lib/spotlight'
import { CHAIN_NAME } from '../../lib/wagmi'
import TokenAvatar from './TokenAvatar'
import ChainIcon from './ChainIcon'
import Icon from './Icon'

const ADVANCE_MS = 3500

export default function SpotlightCarousel({ onPick }: { onPick?: (t: SpotlightToken) => void }) {
  const { tokens, loading } = useSpotlight()
  const track = useRef<HTMLDivElement>(null)
  const [hovered, setPaused] = useState(false)
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const paused = hovered || reduced

  useEffect(() => {
    if (paused || tokens.length < 2) return
    const t = window.setInterval(() => {
      const el = track.current
      if (!el) return
      const card = el.querySelector<HTMLElement>('[data-card]')
      const step = card ? card.offsetWidth + 12 : 240
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step, behavior: 'smooth' })
    }, ADVANCE_MS)
    return () => window.clearInterval(t)
  }, [paused, tokens.length])

  const nudge = (dir: -1 | 1) => {
    const el = track.current
    if (!el) return
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: 'smooth' })
  }

  if (!loading && tokens.length === 0) return null

  return (
    <section aria-label="Most scanned tokens"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="trending" size={16} style={{ color: 'var(--fd-accent)' }} />
          <span style={{ fontWeight: 800, fontSize: 14 }}>Spotlight</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Most scanned right now</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-ghost" aria-label="Previous" onClick={() => nudge(-1)}
            style={{ padding: '4px 10px', fontSize: 12 }}>‹</button>
          <button className="btn-ghost" aria-label="Next" onClick={() => nudge(1)}
            style={{ padding: '4px 10px', fontSize: 12 }}>›</button>
        </div>
      </div>

      <div ref={track} className="fd-spot-track">
        {loading
          ? Array.from({ length: 4 }, (_, i) => <div key={i} data-card className="fd-spot-card fd-spot-skel" />)
          : tokens.map((t, i) => <Card key={`${t.chainId}:${t.address}`} t={t} rank={i + 1} onPick={onPick} />)}
      </div>

      <style>{`
        .fd-spot-track { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory;
          padding: 2px 2px 8px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
        .fd-spot-track::-webkit-scrollbar { display: none; }
        .fd-spot-card { flex: 0 0 clamp(200px, 30%, 240px); scroll-snap-align: start; min-height: 132px;
          background: var(--fd-panel, var(--navy-card)); border: 0.5px solid var(--border); border-radius: 14px;
          padding: 14px; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 10px;
          position: relative; transition: transform 180ms ease, border-color 180ms ease; }
        .fd-spot-card:hover, .fd-spot-card:focus-visible { transform: translateY(-2px); border-color: var(--fd-border-accent); outline: none; }
        .fd-spot-card.is-pinned { border-color: var(--fd-border-accent);
          background: linear-gradient(160deg, var(--fd-accent-ghost), transparent 60%), var(--fd-panel, var(--navy-card)); }
        .fd-spot-skel { animation: fd-spot-pulse 1.2s ease-in-out infinite; }
        @keyframes fd-spot-pulse { 50% { opacity: .5 } }
        @media (max-width: 600px) { .fd-spot-card { flex-basis: 72%; } }
      `}</style>
    </section>
  )
}

function Card({ t, rank, onPick }: { t: SpotlightToken; rank: number; onPick?: (t: SpotlightToken) => void }) {
  const color = scoreColor(t.lastScore)
  return (
    <Link data-card to={scannerLink(t)} onClick={() => onPick?.(t)}
      className={`fd-spot-card${t.pinLabel ? ' is-pinned' : ''}`}
      aria-label={`Scan ${t.name} (${t.symbol})`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 10, fontFamily: 'var(--fd-font-mono)', letterSpacing: '.08em', textTransform: 'uppercase',
          color: t.pinLabel ? 'var(--fd-accent)' : 'var(--text-muted)',
        }}>
          {t.pinLabel ?? `#${rank}`}
        </span>
        <ChainIcon chainId={t.chainId} size={16} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <TokenAvatar src={t.logoUrl} symbol={t.symbol} name={t.name} size={36} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--fd-font-mono)' }}>
            ${t.symbol} · {CHAIN_NAME[t.chainId] ?? `Chain ${t.chainId}`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginTop: 'auto' }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Scans</div>
          <div style={{ fontFamily: 'var(--fd-font-mono)', fontSize: 13, fontWeight: 700 }}>
            {t.scanCount.toLocaleString()}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Last score</div>
          <div style={{ fontFamily: 'var(--fd-font-mono)', fontSize: 16, fontWeight: 800, color }}>
            {t.lastScore ?? '—'}<span style={{ fontSize: 10, opacity: 0.6 }}>{t.lastScore !== null ? '/100' : ''}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
