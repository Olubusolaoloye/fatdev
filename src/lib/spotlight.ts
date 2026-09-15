/**
 * spotlight.ts — the "Most scanned" spotlight on the homepage and scanner.
 *
 * Two sources, merged:
 *   1. Organic — `token_scan_stats`, a count per token bumped by every scan
 *      (see supabase/migrations/002_token_scan_stats.sql).
 *   2. Pinned — paid/featured slots an admin books in `app_config.spotlight`.
 *      Pins behave exactly like ads: a run length that starts when started and
 *      expires by itself, so a sponsored slot cannot quietly over-run.
 *
 * Pinned entries always come first and are labelled as such; organic entries
 * fill the rest. An admin can also hide a token from the organic list (a known
 * scam getting scanned a lot should not look endorsed).
 */
import { supabase, supabaseReady } from './supabase'
import { safeUrl, clampHours, DEFAULT_HOURS } from './ads'
import type { ScanReport } from './scanEngine'

export type SpotlightToken = {
  address: string
  chainId: number
  name: string
  symbol: string
  logoUrl: string | null
  scanCount: number
  lastScore: number | null
  lastVerdict: string | null
  lastScannedAt: string | null
  /** Set for admin-pinned entries; the badge text ("Featured", "Sponsored"…). */
  pinLabel?: string
}

export type SpotlightPin = {
  id: string
  address: string
  chainId: number
  name: string
  symbol: string
  logoUrl: string
  /** Badge shown publicly, e.g. "Featured" or "Sponsored". */
  label: string
  durationHours: number
  startedAt: string | null
  enabled: boolean
}

export type SpotlightConfig = {
  /** Master switch for both the hero list and the scanner carousel. */
  enabled: boolean
  /** How many organic (most-scanned) entries to show after the pins. */
  autoCount: number
  /** Only count scans from the last N days. 0 = all time. */
  windowDays: number
  /** `${chainId}:${address}` keys excluded from the organic list. */
  hidden: string[]
  pins: SpotlightPin[]
}

export const DEFAULT_SPOTLIGHT: SpotlightConfig = {
  enabled: true, autoCount: 8, windowDays: 0, hidden: [], pins: [],
}

export const tokenKey = (chainId: number, address: string) =>
  `${chainId}:${/^0x[0-9a-f]{40}$/i.test(address) ? address.toLowerCase() : address}`

export function scannerLink(t: { address: string; chainId: number }) {
  return `/tools/security-scanner?address=${encodeURIComponent(t.address)}&chain=${t.chainId}`
}

