/**
 * SpotlightList — the compact "most scanned" ranking on the homepage hero.
 * Shows the top few rows; pinned entries lead and carry their badge.
 */
import { Link } from 'react-router-dom'
import { useSpotlight } from '../../hooks/useSpotlight'
import { scannerLink, scoreColor } from '../../lib/spotlight'
import TokenAvatar from './TokenAvatar'
import ChainIcon from './ChainIcon'
import Icon from './Icon'

export default function SpotlightList({ max = 5 }: { max?: number }) {
  const { tokens, loading } = useSpotlight()
  if (!loading && tokens.length === 0) return null
  const rows = tokens.slice(0, max)

  return (
    <section aria-label="Most scanned tokens" className="fd-spot-list">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 8px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11,
          fontFamily: "'Space Mono',monospace", letterSpacing: '.12em', color: 'var(--fd-accent)' }}>
          <Icon name="trending" size={14} />SPOTLIGHT · MOST SCANNED
        </span>
        <Link to="/tools/security-scanner" style={{ fontSize: 11, color: 'var(--fd-cyan)', textDecoration: 'none' }}>
          Scan yours →
        </Link>
      </div>

      <ol style={{ listStyle: 'none', margin: 0, padding: '0 6px 8px' }}>
        {loading
          ? Array.from({ length: 3 }, (_, i) => <li key={i} className="fd-spot-row fd-spot-row-skel" />)
          : rows.map((t, i) => (
            <li key={`${t.chainId}:${t.address}`}>
              <Link to={scannerLink(t)} className="fd-spot-row" aria-label={`Scan ${t.name}`}>
                <span style={{ width: 22, fontFamily: "'Space Mono',monospace", fontSize: 11,
                  color: t.pinLabel ? 'var(--fd-accent)' : 'var(--text-muted)' }}>
                  {t.pinLabel ? '★' : i + 1}
                </span>
                <TokenAvatar src={t.logoUrl} symbol={t.symbol} name={t.name} size={26} />
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--fd-white)' }}>
                    {t.name}
                    {t.pinLabel && (
                      <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 6px', borderRadius: 10,
                        border: '1px solid var(--fd-border-accent)', color: 'var(--fd-accent)',
                        verticalAlign: '2px', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                        {t.pinLabel}
                      </span>
                    )}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5,
                    color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace" }}>
                    <ChainIcon chainId={t.chainId} size={11} />${t.symbol} · {t.scanCount.toLocaleString()} scan{t.scanCount === 1 ? "" : "s"}
                  </span>
                </span>
                <span style={{ fontFamily: "'Space Mono',monospace", fontWeight: 800, fontSize: 14,
                  color: scoreColor(t.lastScore), minWidth: 30, textAlign: 'right' }}>
                  {t.lastScore ?? '—'}
                </span>
              </Link>
            </li>
          ))}
      </ol>

      <style>{`
        .fd-spot-list { width: 100%; max-width: 460px; margin: 36px auto 0; border-radius: 16px;
          background: var(--fd-surface); border: 0.5px solid rgba(255,215,0,0.18); backdrop-filter: blur(12px); }
        .fd-spot-row { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 10px;
          text-decoration: none; transition: background 150ms ease; min-height: 44px; }
        .fd-spot-row:hover, .fd-spot-row:focus-visible { background: var(--fd-fill); outline: none; }
        .fd-spot-row-skel { height: 44px; margin: 4px 8px; background: var(--fd-fill); animation: fd-spot-pulse 1.2s ease-in-out infinite; }
        @keyframes fd-spot-pulse { 50% { opacity: .5 } }
      `}</style>
    </section>
  )
}
