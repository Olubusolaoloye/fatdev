/**
 * scanEngine.ts — turns raw GoPlus / Honeypot.is / DexScreener responses into a
 * weighted, explainable safety score.
 *
 * Replaces the old flat "start at 100, subtract per bad boolean" model, which
 * treated a missing data point the same as a passing one and gave a mintable
 * token with no liquidity the same weight as a proxy contract.
 *
 * Design rules:
 *  - Every pillar scores 0–100 independently, then contributes by weight.
 *  - A pillar with no usable data is marked UNCOVERED and dropped from the
 *    weighted average entirely, rather than silently scoring 0 or 100. The
 *    resulting `coverage` figure is surfaced so a thin score is never mistaken
 *    for a thorough one.
 *  - Findings carry plain-English detail; the UI and the share card both read
 *    from this single structure.
 */
import { logoFromPairs } from './tokenLogo'
import { FAIR_MIN, GOOD_MIN } from './mascots'

export type FindingState = 'pass' | 'warn' | 'fail' | 'unknown'

export type Finding = {
  label: string
  detail?: string
  state: FindingState
}

export type Pillar = {
  key: string
  title: string
  weight: number          // 0–1
  score: number           // 0–100
  covered: boolean
  findings: Finding[]
}

/** Forces the displayed rating, with a reason the UI can show. */
export type RatingOverride = {
  tier: 'bad' | 'fair'
  /** 'floor' pins the rating exactly; 'cap' only prevents anything better. */
  mode: 'floor' | 'cap'
  reason: string
}

export type ScanReport = {
  name: string
  symbol: string
  address: string
  chainId: number

  score: number           // 0–100 weighted
  coverage: number        // 0–100 — share of weight we could actually assess
  verdict: 'LOW RISK' | 'CAUTION' | 'HIGH RISK' | 'CRITICAL'

  pillars: Pillar[]

  /**
   * A rating floor/ceiling that the weighted score cannot argue its way out of.
   *
   * The pillar average is a good summary of what we could measure, but some
   * conditions make the average itself untrustworthy or irrelevant. Those are
   * handled here rather than as another deduction, because a deduction can be
   * outvoted by the other pillars scoring well.
   */
  ratingOverride: RatingOverride | null

  // Headline facts reused by the UI + share card
  buyTax: number
  sellTax: number
  isHoneypot: boolean
  honeypotReason?: string
  holders: number
  liquidityUsd: number
  volume24h: number
  lpLockedPct: number
  lpBurnedPct: number
  ownerRenounced: boolean
  ownerAddress: string
  topHolderPct: number
  top10Pct: number
  creatorPct: number
  totalSupply: string
  isOpenSource: boolean | null
  isProxy: boolean | null
  isMintable: boolean | null
  pairAgeDays: number | null
  /** Token artwork from DexScreener. Null when the token has none. */
  logoUrl: string | null
}

// ── helpers ───────────────────────────────────────────────────────────────────
const bool = (v: any): boolean | null =>
  v === '1' || v === 1 || v === true ? true
  : v === '0' || v === 0 || v === false ? false
  : null

const num = (v: any, fallback = 0): number => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

/** Build a pillar, auto-marking it uncovered when nothing could be assessed. */
function pillar(
  key: string, title: string, weight: number, findings: Finding[], score: number
): Pillar {
  const covered = findings.some(f => f.state !== 'unknown')
  return { key, title, weight, score, covered, findings }
}

/**
 * Rating overrides — conditions the weighted score is not allowed to argue
 * with.
 *
 * These are deliberately not extra deductions. A deduction gets averaged
 * against the other pillars, so a token can lose points for something
 * disqualifying and still come out "good". These set the rating directly.
 *
 * Evaluated in severity order, first match wins, so a brand-new pair that is
 * ALSO a rug stays bad rather than being lifted to fair by the age rule.
 *
 * Pillar keys differ by ecosystem (EVM has 'code'/'ownership'; Solana and Sui
 * express the same idea as 'metadata'/'authorities'/'capabilities'), so the
 * caller supplies the names.
 */
export const CREATOR_HOLD_BAD_PCT = 50
export const NEW_PAIR_FAIR_DAYS = 1

