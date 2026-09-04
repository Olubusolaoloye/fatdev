/**
 * AdsTab — book and run the image placements above the tools.
 *
 * Writes to the `ads` key in Supabase `app_config`, the same store the feature
 * flags use, so there is no new table and no second way to configure the site.
 *
 * Edits are held locally until Save: writing on each keystroke would put a
 * half-typed URL live on the public site.
 */
import { useState, useEffect, useCallback } from 'react'
import { adminGetAllConfig, adminSetConfig } from '../../lib/admin'
import { invalidateAppConfig } from '../../hooks/useAppConfig'
import {
  normalizeAds, newAd, clampHours, visibleAds, statusOf, msRemaining,
  formatRemaining, formatDuration, safeUrl,
  DURATION_PRESETS, MIN_HOURS, MAX_HOURS, AD_ASPECT, AD_RECOMMENDED, ROTATE_SECONDS,
  type Ad, type AdsConfig, type AdStatus,
} from '../../lib/ads'
import { Spinner } from '../ui-kit'
import Icon from '../ui-kit/Icon'

const STATUS_STYLE: Record<AdStatus, { label: string; color: string }> = {
  draft:   { label: 'Not started', color: 'var(--text-muted)' },
  live:    { label: 'Live',        color: 'var(--fd-green)' },
  paused:  { label: 'Paused',      color: 'var(--amber)' },
  expired: { label: 'Expired',     color: 'var(--fd-red)' },
}

export function AdsTab() {
  const [cfg, setCfg] = useState<AdsConfig>({ enabled: false, ads: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [dirty, setDirty] = useState(false)

  // Drives the countdowns without needing a save or a refresh.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const all = await adminGetAllConfig()
        setCfg(normalizeAds(all.ads))
      } catch (e: any) {
        setMsg(`Failed to load: ${e.message ?? e}`)
      }
      setLoading(false)
    })()
  }, [])

  const patch = useCallback((id: string, changes: Partial<Ad>) => {
    setCfg(c => ({ ...c, ads: c.ads.map(a => (a.id === id ? { ...a, ...changes } : a)) }))
    setDirty(true)
  }, [])

  const move = useCallback((id: string, dir: -1 | 1) => {
    setCfg(c => {
      const i = c.ads.findIndex(a => a.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= c.ads.length) return c
      const ads = [...c.ads]
      ;[ads[i], ads[j]] = [ads[j], ads[i]]
      return { ...c, ads }
    })
    setDirty(true)
  }, [])

  async function save() {
    setSaving(true); setMsg('')
    try {
      await adminSetConfig('ads', normalizeAds(cfg))
      invalidateAppConfig()
      setDirty(false)
      setMsg('Saved.')
    } catch (e: any) {
      setMsg(`Failed to save: ${e.message ?? e}`)
    }
    setSaving(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div>

  const liveCount = visibleAds(cfg, now).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Ads</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {msg && (
            <span style={{ fontSize: 12, color: msg.startsWith('Failed') ? 'var(--fd-red)' : 'var(--fd-green)' }}>
              {msg}
            </span>
          )}
          <button className="btn-primary" onClick={save} disabled={saving || !dirty}
            style={{ opacity: dirty ? 1 : 0.5 }}>
            {saving ? <Spinner /> : dirty ? 'Save changes' : 'No changes'}
          </button>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px', maxWidth: 680, lineHeight: 1.65 }}>
        An image carousel above every tool. Creatives are <strong>{AD_ASPECT}:1 images only</strong> —
        recommended {AD_RECOMMENDED} — with no text drawn over them, so whatever
        the ad says is baked into the artwork. Slides rotate every {ROTATE_SECONDS}s.
        A placement runs for the time you set and then drops off by itself.
      </p>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, padding: '14px 16px', marginBottom: 18,
        background: 'var(--navy-card)', border: '0.5px solid var(--border)', borderRadius: 12,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Show the ad strip</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {liveCount > 0
              ? `${liveCount} placement${liveCount === 1 ? '' : 's'} running`
              : 'Nothing running — the strip is hidden'}
          </div>
        </div>
        <Toggle on={cfg.enabled} onChange={v => { setCfg(c => ({ ...c, enabled: v })); setDirty(true) }} />
      </div>

      {cfg.ads.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '40px 20px', marginBottom: 16,
          background: 'var(--navy-card)', border: '0.5px solid var(--border)', borderRadius: 12,
          color: 'var(--text-muted)', fontSize: 13,
        }}>
          No placements yet. Add one below.
        </div>
      )}

      {cfg.ads.map((ad, i) => (
        <AdRow key={ad.id} ad={ad} index={i} total={cfg.ads.length} now={now}
          onPatch={patch} onMove={move}
          onRemove={() => { setCfg(c => ({ ...c, ads: c.ads.filter(a => a.id !== ad.id) })); setDirty(true) }} />
      ))}

      <button className="btn-ghost"
        onClick={() => { setCfg(c => ({ ...c, ads: [...c.ads, newAd()] })); setDirty(true) }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <Icon name="plus" size={14} /> Add placement
      </button>
    </div>
  )
}

