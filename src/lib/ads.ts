/**
 * ads.ts — the image carousel that runs across the top of the tools pages.
 *
 * Stored in Supabase `app_config` under `ads`, alongside feature_flags and
 * maintenance_mode, so it uses machinery that already exists rather than
 * introducing a table and a second way to configure the site.
 *
 * ── The standard ─────────────────────────────────────────────────────────────
 * Every creative is a single image at 3:1. No headline, no badge, no caption —
 * whatever the ad needs to say is baked into the artwork by whoever supplied
 * it. Mixing site-rendered text with a sponsor's own typography looks like two
 * ads fighting, and it means every placement has to be re-typeset by hand.
 *
 * Slides rotate on a fixed cadence so the strip reads as one carousel rather
 * than a queue of unrelated timings.
 *
 * ── What the timer means ─────────────────────────────────────────────────────
 * `durationHours` is how long a placement stays LIVE — a 24-hour booking, a
 * one-week campaign — not how long a slide is on screen. An ad starts when it
 * is started, runs out on its own, and disappears without anyone remembering
 * to switch it off.
 */

/** Every creative is 3:1. */
export const AD_ASPECT = 3
/** Recommended source size. Anything wider is wasted bytes at render width. */
export const AD_RECOMMENDED = '1200 × 400'
/** Seconds each slide is shown before advancing. Fixed, not per-ad. */
export const ROTATE_SECONDS = 6

export type Ad = {
  /** Stable id. Used as the React key and to address the row in admin. */
  id: string
  /** The creative. 3:1. This IS the ad — there is no text layer. */
  imageUrl: string
  /** Where a click goes. External links open in a new tab. */
  url?: string
  /** Internal label so the admin list is readable. Never rendered publicly. */
  label?: string
  /** How many hours the placement runs once started. */
  durationHours: number
  /** ISO timestamp of when the run began. null means it has not started. */
  startedAt: string | null
  /** Off pauses a placement without discarding it or its remaining time. */
  enabled: boolean
}

export type AdsConfig = {
  /** Master switch. Off hides the strip entirely, whatever is booked. */
  enabled: boolean
  ads: Ad[]
}

export const DEFAULT_ADS: AdsConfig = { enabled: false, ads: [] }

/** Bookable run lengths. Custom values are still accepted from the database. */
export const DURATION_PRESETS: { hours: number; label: string }[] = [
  { hours: 6, label: '6 hours' },
  { hours: 12, label: '12 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
  { hours: 720, label: '30 days' },
]

export const MIN_HOURS = 1
export const MAX_HOURS = 8760          // a year
export const DEFAULT_HOURS = 24

export function newAd(): Ad {
  return {
    id: `ad_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    imageUrl: '',
    url: '',
    label: '',
    durationHours: DEFAULT_HOURS,
    startedAt: null,
    enabled: true,
  }
}

export function clampHours(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return DEFAULT_HOURS
  return Math.min(MAX_HOURS, Math.max(MIN_HOURS, Math.round(n)))
}

/**
 * A URL safe to put in an href or an img src.
 *
 * These values come from remote config that an admin edits by hand, so
 * `javascript:` and `data:` are refused outright — a compromised admin account
 * or a bad database row must not become script execution on every tools page.
 */
export function safeUrl(url: string | undefined): string | null {
  if (!url) return null
  const t = url.trim()
  if (!t) return null
  if (t.startsWith('/')) return t
  try {
    const u = new URL(t)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

/**
 * Coerce whatever is in the database into a usable config.
 *
 * Read straight from remote JSON, so it cannot be trusted to be well formed.
 * A malformed entry must never break a tools page — worst case it is dropped.
 */
export function normalizeAds(raw: unknown): AdsConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_ADS
  const r = raw as Partial<AdsConfig>
  const list = Array.isArray(r.ads) ? r.ads : []

  const ads: Ad[] = list
    .filter((a): a is Ad => !!a && typeof a === 'object')
    .map(a => ({
      id: typeof a.id === 'string' && a.id ? a.id : newAd().id,
      imageUrl: typeof a.imageUrl === 'string' ? a.imageUrl : '',
      url: typeof a.url === 'string' ? a.url : '',
      label: typeof a.label === 'string' ? a.label.slice(0, 80) : '',
      durationHours: clampHours(a.durationHours),
      startedAt: typeof a.startedAt === 'string' && !Number.isNaN(Date.parse(a.startedAt))
        ? a.startedAt
        : null,
      enabled: a.enabled !== false,
    }))

  return { enabled: r.enabled === true, ads }
}

// ── Scheduling ───────────────────────────────────────────────────────────────

export type AdStatus = 'draft' | 'live' | 'paused' | 'expired'

/** Milliseconds remaining, or null when the ad has not been started. */
export function msRemaining(ad: Ad, now = Date.now()): number | null {
  if (!ad.startedAt) return null
  const end = Date.parse(ad.startedAt) + ad.durationHours * 3600_000
  return end - now
}

export function statusOf(ad: Ad, now = Date.now()): AdStatus {
  if (!ad.startedAt) return 'draft'
  const left = msRemaining(ad, now)
  if (left !== null && left <= 0) return 'expired'
  return ad.enabled ? 'live' : 'paused'
}

/**
 * Slides eligible to display right now.
 *
 * An expired placement drops out on its own — that is the whole point of the
 * timer. Nobody has to remember to switch it off, and a booking cannot quietly
 * over-run because an admin forgot.
 */
export function visibleAds(cfg: AdsConfig, now = Date.now()): Ad[] {
  if (!cfg.enabled) return []
  return cfg.ads.filter(a => statusOf(a, now) === 'live' && safeUrl(a.imageUrl))
}

/** "5h 12m", "3d 4h", "under a minute" — for the admin list. */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'expired'
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'under a minute'
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** Human label for a run length, preferring the preset wording. */
export function formatDuration(hours: number): string {
  const preset = DURATION_PRESETS.find(p => p.hours === hours)
  if (preset) return preset.label
  if (hours % 24 === 0) return `${hours / 24} days`
  return `${hours} hours`
}