export function newPin(): SpotlightPin {
  return {
    id: `pin_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    address: '', chainId: 56, name: '', symbol: '', logoUrl: '',
    label: 'Featured', durationHours: DEFAULT_HOURS, startedAt: null, enabled: true,
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

export function normalizeSpotlight(raw: unknown): SpotlightConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_SPOTLIGHT
  const r = raw as Partial<SpotlightConfig>
  const n = (v: unknown, d: number, lo: number, hi: number) => {
    const x = Number(v)
    return Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : d
  }
  return {
    enabled: r.enabled !== false,
    autoCount: n(r.autoCount, DEFAULT_SPOTLIGHT.autoCount, 0, 30),
    windowDays: n(r.windowDays, 0, 0, 365),
    hidden: Array.isArray(r.hidden) ? r.hidden.filter((h): h is string => typeof h === 'string').slice(0, 500) : [],
    pins: (Array.isArray(r.pins) ? r.pins : [])
      .filter((p): p is SpotlightPin => !!p && typeof p === 'object')
      .map(p => ({
        id: str(p.id, 60) || newPin().id,
        address: str(p.address, 200).trim(),
        chainId: n(p.chainId, 56, 1, 10_000_000),
        name: str(p.name, 80),
        symbol: str(p.symbol, 24),
        logoUrl: str(p.logoUrl, 500),
        label: str(p.label, 20) || 'Featured',
        durationHours: clampHours(p.durationHours),
        startedAt: typeof p.startedAt === 'string' && !Number.isNaN(Date.parse(p.startedAt)) ? p.startedAt : null,
        enabled: p.enabled !== false,
      })),
  }
}

// ── Pin scheduling — same rules as ads ───────────────────────────────────────
export type PinStatus = 'draft' | 'live' | 'paused' | 'expired'

export function pinRemaining(p: SpotlightPin, now = Date.now()): number | null {
  if (!p.startedAt) return null
  return Date.parse(p.startedAt) + p.durationHours * 3600_000 - now
}

export function pinStatus(p: SpotlightPin, now = Date.now()): PinStatus {
  if (!p.startedAt) return 'draft'
  const left = pinRemaining(p, now)
  if (left !== null && left <= 0) return 'expired'
  return p.enabled ? 'live' : 'paused'
}

// ── Reading ──────────────────────────────────────────────────────────────────
type StatsRow = {
  address: string; chain_id: number; scan_count: number
  name: string | null; symbol: string | null; logo_url: string | null
  last_score: number | null; last_verdict: string | null; last_scanned_at: string | null
}

export function rowToToken(r: StatsRow): SpotlightToken {
  return {
    address: r.address, chainId: r.chain_id, scanCount: Number(r.scan_count) || 0,
    name: r.name || r.symbol || 'Unknown token', symbol: r.symbol || '?',
    logoUrl: safeUrl(r.logo_url ?? undefined), lastScore: r.last_score,
    lastVerdict: r.last_verdict, lastScannedAt: r.last_scanned_at,
  }
}

export async function fetchTopScanned(limit = 30, windowDays = 0, client = supabase): Promise<SpotlightToken[]> {
  if (!supabaseReady) return []
  let q = client.from('token_scan_stats').select('*').order('scan_count', { ascending: false }).limit(limit)
  if (windowDays > 0) q = q.gte('last_scanned_at', new Date(Date.now() - windowDays * 86400_000).toISOString())
  const { data, error } = await q
  if (error) throw error
  return (data as StatsRow[] ?? []).map(rowToToken)
}

/** Pins first (live only), then organic entries not hidden or already pinned. */
export function buildSpotlight(cfg: SpotlightConfig, top: SpotlightToken[], now = Date.now()): SpotlightToken[] {
  if (!cfg.enabled) return []
  const byKey = new Map(top.map(t => [tokenKey(t.chainId, t.address), t]))
  const pinned: SpotlightToken[] = cfg.pins
    .filter(p => p.address && pinStatus(p, now) === 'live')
    .map(p => {
      const s = byKey.get(tokenKey(p.chainId, p.address))
      return {
        address: p.address, chainId: p.chainId,
        name: p.name || s?.name || 'Token', symbol: p.symbol || s?.symbol || '?',
        logoUrl: safeUrl(p.logoUrl) ?? s?.logoUrl ?? null,
        scanCount: s?.scanCount ?? 0, lastScore: s?.lastScore ?? null,
        lastVerdict: s?.lastVerdict ?? null, lastScannedAt: s?.lastScannedAt ?? null,
        pinLabel: p.label,
      }
    })
  const skip = new Set([...cfg.hidden, ...pinned.map(p => tokenKey(p.chainId, p.address))])
  const organic = top.filter(t => !skip.has(tokenKey(t.chainId, t.address))).slice(0, cfg.autoCount)
  return [...pinned, ...organic]
}

// ── Writing ──────────────────────────────────────────────────────────────────
/** Fired on window after a scan is counted, so open spotlights can refresh. */
export const SCAN_RECORDED = 'fd-scan-recorded'

/**
 * Count a completed scan. Every scan counts — no cooldown or per-browser
 * dedupe. Admins can hide or reset a token in the Spotlight tab if a count is
 * gamed. Fire-and-forget: tracking must never break or slow a scan.
 */
export function recordScan(r: ScanReport) {
  if (!supabaseReady) return
  supabase.rpc('record_scan', {
    p_address: r.address, p_chain_id: r.chainId,
    p_name: r.name || null, p_symbol: r.symbol || null,
    p_logo_url: r.logoUrl, p_score: Math.round(r.score), p_verdict: r.verdict,
  }).then(({ error }) => {
    if (error) console.warn('[spotlight] record_scan failed:', error.message)
    else window.dispatchEvent(new Event(SCAN_RECORDED))
  })
}

/** Score → colour, matching the scanner's bands. */
export function scoreColor(score: number | null): string {
  if (score === null) return 'var(--text-muted)'
  if (score >= 90) return 'var(--fd-green)'
  if (score >= 65) return 'var(--fd-cyan)'
  if (score >= 52) return 'var(--amber)'
  return 'var(--fd-red)'
}
