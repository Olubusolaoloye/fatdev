/**
 * mascots.ts — tiered mascot artwork for the scanner's share card.
 *
 * A scan lands in one of four tiers, and each tier has its own set of mascot
 * PNGs. Which one appears is picked from the contract address rather than from
 * Math.random: across tokens it looks varied, but the SAME token always gets
 * the SAME mascot. That matters because people regenerate a card mid-thread —
 * a mascot that changed between downloads would look broken, not playful.
 *
 * ── Adding artwork ───────────────────────────────────────────────────────────
 * Drop files into `public/mascots/` named `<tier>-<n>.webp`, starting at 1 and
 * counting up with no gaps:
 *
 *     public/mascots/perfect-1.webp, perfect-2.webp, …
 *     public/mascots/good-1.webp, …
 *     public/mascots/fair-1.webp, …
 *     public/mascots/bad-1.webp,  …
 *
 * Then bump the tier's count in MASCOT_COUNTS below — that is the only code
 * change needed.
 *
 * ── Two kinds of artwork ─────────────────────────────────────────────────────
 * Which one you supplied is detected from the aspect ratio at load time, so a
 * set can be migrated one tier at a time.
 *
 *   FULL-CARD TEMPLATE (preferred) — landscape 16:9, authored at 2400×1350 so
 *   it maps 1:1 onto the card's 2x output. It supplies the entire background:
 *   mascot, scene and mood lighting, with the right side left dark for the
 *   data. See shareCardTemplate.ts for where the data column begins.
 *
 *   PORTRAIT PANEL (legacy) — roughly 2:3. Drawn cover-fit into a 356×458
 *   column on the left, with its edges blended into the card's own background.
 *
 * Either way the art must contain NO text, numbers, score or shield: those are
 * drawn at render time and would collide with anything baked in.
 *
 * Artwork is REQUIRED. A card is never produced without a tier template — an
 * unbranded card in a Telegram channel is worse than no card at all. Callers
 * use loadMascotOrThrow, which retries once and then raises
 * MascotMissingError so the UI can say what went wrong.
 */

export type MascotTier = 'perfect' | 'good' | 'fair' | 'bad'

/**
 * How many variants exist per tier. 0 disables the tier — the card renders
 * without a mascot rather than requesting a file that isn't there.
 */
export const MASCOT_COUNTS: Record<MascotTier, number> = {
  perfect: 1,
  good: 1,
  fair: 1,
  bad: 1,
}

/**
 * Score bands.
 *
 *     perfect  90 - 100
 *     good     65 - 89
 *     fair     52 - 64
 *     bad      below 52
 */
export const PERFECT_MIN = 90
export const GOOD_MIN    = 65
export const FAIR_MIN    = 52

/** Inclusive display range per tier, for UI that needs to explain the bands. */
export const TIER_RANGE: Record<MascotTier, [number, number]> = {
  perfect: [PERFECT_MIN, 100],
  good:    [GOOD_MIN, PERFECT_MIN - 1],
  fair:    [FAIR_MIN, GOOD_MIN - 1],
  bad:     [0, FAIR_MIN - 1],
}

/** Tier label shown on the card beside the mascot. */
export const TIER_LABEL: Record<MascotTier, string> = {
  perfect: 'PERFECT',
  good: 'GOOD',
  fair: 'FAIR',
  bad: 'BAD',
}

/**
 * Which tier a scan falls into.
 *
 * Score alone is not enough: a token can score respectably on weighted pillars
 * while still being unsellable, and the scanner flags that as CRITICAL. A
 * verdict that severe caps the tier regardless of score, so the mascot can
 * never look cheerful about a honeypot.
 */
export type TierOverride = { tier: 'bad' | 'fair'; mode: 'floor' | 'cap' }

/** Rank used to compare tiers when applying a cap. */
const TIER_RANK: Record<MascotTier, number> = { bad: 0, fair: 1, good: 2, perfect: 3 }

export function tierForScore(
  score: number, verdict?: string, override?: TierOverride | null,
): MascotTier {
  // A severe verdict caps the tier whatever the score. A token can score well
  // on the weighted pillars while still being unsellable, and the mascot must
  // never look cheerful about a honeypot.
  if (verdict === 'CRITICAL' || verdict === 'HIGH RISK') return 'bad'

  // A 'floor' override pins the rating outright. These fire when the score
  // itself is untrustworthy, so letting the pillars vote would defeat the point.
  if (override?.mode === 'floor') return override.tier

  const byScore: MascotTier =
    score >= PERFECT_MIN ? 'perfect'
    : score >= GOOD_MIN  ? 'good'
    : score >= FAIR_MIN  ? 'fair'
    : 'bad'

  // A 'cap' only stops something rating BETTER than the ceiling. It must never
  // promote: a brand-new pair that is also a rug stays bad rather than being
  // lifted to fair.
  if (override?.mode === 'cap' && TIER_RANK[byScore] > TIER_RANK[override.tier]) {
    return override.tier
  }
  return byScore
}

/** FNV-1a — small, fast, and stable across browsers. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * The mascot URL for a scan, or null when the tier has no artwork yet.
 * `seed` should be the contract address so the choice is stable per token.
 */
export function mascotUrl(tier: MascotTier, seed: string): string | null {
  const count = MASCOT_COUNTS[tier]
  if (count <= 0) return null
  const n = (hash(seed.toLowerCase()) % count) + 1
  return `/mascots/${tier}-${n}.webp`
}

/** Raised when a tier's artwork cannot be loaded. */
export class MascotMissingError extends Error {
  // Explicit fields rather than parameter properties: the project builds with
  // erasableSyntaxOnly, which disallows the shorthand.
  tier: MascotTier
  url: string | null

  constructor(tier: MascotTier, url: string | null) {
    super(
      url
        ? `Could not load the ${tier} card template (${url}).`
        : `No card template is configured for the ${tier} tier.`,
    )
    this.name = 'MascotMissingError'
    this.tier = tier
    this.url = url
  }
}

/**
 * Load a mascot for canvas use. Same-origin, so unlike the DexScreener token
 * artwork this needs no CORS proxy and cannot taint the canvas.
 *
 * Resolves to null on failure. Callers that must have artwork should use
 * `loadMascotOrThrow` — a share card is never rendered without a template.
 */
export function loadMascot(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/**
 * Load a tier's artwork, or fail loudly.
 *
 * The card must never be produced without a template — an unbranded card
 * shipped into a Telegram channel is worse than no card at all, and a silent
 * fallback made that failure invisible. One retry covers a transient miss on
 * a cold cache; anything past that is a real problem worth surfacing.
 */
export async function loadMascotOrThrow(
  tier: MascotTier, seed: string,
): Promise<HTMLImageElement> {
  const url = mascotUrl(tier, seed)
  if (!url) throw new MascotMissingError(tier, null)

  for (let attempt = 0; attempt < 2; attempt++) {
    const img = await loadMascot(attempt === 0 ? url : `${url}?retry=1`)
    if (img && img.width > 0) return img
  }
  throw new MascotMissingError(tier, url)
}