export function computeRatingOverride(opts: {
  pillars: Pillar[]
  keys: { liquidity: string; code: string; ownership: string }
  creatorPct: number
  pairAgeDays: number | null
  /** Largest single holder, %. Stands in for creator share where that is not exposed. */
  topHolderPct?: number
  /** Total DEX liquidity in USD. 0 means nothing to sell into. */
  liquidityUsd?: number
}): RatingOverride | null {
  const { pillars, keys, creatorPct, pairAgeDays } = opts
  const topHolderPct = opts.topHolderPct ?? 0
  const liquidityUsd = opts.liquidityUsd ?? 0
  const covered = (k: string) => pillars.find(p => p.key === k)?.covered ?? false

  // Nothing verifiable about custody, code or liquidity. With all three dark
  // there is no evidence a good score could legitimately rest on.
  if (!covered(keys.liquidity) && !covered(keys.code) && !covered(keys.ownership)) {
    return {
      tier: 'bad', mode: 'floor',
      reason: 'Liquidity, contract code and ownership could not be verified. '
        + 'With all three unreadable there is nothing to base a safe rating on.',
    }
  }

  // No market means no exit. Functionally the same outcome as a honeypot for
  // anyone holding it, so it is rated the same way.
  if (liquidityUsd <= 0) {
    return {
      tier: 'bad', mode: 'floor',
      reason: 'No liquidity pool was found. With no market to sell into, a '
        + 'position in this token cannot be exited at any price.',
    }
  }

  // One wallet holding half the supply can exit into every buyer at once.
  // Solana and Sui do not expose creator share, so the largest holder stands
  // in — the risk is identical whoever the wallet belongs to.
  const concentration = Math.max(creatorPct, topHolderPct)
  if (concentration >= CREATOR_HOLD_BAD_PCT) {
    const who = creatorPct >= topHolderPct ? 'creator' : 'largest wallet'
    return {
      tier: 'bad', mode: 'floor',
      reason: `The ${who} holds ${concentration.toFixed(1)}% of supply. `
        + 'A single wallet with half or more of the supply can exit into any buyer.',
    }
  }

  // A clean contract with no trading history is unproven, not safe.
  if (pairAgeDays !== null && pairAgeDays < NEW_PAIR_FAIR_DAYS) {
    return {
      tier: 'fair', mode: 'cap',
      reason: 'The trading pair is less than a day old. There is not yet enough '
        + 'history to trust a higher rating, however clean the contract looks.',
    }
  }

  return null
}

/**
 * Pull the score into the band its rating implies.
 *
 * Shared by every ecosystem: the EVM and non-EVM engines compute scores
 * separately, and when only one of them clamped, a Solana token rated BAD
 * still displayed 53 — inside the fair band, contradicting its own label.
 *
 * Only ever lowers. A cap must not promote a genuinely bad token.
 */
export function clampScoreToOverride(
  score: number, override: RatingOverride | null,
): number {
  if (!override) return score
  const ceiling = override.tier === 'bad' ? FAIR_MIN - 1 : GOOD_MIN - 1
  return Math.min(score, ceiling)
}

