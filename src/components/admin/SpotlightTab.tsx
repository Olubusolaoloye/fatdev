/**
 * SpotlightTab — track the most scanned tokens and curate the public spotlight.
 *
 * Scan counts live in `token_scan_stats` (written by every scan). The curation
 * — pins, hidden tokens, how many organic rows to show — lives in
 * `app_config.spotlight` and, like Ads, is held locally until Save.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabaseAdmin } from '../../lib/supabase'
import { adminGetAllConfig, adminSetConfig } from '../../lib/admin'
import { invalidateAppConfig } from '../../hooks/useAppConfig'
import {
  normalizeSpotlight, newPin, pinStatus, pinRemaining, fetchTopScanned, buildSpotlight,
  tokenKey, scoreColor, DEFAULT_SPOTLIGHT,
  type SpotlightConfig, type SpotlightPin, type SpotlightToken, type PinStatus,
} from '../../lib/spotlight'
import { clampHours, formatRemaining, formatDuration, DURATION_PRESETS, MIN_HOURS, MAX_HOURS } from '../../lib/ads'
import { SUPPORTED_CHAINS, CHAIN_NAME } from '../../lib/wagmi'
import { Spinner } from '../ui-kit'
import Icon from '../ui-kit/Icon'
import ChainIcon from '../ui-kit/ChainIcon'
import TokenAvatar from '../ui-kit/TokenAvatar'

const STATUS_STYLE: Record<PinStatus, { label: string; color: string }> = {
  draft:   { label: 'Not started', color: 'var(--text-muted)' },
  live:    { label: 'Live',        color: 'var(--fd-green)' },
  paused:  { label: 'Paused',      color: 'var(--amber)' },
  expired: { label: 'Expired',     color: 'var(--fd-red)' },
}

const WINDOWS = [
  { days: 0, label: 'All time' }, { days: 1, label: '24 hours' },
  { days: 7, label: '7 days' },   { days: 30, label: '30 days' },
]

const card: React.CSSProperties = {
  background: 'var(--navy-card)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16,
}

function ago(iso: string | null) {
  if (!iso) return '—'
  const m = Math.floor((Date.now() - Date.parse(iso)) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

export function SpotlightTab() {
  const [cfg, setCfg] = useState<SpotlightConfig>(DEFAULT_SPOTLIGHT)
  const [top, setTop] = useState<SpotlightToken[]>([])
  const [loading, setLoading] = useState(true)
  const [tableErr, setTableErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  const loadStats = useCallback(async (windowDays: number) => {
    setTableErr('')
    try { setTop(await fetchTopScanned(200, windowDays, supabaseAdmin)) }
    catch (e) { setTableErr(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)) }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const all = await adminGetAllConfig()
        const c = normalizeSpotlight(all.spotlight ?? DEFAULT_SPOTLIGHT)
        setCfg(c)
        await loadStats(c.windowDays)
      } catch (e) { setMsg(`Failed to load: ${(e as Error).message ?? e}`) }
      setLoading(false)
    })()
  }, [loadStats])

  const update = (fn: (c: SpotlightConfig) => SpotlightConfig) => { setCfg(fn); setDirty(true) }
  const patchPin = (id: string, ch: Partial<SpotlightPin>) =>
    update(c => ({ ...c, pins: c.pins.map(p => (p.id === id ? { ...p, ...ch } : p)) }))

  async function save() {
    setSaving(true); setMsg('')
    try {
      await adminSetConfig('spotlight', normalizeSpotlight(cfg))
      invalidateAppConfig()
      setDirty(false); setMsg('Saved.')
    } catch (e) { setMsg(`Failed to save: ${(e as Error).message ?? e}`) }
    setSaving(false)
  }

  function pinFrom(t: SpotlightToken) {
    update(c => ({
      ...c,
      pins: [...c.pins, {
        ...newPin(), address: t.address, chainId: t.chainId, name: t.name, symbol: t.symbol,
        logoUrl: t.logoUrl ?? '',
      }],
    }))
    document.getElementById('spotlight-pins')?.scrollIntoView({ behavior: 'smooth' })
  }

  const toggleHidden = (k: string) => update(c => ({
    ...c, hidden: c.hidden.includes(k) ? c.hidden.filter(h => h !== k) : [...c.hidden, k],
  }))

  async function resetCount(t: SpotlightToken) {
    if (!window.confirm(`Reset the scan count for ${t.name}? Its row is removed and it starts from zero on the next scan.`)) return
    const { error } = await supabaseAdmin.from('token_scan_stats').delete()
      .eq('address', t.address).eq('chain_id', t.chainId)
    if (error) { setMsg(`Failed to reset: ${error.message}`); return }
    setTop(rows => rows.filter(r => !(r.address === t.address && r.chainId === t.chainId)))
  }

  const totals = useMemo(() => ({
    scans: top.reduce((a, t) => a + t.scanCount, 0),
    tokens: top.length,
    today: top.filter(t => t.lastScannedAt && now - Date.parse(t.lastScannedAt) < 86400_000).length,
  }), [top, now])

  const preview = useMemo(() => buildSpotlight(cfg, top, now), [cfg, top, now])
  const filtered = top.filter(t => {
    const q = search.trim().toLowerCase()
    return !q || t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q) || t.address.toLowerCase().includes(q)
  })
  const pinnedKeys = new Set(cfg.pins.filter(p => pinStatus(p, now) !== 'expired').map(p => tokenKey(p.chainId, p.address)))

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Spotlight</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {msg && <span style={{ fontSize: 12, color: msg.startsWith('Failed') ? 'var(--fd-red)' : 'var(--fd-green)' }}>{msg}</span>}
          <button className="btn-primary" onClick={save} disabled={saving || !dirty} style={{ opacity: dirty ? 1 : 0.5 }}>
            {saving ? <Spinner /> : dirty ? 'Save changes' : 'No changes'}
          </button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 18px', maxWidth: 700, lineHeight: 1.65 }}>
        The most scanned tokens appear on the homepage hero and as a card carousel on the scanner.
        Pinned tokens (featured or paid slots) always lead, run for the time you set, then drop off by themselves.
        Hide a token to keep it out of the organic ranking.
      </p>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Scans counted', val: totals.scans.toLocaleString() },
          { label: 'Tokens tracked', val: totals.tokens.toLocaleString() },
          { label: 'Scanned in last 24h', val: totals.today.toLocaleString() },
          { label: 'Showing publicly', val: String(preview.length) },
        ].map(s => (
          <div key={s.label} style={{ ...card, marginBottom: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Space Mono',monospace", marginTop: 4 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* ── Settings ── */}
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 220px' }}>
          <Toggle on={cfg.enabled} onChange={v => update(c => ({ ...c, enabled: v }))} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Show the spotlight</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Hero list and scanner carousel</div>
          </div>
        </div>
        <label style={{ fontSize: 12 }}>
          <div className="field-label" style={{ marginBottom: 5 }}>Organic tokens shown</div>
          <input className="field-input" type="number" min={0} max={30} value={cfg.autoCount} style={{ width: 90 }}
            onChange={e => update(c => ({ ...c, autoCount: Math.max(0, Math.min(30, Number(e.target.value) || 0)) }))} />
        </label>
        <div>
          <div className="field-label" style={{ marginBottom: 5 }}>Rank by scans from</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {WINDOWS.map(w => (
              <Chip key={w.days} on={cfg.windowDays === w.days}
                onClick={() => { update(c => ({ ...c, windowDays: w.days })); loadStats(w.days) }}>{w.label}</Chip>
            ))}
          </div>
        </div>
      </div>

      {/* ── Pins ── */}
      <div id="spotlight-pins" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 10px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Pinned slots</h2>
        <button className="btn-ghost" onClick={() => update(c => ({ ...c, pins: [...c.pins, newPin()] }))}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <Icon name="plus" size={13} /> Add pin
        </button>
      </div>
      {cfg.pins.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No pins. Add one, or use “Pin” on a token in the table below.
        </div>
      )}
      {cfg.pins.map((p, i) => (
        <PinRow key={p.id} pin={p} now={now} index={i} total={cfg.pins.length}
          onPatch={ch => patchPin(p.id, ch)}
          onMove={dir => update(c => {
            const j = i + dir
            if (j < 0 || j >= c.pins.length) return c
            const pins = [...c.pins]; [pins[i], pins[j]] = [pins[j], pins[i]]
            return { ...c, pins }
          })}
          onRemove={() => update(c => ({ ...c, pins: c.pins.filter(x => x.id !== p.id) }))} />
      ))}

      {/* ── Most scanned ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 10px', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Most scanned</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field-input" placeholder="Search name, symbol, address" value={search}
            onChange={e => setSearch(e.target.value)} style={{ width: 240 }} />
          <button className="btn-ghost" onClick={() => loadStats(cfg.windowDays)} aria-label="Refresh"
            style={{ fontSize: 12 }}><Icon name="refresh" size={13} /></button>
        </div>
      </div>

      {tableErr && (
        <div style={{ ...card, color: 'var(--fd-red)', fontSize: 13 }}>
          Could not read scan stats: {tableErr}. Run <code>supabase/migrations/002_token_scan_stats.sql</code> if the table is missing.
        </div>
      )}

      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11 }}>
              {['#', 'Token', 'Chain', 'Scans', 'Last score', 'Last scanned', ''].map(h => (
                <th key={h} style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                {top.length ? 'No matches.' : 'No scans recorded yet.'}
              </td></tr>
            )}
            {filtered.map(t => {
              const k = tokenKey(t.chainId, t.address)
              const hidden = cfg.hidden.includes(k)
              const pinned = pinnedKeys.has(k)
              return (
                <tr key={k} style={{ opacity: hidden ? 0.5 : 1 }}>
                  <td style={td}>{top.indexOf(t) + 1}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <TokenAvatar src={t.logoUrl} symbol={t.symbol} name={t.name} size={26} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>{t.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>${t.symbol}</span></div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace" }}>
                          {t.address.slice(0, 8)}…{t.address.slice(-6)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={td}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <ChainIcon chainId={t.chainId} size={14} />{CHAIN_NAME[t.chainId] ?? t.chainId}</span></td>
                  <td style={{ ...td, fontFamily: "'Space Mono',monospace", fontWeight: 700 }}>{t.scanCount.toLocaleString()}</td>
                  <td style={{ ...td, fontFamily: "'Space Mono',monospace", fontWeight: 700, color: scoreColor(t.lastScore) }}>
                    {t.lastScore ?? '—'}</td>
                  <td style={{ ...td, color: 'var(--text-muted)' }}>{ago(t.lastScannedAt)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button className="btn-ghost" disabled={pinned} onClick={() => pinFrom(t)}
                      style={{ fontSize: 11, padding: '4px 10px', opacity: pinned ? 0.4 : 1 }}>{pinned ? 'Pinned' : 'Pin'}</button>{' '}
                    <button className="btn-ghost" onClick={() => toggleHidden(k)}
                      style={{ fontSize: 11, padding: '4px 10px' }}>{hidden ? 'Unhide' : 'Hide'}</button>{' '}
                    <button className="btn-ghost" onClick={() => resetCount(t)} aria-label="Reset count"
                      style={{ fontSize: 11, padding: '4px 9px', color: 'var(--fd-red)' }}><Icon name="trash" size={12} /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {cfg.hidden.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {cfg.hidden.length} token{cfg.hidden.length === 1 ? '' : 's'} hidden from the public spotlight.{' '}
          <button className="btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }}
            onClick={() => update(c => ({ ...c, hidden: [] }))}>Unhide all</button>
        </div>
      )}
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 12px', borderBottom: '0.5px solid var(--border)', verticalAlign: 'middle' }

function PinRow({ pin, now, index, total, onPatch, onMove, onRemove }: {
  pin: SpotlightPin; now: number; index: number; total: number
  onPatch: (c: Partial<SpotlightPin>) => void; onMove: (d: -1 | 1) => void; onRemove: () => void
}) {
  const status = pinStatus(pin, now)
  const st = STATUS_STYLE[status]
  const left = pinRemaining(pin, now)
  const ready = pin.address.trim().length >= 20

  return (
    <div style={{ ...card, opacity: status === 'expired' ? 0.6 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <TokenAvatar src={pin.logoUrl || null} symbol={pin.symbol || '?'} name={pin.name} size={28} />
        <strong style={{ fontSize: 14 }}>{pin.name || 'New pin'}</strong>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700,
          padding: '3px 9px', borderRadius: 20, color: st.color, border: `1px solid ${st.color}` }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color }} />{st.label}
        </span>
        {status === 'live' && left !== null && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace" }}>{formatRemaining(left)} left</span>
        )}
        <div style={{ flex: 1 }} />
        <button className="btn-ghost" onClick={() => onMove(-1)} disabled={index === 0}
          style={{ fontSize: 11, padding: '4px 9px', opacity: index === 0 ? 0.4 : 1 }} aria-label="Move up">↑</button>
        <button className="btn-ghost" onClick={() => onMove(1)} disabled={index === total - 1}
          style={{ fontSize: 11, padding: '4px 9px', opacity: index === total - 1 ? 0.4 : 1 }} aria-label="Move down">↓</button>
        <button className="btn-ghost" onClick={onRemove} aria-label="Remove pin"
          style={{ fontSize: 11, padding: '4px 9px', color: 'var(--fd-red)' }}><Icon name="trash" size={12} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
        <Field label="Token address">
          <input className="field-input" value={pin.address} placeholder="0x… / Solana mint / Sui coin type"
            style={{ fontFamily: "'Space Mono',monospace", fontSize: 12 }}
            onChange={e => onPatch({ address: e.target.value.trim() })} />
        </Field>
        <Field label="Chain">
          <select className="field-input" value={pin.chainId} onChange={e => onPatch({ chainId: Number(e.target.value) })}>
            {SUPPORTED_CHAINS.filter(c => !c.testnet).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Name"><input className="field-input" value={pin.name} placeholder="Token name"
          onChange={e => onPatch({ name: e.target.value })} /></Field>
        <Field label="Symbol"><input className="field-input" value={pin.symbol} placeholder="TICKER"
          onChange={e => onPatch({ symbol: e.target.value })} /></Field>
        <Field label="Logo URL (optional)"><input className="field-input" value={pin.logoUrl} placeholder="https://…"
          onChange={e => onPatch({ logoUrl: e.target.value })} /></Field>
        <Field label="Badge">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Featured', 'Sponsored', 'Trending'].map(l => (
              <Chip key={l} on={pin.label === l} onClick={() => onPatch({ label: l })}>{l}</Chip>
            ))}
          </div>
        </Field>
      </div>

      <div style={{ marginTop: 10 }}>
        <div className="field-label" style={{ marginBottom: 5 }}>Run length</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {DURATION_PRESETS.map(p => (
            <Chip key={p.hours} on={pin.durationHours === p.hours} onClick={() => onPatch({ durationHours: p.hours })}>{p.label}</Chip>
          ))}
          <input className="field-input" type="number" min={MIN_HOURS} max={MAX_HOURS} value={pin.durationHours}
            onChange={e => onPatch({ durationHours: Number(e.target.value) })}
            onBlur={e => onPatch({ durationHours: clampHours(e.target.value) })} style={{ width: 92 }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>hours</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingTop: 12 }}>
        {status === 'draft' && (
          <button className="btn-primary" disabled={!ready} style={{ fontSize: 12, padding: '7px 16px', opacity: ready ? 1 : 0.5 }}
            onClick={() => onPatch({ startedAt: new Date().toISOString(), enabled: true })}>
            Start {formatDuration(pin.durationHours)} pin
          </button>
        )}
        {(status === 'live' || status === 'paused') && (<>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 14px' }}
            onClick={() => onPatch({ enabled: !pin.enabled })}>{pin.enabled ? 'Pause' : 'Resume'}</button>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 14px', color: 'var(--fd-red)' }}
            onClick={() => onPatch({ startedAt: null })}>Stop and reset</button>
        </>)}
        {status === 'expired' && (
          <button className="btn-ghost" style={{ fontSize: 12, padding: '7px 14px' }}
            onClick={() => onPatch({ startedAt: new Date().toISOString(), enabled: true })}>
            Run again for {formatDuration(pin.durationHours)}
          </button>
        )}
        {pin.startedAt && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace" }}>
            started {new Date(pin.startedAt).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block' }}><div className="field-label" style={{ marginBottom: 5 }}>{label}</div>{children}</label>
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600,
      fontFamily: "'Space Grotesk', sans-serif",
      background: on ? 'var(--fd-accent-ghost)' : 'var(--fd-fill)',
      border: `1px solid ${on ? 'var(--fd-border-accent)' : 'var(--border)'}`,
      color: on ? 'var(--fd-accent)' : 'var(--text-muted)',
    }}>{children}</button>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} style={{
      width: 42, height: 24, borderRadius: 12, flexShrink: 0, cursor: 'pointer',
      background: on ? 'var(--fd-green)' : 'var(--fd-track)', border: 'none', position: 'relative',
      transition: 'background 180ms ease',
    }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: '50%',
        background: '#fff', transition: 'left 180ms ease' }} />
    </button>
  )
}