// ── One placement ────────────────────────────────────────────────────────────
function AdRow({ ad, index, total, now, onPatch, onMove, onRemove }: {
  ad: Ad; index: number; total: number; now: number
  onPatch: (id: string, c: Partial<Ad>) => void
  onMove: (id: string, dir: -1 | 1) => void
  onRemove: () => void
}) {
  const status = statusOf(ad, now)
  const left = msRemaining(ad, now)
  const st = STATUS_STYLE[status]
  const img = safeUrl(ad.imageUrl)

  return (
    <div style={{
      background: 'var(--navy-card)', border: '0.5px solid var(--border)',
      borderRadius: 12, padding: 16, marginBottom: 12,
      opacity: status === 'expired' ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: 'var(--text-muted)', minWidth: 22 }}>
          #{index + 1}
        </span>

        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
          color: st.color, border: `1px solid ${st.color}`,
          background: 'transparent',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color }} />
          {st.label}
        </span>

        {status === 'live' && left !== null && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace" }}>
            {formatRemaining(left)} left
          </span>
        )}
        {status === 'draft' && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            runs {formatDuration(ad.durationHours)} once started
          </span>
        )}

        <div style={{ flex: 1 }} />

        <button className="btn-ghost" onClick={() => onMove(ad.id, -1)} disabled={index === 0}
          aria-label="Move up" style={{ fontSize: 11, padding: '4px 9px', opacity: index === 0 ? 0.4 : 1 }}>↑</button>
        <button className="btn-ghost" onClick={() => onMove(ad.id, 1)} disabled={index === total - 1}
          aria-label="Move down" style={{ fontSize: 11, padding: '4px 9px', opacity: index === total - 1 ? 0.4 : 1 }}>↓</button>
        <button className="btn-ghost" onClick={onRemove} aria-label="Remove placement"
          style={{ fontSize: 11, padding: '4px 9px', color: 'var(--fd-red)' }}>
          <Icon name="trash" size={12} />
        </button>
      </div>

      {/* Preview at the real ratio, so a wrong file or a wrong crop is obvious
          here rather than on the live site. */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: 420,
        aspectRatio: `${AD_ASPECT} / 1`, marginBottom: 12,
        borderRadius: 8, overflow: 'hidden',
        border: '1px dashed var(--border)', background: 'var(--fd-fill)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {img
          ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0' }} />
          : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {AD_ASPECT}:1 preview — paste an image URL
            </span>}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <Field label="Image URL"
          hint={`Direct link to the file, ${AD_ASPECT}:1, recommended ${AD_RECOMMENDED}. On ImgBB use the i.ibb.co/… address — the ibb.co/… page is not an image and will not load.`}>
          <input className="field-input" value={ad.imageUrl}
            placeholder="https://i.ibb.co/xxxx/banner.png"
            onChange={e => onPatch(ad.id, { imageUrl: e.target.value })} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
          <Field label="Click-through link" hint="Where the ad goes. Blank makes it non-clickable.">
            <input className="field-input" value={ad.url ?? ''}
              placeholder="https://example.com"
              onChange={e => onPatch(ad.id, { url: e.target.value })} />
          </Field>

          <Field label="Internal label" hint="Only for this list — never shown publicly.">
            <input className="field-input" value={ad.label ?? ''}
              placeholder="Acme — 24h booking"
              onChange={e => onPatch(ad.id, { label: e.target.value })} />
          </Field>
        </div>

        <Field label="Run length" hint="How long the placement stays live once you start it.">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {DURATION_PRESETS.map(p => (
              <button key={p.hours}
                onClick={() => onPatch(ad.id, { durationHours: p.hours })}
                style={{
                  padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12,
                  fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600,
                  background: ad.durationHours === p.hours ? 'var(--fd-accent-ghost)' : 'var(--fd-fill)',
                  border: `1px solid ${ad.durationHours === p.hours ? 'var(--fd-border-accent)' : 'var(--border)'}`,
                  color: ad.durationHours === p.hours ? 'var(--fd-accent)' : 'var(--text-muted)',
                }}>
                {p.label}
              </button>
            ))}
            <input className="field-input" type="number" min={MIN_HOURS} max={MAX_HOURS}
              value={ad.durationHours}
              onChange={e => onPatch(ad.id, { durationHours: Number(e.target.value) })}
              onBlur={e => onPatch(ad.id, { durationHours: clampHours(e.target.value) })}
              style={{ width: 92 }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>hours</span>
          </div>
        </Field>

        {/* Start / stop. The clock begins when it is started, not when the row
            was created, so a creative can be prepared ahead of its booking. */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingTop: 4 }}>
          {status === 'draft' && (
            <button className="btn-primary" disabled={!img}
              onClick={() => onPatch(ad.id, { startedAt: new Date().toISOString(), enabled: true })}
              style={{ fontSize: 12, padding: '7px 16px', opacity: img ? 1 : 0.5 }}>
              Start {formatDuration(ad.durationHours)} run
            </button>
          )}

          {(status === 'live' || status === 'paused') && (
            <>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 14px' }}
                onClick={() => onPatch(ad.id, { enabled: !ad.enabled })}>
                {ad.enabled ? 'Pause' : 'Resume'}
              </button>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 14px', color: 'var(--fd-red)' }}
                onClick={() => onPatch(ad.id, { startedAt: null })}>
                Stop and reset
              </button>
            </>
          )}

          {status === 'expired' && (
            <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 14px' }}
              onClick={() => onPatch(ad.id, { startedAt: new Date().toISOString(), enabled: true })}>
              Run again for {formatDuration(ad.durationHours)}
            </button>
          )}

          {ad.startedAt && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace" }}>
              started {new Date(ad.startedAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div className="field-label" style={{ marginBottom: 5 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    </label>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on}
      style={{
        width: 42, height: 24, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
        background: on ? 'var(--fd-green)' : 'var(--fd-track)',
        border: 'none', position: 'relative', transition: 'background 180ms ease',
      }}>
      <span style={{
        position: 'absolute', top: 3, left: on ? 21 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 180ms ease',
      }} />
    </button>
  )
}