/** Deduct from 100, floored at 0. */
function deduct(base: number, ...amounts: number[]): number {
  return Math.max(0, Math.min(100, amounts.reduce((s, a) => s - a, base)))
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function buildScanReport(opts: {
  address: string
  chainId: number
  goPlus: any | null
  honeypot: any | null
  dexPairs: any[]
}): ScanReport {
  const { address, chainId, goPlus: gp, honeypot: hp, dexPairs } = opts

  // ── Normalise inputs ───────────────────────────────────────────────────────
  const buyTax  = hp?.simulationResult?.buyTax  != null
    ? num(hp.simulationResult.buyTax)
    : num(gp?.buy_tax) * 100
  const sellTax = hp?.simulationResult?.sellTax != null
    ? num(hp.simulationResult.sellTax)
    : num(gp?.sell_tax) * 100

  const isHoneypot     = hp?.honeypotResult?.isHoneypot ?? (bool(gp?.is_honeypot) ?? false)
  const honeypotReason = hp?.honeypotResult?.honeypotReason
  const cannotSellAll  = bool(gp?.cannot_sell_all)
  const pausable       = bool(gp?.transfer_pausable)

  // Liquidity — prefer DexScreener (USD), fall back to GoPlus dex list
  const liquidityUsd = dexPairs.length
    ? dexPairs.reduce((s, p) => s + num(p.liquidity?.usd), 0)
    : num(gp?.dex?.[0]?.liquidity)
  const volume24h = dexPairs.reduce((s, p) => s + num(p.volume?.h24), 0)
  const oldestPair = dexPairs.reduce<number | null>((acc, p) => {
    const t = p.pairCreatedAt ? Number(p.pairCreatedAt) : null
    return t == null ? acc : acc == null ? t : Math.min(acc, t)
  }, null)
  const pairAgeDays = oldestPair ? Math.floor((Date.now() - oldestPair) / 86400000) : null

  // LP lock / burn
  const lpHolders: any[] = gp?.lp_holders ?? []
  const lpTotal  = lpHolders.reduce((s, h) => s + num(h.percent), 0)
  const lpLocked = lpHolders.filter(h =>
    bool(h.is_locked) === true || /lock/i.test(h.tag ?? '')).reduce((s, h) => s + num(h.percent), 0)
  const lpBurned = lpHolders.filter(h =>
    /0x0{40}|dead/i.test(h.address ?? '') || /burn/i.test(h.tag ?? '')
  ).reduce((s, h) => s + num(h.percent), 0)
  const lpLockedPct = lpTotal > 0 ? Math.round((lpLocked / lpTotal) * 100) : 0
  const lpBurnedPct = lpTotal > 0 ? Math.round((lpBurned / lpTotal) * 100) : 0
  const lpSecured   = lpLockedPct + lpBurnedPct

  // Ownership
  const ownerAddress = gp?.owner_address ?? gp?.creator_address ?? ''
  const ownerRenounced = /^0x0{40}$/i.test(ownerAddress) || /dead$/i.test(ownerAddress)
  const canReclaim  = bool(gp?.can_take_back_ownership)
  const hiddenOwner = bool(gp?.hidden_owner)

  // Holders
  //
  // Concentration is only a risk when the tokens sit in a wallet that can dump
  // them. Staking contracts, lockers, burn addresses and LP pairs routinely hold
  // huge shares of supply — counting those as whale risk produces loud false
  // positives on perfectly healthy tokens (PancakeSwap's MasterChef holds >90%
  // of CAKE). GoPlus tags these, so they are tracked separately.
  const holders  = parseInt(gp?.holder_count ?? '0') || 0
  const holderArr: any[] = gp?.holders ?? []

  const isCustodial = (h: any): boolean =>
    bool(h?.is_locked) === true ||
    bool(h?.is_contract) === true ||
    /lock|burn|stak|masterchef|vault|pair|pool|dead/i.test(h?.tag ?? '') ||
    /^0x0{40}$/i.test(h?.address ?? '') ||
    /dead$/i.test(h?.address ?? '')

  const liquidHolders = holderArr.filter(h => !isCustodial(h))
  const custodialPct  = holderArr.filter(isCustodial)
    .reduce((s, h) => s + num(h.percent), 0) * 100

  // Percentages used for scoring exclude custodial holders
  const topHolderPct = liquidHolders.length ? num(liquidHolders[0]?.percent) * 100 : 0
  const top10Pct = liquidHolders.slice(0, 10).reduce((s, h) => s + num(h.percent), 0) * 100
  const creatorPct = num(gp?.creator_percent) * 100

  // Code
  const isOpenSource = bool(gp?.is_open_source)
  const isProxy      = bool(gp?.is_proxy)
  const isMintable   = bool(gp?.is_mintable)
  const selfDestruct = bool(gp?.selfdestruct)
  const externalCall = bool(gp?.external_call)
  const taxModifiable= bool(gp?.slippage_modifiable)

  // Provenance / restrictions
  const sameCreatorHoneypot = bool(gp?.honeypot_with_same_creator)
  const blacklist = bool(gp?.is_blacklisted)
  const whitelist = bool(gp?.is_whitelisted)
  const antiWhale = bool(gp?.is_anti_whale)
  const cooldown  = bool(gp?.trading_cooldown)

  const pillars: Pillar[] = []

  // ── 1. Honeypot & Trading — 22% ────────────────────────────────────────────
  {
    const f: Finding[] = []
    let s = 100

    // Every signal in this pillar is measured against a live market. With no
    // pair there is nothing to simulate a sell against, and the tax fields
    // read 0/0 — which previously scored as "low tax, pass" and handed a
    // rugged token full marks for a market that does not exist.
    const hasMarket = dexPairs.length > 0 || liquidityUsd > 0

    if (!hasMarket) {
      f.push({ label: 'No live market to test', state: 'unknown',
        detail: 'Without a trading pair, sell simulation and tax rates cannot be measured.' })
      pillars.push(pillar('honeypot', 'Honeypot & Trading', 0.22, f, 0))
    } else {

    if (isHoneypot) {
      f.push({ label: 'Honeypot detected', state: 'fail',
        detail: honeypotReason || 'Sell simulation failed — this token cannot be sold.' })
      s = 0
    } else if (hp?.honeypotResult) {
      f.push({ label: 'Sells confirmed — not a honeypot', state: 'pass',
        detail: 'Verified by live buy/sell simulation.' })
    } else {
      f.push({ label: 'Sell simulation unavailable', state: 'unknown',
        detail: 'Honeypot.is does not cover this network — honeypot status unverified.' })
      s -= 15
    }

    const maxTax = Math.max(buyTax, sellTax)
    if (maxTax > 50)      { f.push({ label: `Extreme tax (buy ${buyTax.toFixed(1)}% / sell ${sellTax.toFixed(1)}%)`, state: 'fail', detail: 'Above 50% — functionally unsellable.' }); s = deduct(s, 45) }
    else if (maxTax > 25) { f.push({ label: `Very high tax (buy ${buyTax.toFixed(1)}% / sell ${sellTax.toFixed(1)}%)`, state: 'fail', detail: 'Above 25% — most aggregators flag this.' }); s = deduct(s, 30) }
    else if (maxTax > 10) { f.push({ label: `Elevated tax (buy ${buyTax.toFixed(1)}% / sell ${sellTax.toFixed(1)}%)`, state: 'warn', detail: 'Tradeable but costly for holders.' }); s = deduct(s, 12) }
    else                  { f.push({ label: `Low trading tax (buy ${buyTax.toFixed(1)}% / sell ${sellTax.toFixed(1)}%)`, state: 'pass' }) }

    if (cannotSellAll === true) { f.push({ label: 'Cannot sell entire balance', state: 'fail', detail: 'Holders are blocked from fully exiting.' }); s = deduct(s, 25) }
    if (pausable === true)      { f.push({ label: 'Trading can be paused by owner', state: 'warn', detail: 'The owner can halt all transfers at will.' }); s = deduct(s, 15) }

    pillars.push(pillar('honeypot', 'Honeypot & Trading', 0.22, f, s))
    }
  }

  // ── 2. Liquidity — 20% ─────────────────────────────────────────────────────
  {
    const f: Finding[] = []
    let s = 100

    if (liquidityUsd > 0) {
      const usd = `$${Math.round(liquidityUsd).toLocaleString()}`
      if (liquidityUsd < 5_000)       { f.push({ label: `Very low liquidity — ${usd}`, state: 'fail', detail: 'Thin books make exits expensive and easy to rug.' }); s = deduct(s, 45) }
      else if (liquidityUsd < 25_000) { f.push({ label: `Low liquidity — ${usd}`, state: 'warn', detail: 'Larger positions will move the price significantly.' }); s = deduct(s, 22) }
      else                            { f.push({ label: `Liquidity ${usd}`, state: 'pass' }) }
    } else {
      // A determined absence, not missing data. Marking this 'unknown' made the
      // pillar uncovered, which handed its whole weight back and let a token
      // with nowhere to sell score well on the pillars that could be read.
      f.push({ label: 'No liquidity pool found', state: 'fail',
        detail: 'No tradeable market — a position here cannot be exited.' })
      s = 0
    }

    if (lpTotal > 0) {
      if (lpBurnedPct >= 90)     f.push({ label: `LP burnt ${lpBurnedPct}%`, state: 'pass', detail: 'Liquidity permanently removed from circulation.' })
      else if (lpSecured >= 80)  f.push({ label: `LP secured ${lpSecured}% (${lpLockedPct}% locked, ${lpBurnedPct}% burnt)`, state: 'pass' })
      else if (lpSecured >= 50)  { f.push({ label: `LP only ${lpSecured}% secured`, state: 'warn', detail: 'A meaningful share of LP can still be withdrawn.' }); s = deduct(s, 25) }
      else                       { f.push({ label: `LP unlocked — only ${lpSecured}% secured`, state: 'fail', detail: 'The LP holder can pull liquidity at any time.' }); s = deduct(s, 45) }
    } else {
      f.push({ label: 'LP lock status unknown', state: 'unknown' })
      s = deduct(s, 10)
    }

    pillars.push(pillar('liquidity', 'Liquidity', 0.20, f, s))
  }

  // ── 3. Ownership & Control — 18% ───────────────────────────────────────────
  {
    const f: Finding[] = []
    let s = 100

    if (ownerRenounced) {
      f.push({ label: 'Ownership renounced', state: 'pass', detail: 'Owner is the zero/dead address — no privileged control remains.' })
    } else if (ownerAddress) {
      f.push({ label: 'Owner still active', state: 'warn', detail: `Privileged functions remain callable by ${ownerAddress.slice(0, 10)}…` })
      s = deduct(s, 35)
    } else {
      f.push({ label: 'Ownership status unknown', state: 'unknown' })
      s = deduct(s, 15)
    }

    if (canReclaim === true)   { f.push({ label: 'Ownership can be reclaimed', state: 'fail', detail: 'Renouncing is reversible — control can be taken back.' }); s = deduct(s, 40) }
    if (hiddenOwner === true)  { f.push({ label: 'Hidden owner detected', state: 'fail', detail: 'A concealed address retains control despite apparent renouncement.' }); s = deduct(s, 40) }
    if (taxModifiable === true){ f.push({ label: 'Tax can be changed after launch', state: 'warn', detail: 'Fees can be raised at any time, including to unsellable levels.' }); s = deduct(s, 20) }

    pillars.push(pillar('ownership', 'Ownership & Control', 0.18, f, s))
  }

  // ── 4. Holder Distribution — 18% ───────────────────────────────────────────
  {
    const f: Finding[] = []
    let s = 100

    if (holders > 0) {
      if (holders < 50)        { f.push({ label: `${holders.toLocaleString()} holders`, state: 'warn', detail: 'Very small holder base — early or low traction.' }); s = deduct(s, 20) }
      else if (holders < 250)  { f.push({ label: `${holders.toLocaleString()} holders`, state: 'warn', detail: 'Modest holder base.' }); s = deduct(s, 8) }
      else                     { f.push({ label: `${holders.toLocaleString()} holders`, state: 'pass' }) }
    } else {
      f.push({ label: 'Holder count unavailable', state: 'unknown' })
      s = deduct(s, 15)
    }

    if (holderArr.length) {
      const suffix = custodialPct > 1 ? ' (excluding contracts & locks)' : ''

      if (liquidHolders.length === 0) {
        f.push({ label: 'All top holders are contracts or locks', state: 'pass',
          detail: 'No large freely-tradable wallet positions detected.' })
      } else {
        if (topHolderPct > 50)      { f.push({ label: `Top wallet owns ${topHolderPct.toFixed(1)}%${suffix}`, state: 'fail', detail: 'A single wallet can crash the price alone.' }); s = deduct(s, 40) }
        else if (topHolderPct > 20) { f.push({ label: `Top wallet owns ${topHolderPct.toFixed(1)}%${suffix}`, state: 'warn', detail: 'Concentrated — worth watching this wallet.' }); s = deduct(s, 18) }
        else                        { f.push({ label: `Top wallet owns ${topHolderPct.toFixed(1)}%${suffix}`, state: 'pass' }) }

        if (top10Pct > 80)          { f.push({ label: `Top 10 wallets hold ${top10Pct.toFixed(1)}%${suffix}`, state: 'fail', detail: 'Supply is effectively controlled by a handful of wallets.' }); s = deduct(s, 25) }
        else if (top10Pct > 50)     { f.push({ label: `Top 10 wallets hold ${top10Pct.toFixed(1)}%${suffix}`, state: 'warn' }); s = deduct(s, 10) }
        else                        { f.push({ label: `Top 10 wallets hold ${top10Pct.toFixed(1)}%${suffix}`, state: 'pass' }) }
      }

      if (custodialPct > 1) {
        f.push({ label: `${custodialPct.toFixed(1)}% held by contracts, locks or burn`, state: 'pass',
          detail: 'Staking pools, LP pairs and locked/burnt supply — not freely sellable, so excluded from whale risk.' })
      }
    } else {
      f.push({ label: 'Holder distribution unavailable', state: 'unknown' })
    }

    if (creatorPct > 20)      { f.push({ label: `Creator holds ${creatorPct.toFixed(1)}%`, state: 'fail', detail: 'Deployer retains a large share of supply.' }); s = deduct(s, 25) }
    else if (creatorPct > 5)  { f.push({ label: `Creator holds ${creatorPct.toFixed(1)}%`, state: 'warn' }); s = deduct(s, 10) }
    else if (gp?.creator_percent != null) { f.push({ label: `Creator holds ${creatorPct.toFixed(1)}%`, state: 'pass' }) }

    pillars.push(pillar('holders', 'Holder Distribution', 0.18, f, s))
  }

  // ── 5. Contract Code — 12% ─────────────────────────────────────────────────
  {
    const f: Finding[] = []
    let s = 100

    if (isOpenSource === true)       f.push({ label: 'Source code verified', state: 'pass', detail: 'Contract is readable and auditable on the explorer.' })
    else if (isOpenSource === false) { f.push({ label: 'Source code not verified', state: 'fail', detail: 'Nobody can read what this contract actually does.' }); s = deduct(s, 40) }
    else                             f.push({ label: 'Verification status unknown', state: 'unknown' })

    if (isProxy === true)      { f.push({ label: 'Proxy contract', state: 'warn', detail: 'Logic can be swapped out after launch.' }); s = deduct(s, 20) }
    if (isMintable === true)   { f.push({ label: 'Mintable supply', state: 'fail', detail: 'New tokens can be created, diluting holders.' }); s = deduct(s, 30) }
    if (selfDestruct === true) { f.push({ label: 'Self-destruct present', state: 'fail', detail: 'The contract can be destroyed by its owner.' }); s = deduct(s, 30) }
    if (externalCall === true) { f.push({ label: 'Makes external calls', state: 'warn', detail: 'Behaviour depends on other contracts that may change.' }); s = deduct(s, 12) }

    if (isMintable === false && isProxy === false && isOpenSource === true) {
      f.push({ label: 'No mint, proxy or self-destruct', state: 'pass' })
    }

    pillars.push(pillar('code', 'Contract Code', 0.12, f, s))
  }

  // ── 6. Deployer Provenance — 4% ────────────────────────────────────────────
  {
    const f: Finding[] = []
    let s = 100

    if (sameCreatorHoneypot === true) {
      f.push({ label: 'Deployer has shipped a honeypot before', state: 'fail',
        detail: 'The same wallet previously deployed a token that could not be sold.' })
      s = 0
    } else if (sameCreatorHoneypot === false) {
      f.push({ label: 'No known honeypots from this deployer', state: 'pass' })
    } else {
      f.push({ label: 'Deployer history unavailable', state: 'unknown' })
    }

    pillars.push(pillar('provenance', 'Deployer Provenance', 0.04, f, s))
  }

  // ── 7. Trading Restrictions — 3% ───────────────────────────────────────────
  {
    const f: Finding[] = []
    let s = 100

    if (blacklist === true) { f.push({ label: 'Blacklist function present', state: 'fail', detail: 'Specific wallets can be blocked from selling.' }); s = deduct(s, 50) }
    else if (blacklist === false) f.push({ label: 'No blacklist function', state: 'pass' })

    if (whitelist === true) { f.push({ label: 'Whitelist function present', state: 'warn', detail: 'Trading may be restricted to approved wallets.' }); s = deduct(s, 25) }
    if (cooldown === true)  { f.push({ label: 'Trading cooldown enforced', state: 'warn' }); s = deduct(s, 10) }
    if (antiWhale === true) f.push({ label: 'Anti-whale limit present', state: 'pass', detail: 'Caps the size of any single trade or wallet.' })

    if (!f.length) f.push({ label: 'Restriction data unavailable', state: 'unknown' })

    pillars.push(pillar('restrictions', 'Trading Restrictions', 0.03, f, s))
  }

  // ── 8. Market Presence — 3% ────────────────────────────────────────────────
  {
    const f: Finding[] = []
    let s = 100

    if (pairAgeDays != null) {
      if (pairAgeDays < 2)       { f.push({ label: `Pair is ${pairAgeDays === 0 ? 'under a day' : `${pairAgeDays} days`} old`, state: 'warn', detail: 'Brand new listings carry the highest rug risk.' }); s = deduct(s, 35) }
      else if (pairAgeDays < 14) { f.push({ label: `Pair is ${pairAgeDays} days old`, state: 'warn' }); s = deduct(s, 15) }
      else                       { f.push({ label: `Pair is ${pairAgeDays} days old`, state: 'pass' }) }
    } else {
      f.push({ label: 'Pair age unknown', state: 'unknown' })
    }

    if (volume24h > 0) {
      const v = `$${Math.round(volume24h).toLocaleString()}`
      if (volume24h < 1_000) { f.push({ label: `24h volume ${v}`, state: 'warn', detail: 'Very little trading activity.' }); s = deduct(s, 20) }
      else                   { f.push({ label: `24h volume ${v}`, state: 'pass' }) }
    }

    pillars.push(pillar('market', 'Market Presence', 0.03, f, s))
  }

  // ── Weighted roll-up over covered pillars only ─────────────────────────────
  const covered = pillars.filter(p => p.covered)
  const coveredWeight = covered.reduce((s, p) => s + p.weight, 0)
  const totalWeight   = pillars.reduce((s, p) => s + p.weight, 0)

  /**
   * Unassessed weight is NOT neutral.
   *
   * Dividing by covered weight alone answers "how good were the things we
   * happened to check", which is not the question anyone is asking. A token
   * where only Honeypot (22%) and Deployer Provenance (4%) could be read
   * scored 84/100 on 44% coverage — two pillars, both scoring well by default,
   * outvoting five that could not be read at all.
   *
   * In a safety tool "we could not verify this" is closer to bad news than
   * good, so the unreadable share is blended toward a pessimistic constant
   * rather than excluded. At full coverage this is identical to the old
   * behaviour, so well-covered tokens are unaffected.
   */
  const coverageFrac = totalWeight > 0 ? coveredWeight / totalWeight : 0
  const coveredAvg = coveredWeight > 0
    ? covered.reduce((s, p) => s + p.score * p.weight, 0) / coveredWeight
    : 0
  const UNVERIFIED_SCORE = 35

  let score = Math.round(coveredAvg * coverageFrac + UNVERIFIED_SCORE * (1 - coverageFrac))
  const coverage = Math.round(coverageFrac * 100)

  const ratingOverride = computeRatingOverride({
    pillars,
    keys: { liquidity: 'liquidity', code: 'code', ownership: 'ownership' },
    creatorPct,
    pairAgeDays,
    topHolderPct,
    liquidityUsd,
  })

  /**
   * An override has to move the number too.
   *
   * Showing 84/100 and "LOW RISK" beside "Rated BAD regardless of score" is
   * incoherent, and the big number is what people actually read — several
   * reported a rugged token as "81/100" while ignoring the warning next to it.
   * So a floor pulls the score into that tier's band, and a cap ceilings it.
   */
  score = clampScoreToOverride(score, ratingOverride)

  const verdict: ScanReport['verdict'] =
    isHoneypot                                    ? 'CRITICAL'
    // A forced BAD rating cannot sit beside a reassuring verdict.
    : ratingOverride?.tier === 'bad'               ? 'HIGH RISK'
    : score >= 80                                  ? 'LOW RISK'
    : score >= 55                                  ? 'CAUTION'
    : score >= 30                                  ? 'HIGH RISK'
    : 'CRITICAL'

  return {
    name:   gp?.token_name   ?? hp?.token?.name   ?? 'Unknown Token',
    symbol: gp?.token_symbol ?? hp?.token?.symbol ?? '???',
    address, chainId,
    score, coverage, verdict, pillars, ratingOverride,
    buyTax, sellTax, isHoneypot, honeypotReason,
    holders, liquidityUsd, volume24h,
    lpLockedPct, lpBurnedPct,
    ownerRenounced, ownerAddress,
    topHolderPct, top10Pct, creatorPct,
    totalSupply: gp?.total_supply ?? '—',
    isOpenSource, isProxy, isMintable,
    pairAgeDays,
    logoUrl: logoFromPairs(dexPairs),
  }
}
