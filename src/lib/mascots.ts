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
 * A missing or unloadable file is not an error: the card falls back to the
 * mascot-less layout, so a half-finished set never breaks sharing.
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
export function tierForScore(score: number, verdict?: string): MascotTier {
  if (verdict === 'CRITICAL' || verdict === 'HIGH RISK') return 'bad'
  if (score >= 90) return 'perfect'
  if (score >= 75) return 'good'
  if (score >= 50) return 'fair'
  return 'bad'
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

/**
 * Load a mascot for canvas use. Same-origin, so unlike the DexScreener token
 * artwork this needs no CORS proxy and cannot taint the canvas.
 * Resolves to null on any failure — the card must still render.
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
