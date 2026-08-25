/**
 * nonEvmScan.ts — security scanning for Solana and Sui.
 *
 * These chains do not have the EVM's risk model, so they do not get the EVM
 * pillars with fields left blank. Solana's dangers are authorities — a live mint
 * authority prints supply, a freeze authority can lock every holder out of
 * selling, and Token-2022 adds transfer hooks and fees. Sui's are the capability
 * objects: an upgradeable package or a live blacklist cap.
 *
 * Neither chain has a buy/sell simulator (Honeypot.is is EVM-only), so the
 * honeypot pillar simply does not exist here rather than being reported as
 * "unknown" — and the coverage figure reflects what was genuinely assessed.
 *
 * Output uses the same ScanReport shape as the EVM engine, so the results UI and
 * share card work unchanged.
 */
import type { Finding, Pillar, ScanReport } from './scanEngine'
import { computeRatingOverride } from './scanEngine'
import { SOLANA_CHAIN_ID, SUI_CHAIN_ID, NON_EVM_DEX_SLUG } from './ecosystems'
import { logoFromPairs } from './tokenLogo'

// ── Helpers ───────────────────────────────────────────────────────────────────
const num = (v: any, d = 0): number => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : d
}

function deduct(base: number, ...amounts: number[]): number {
  return Math.max(0, Math.min(100, amounts.reduce((s, a) => s - a, base)))
}

function pillar(key: string, title: string, weight: number, findings: Finding[], score: number): Pillar {
  return { key, title, weight, score, covered: findings.some(f => f.state !== 'unknown'), findings }
}

function rollUp(pillars: Pillar[]) {
  const covered = pillars.filter(p => p.covered)
  const cw = covered.reduce((s, p) => s + p.weight, 0)
  const tw = pillars.reduce((s, p) => s + p.weight, 0)
  const score = cw > 0 ? Math.round(covered.reduce((s, p) => s + p.score * p.weight, 0) / cw) : 0
  return { score, coverage: Math.round((cw / tw) * 100) }
}

/**
 * `critical` is reserved for conditions that make a token unsellable or let
 * someone seize value outright — a live freeze authority, a transfer hook, a
 * blacklist cap, mutable balances. It overrides the score.
 *
 * Deliberately NOT set by a retained mint/treasury cap: that is dilution risk,
 * priced into the score, and forcing CRITICAL on it produced contradictions
 * like DeepBook scoring 81 while the banner screamed CRITICAL.
 */
function verdictFor(score: number, critical: boolean): ScanReport['verdict'] {
  if (critical)     return 'CRITICAL'
  if (score >= 80)  return 'LOW RISK'
  if (score >= 55)  return 'CAUTION'
  if (score >= 30)  return 'HIGH RISK'
  return 'CRITICAL'
}

async function dexData(address: string, chainId: number) {
  const slug = NON_EVM_DEX_SLUG[chainId]
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`)
    const json = await res.json()
    const lower = address.toLowerCase()
    const pairs: any[] = (json?.pairs ?? []).filter(
      (p: any) => p.chainId === slug && p?.baseToken?.address?.toLowerCase() === lower
    )
    const liquidityUsd = pairs.reduce((s: number, p: any) => s + num(p.liquidity?.usd), 0)
    const volume24h    = pairs.reduce((s: number, p: any) => s + num(p.volume?.h24), 0)
    const oldest: number | null = pairs.reduce((acc: number | null, p: any) => {
      const t = p.pairCreatedAt ? Number(p.pairCreatedAt) : null
      return t == null ? acc : acc == null ? t : Math.min(acc, t)
    }, null as number | null)
    return {
      pairs, liquidityUsd, volume24h,
      pairAgeDays: oldest ? Math.floor((Date.now() - oldest) / 86400000) : null,
    }
  } catch {
    return { pairs: [], liquidityUsd: 0, volume24h: 0, pairAgeDays: null }
  }
}

// ── Shared pillars ────────────────────────────────────────────────────────────
function liquidityPillar(liquidityUsd: number, weight: number): Pillar {
  const f: Finding[] = []
  let s = 100
  if (liquidityUsd > 0) {
    const usd = `$${Math.round(liquidityUsd).toLocaleString()}`
    if (liquidityUsd < 5_000)       { f.push({ label: `Very low liquidity — ${usd}`, state: 'fail', detail: 'Thin books make exits expensive and easy to pull.' }); s = deduct(s, 45) }
    else if (liquidityUsd < 25_000) { f.push({ label: `Low liquidity — ${usd}`, state: 'warn', detail: 'Larger positions will move the price significantly.' }); s = deduct(s, 22) }
    else                            { f.push({ label: `Liquidity ${usd}`, state: 'pass' }) }
  } else {
    f.push({ label: 'No liquidity pool found', state: 'unknown', detail: 'Not trading on a DEX this scanner indexes — it may be pre-launch.' })
    s = deduct(s, 20)
  }
  return pillar('liquidity', 'Liquidity', weight, f, s)
}

function marketPillar(pairAgeDays: number | null, volume24h: number, weight: number): Pillar {
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
  return pillar('market', 'Market Presence', weight, f, s)
}

/**
 * Holder concentration, ignoring holders that cannot dump — locked positions and
 * tagged exchange/pool accounts. Same reasoning as the EVM engine.
 */
function holderPillar(
  holderCount: number,
  holders: { percent: any; tag?: any; is_locked?: any }[],
  weight: number
): Pillar {
  const f: Finding[] = []
  let s = 100

  if (holderCount > 0) {
    if (holderCount < 50)       { f.push({ label: `${holderCount.toLocaleString()} holders`, state: 'warn', detail: 'Very small holder base — early or low traction.' }); s = deduct(s, 20) }
    else if (holderCount < 250) { f.push({ label: `${holderCount.toLocaleString()} holders`, state: 'warn' }); s = deduct(s, 8) }
    else                        { f.push({ label: `${holderCount.toLocaleString()} holders`, state: 'pass' }) }
  } else {
    f.push({ label: 'Holder count unavailable', state: 'unknown' })
  }

  const custodial = (h: any) =>
    Number(h?.is_locked) === 1 ||
    /lock|burn|stak|vault|pool|pair|treasury|bybit|binance|okx|kucoin|gate|bitget|exchange/i.test(String(h?.tag ?? ''))

  const liquid = holders.filter(h => !custodial(h))
  const custodialPct = holders.filter(custodial).reduce((a, h) => a + num(h.percent), 0) * 100

  if (holders.length) {
    const suffix = custodialPct > 1 ? ' (excluding locks & exchanges)' : ''
    const top1 = liquid.length ? num(liquid[0]?.percent) * 100 : 0
    const top10 = liquid.slice(0, 10).reduce((a, h) => a + num(h.percent), 0) * 100

    if (!liquid.length) {
      f.push({ label: 'All top holders are locked or exchange accounts', state: 'pass' })
    } else {
      if (top1 > 50)      { f.push({ label: `Top wallet holds ${top1.toFixed(1)}%${suffix}`, state: 'fail', detail: 'A single wallet can crash the price alone.' }); s = deduct(s, 40) }
      else if (top1 > 20) { f.push({ label: `Top wallet holds ${top1.toFixed(1)}%${suffix}`, state: 'warn', detail: 'Concentrated — worth watching this wallet.' }); s = deduct(s, 18) }
      else                { f.push({ label: `Top wallet holds ${top1.toFixed(1)}%${suffix}`, state: 'pass' }) }

      if (top10 > 80)      { f.push({ label: `Top 10 wallets hold ${top10.toFixed(1)}%${suffix}`, state: 'fail', detail: 'Supply is controlled by a handful of wallets.' }); s = deduct(s, 25) }
      else if (top10 > 50) { f.push({ label: `Top 10 wallets hold ${top10.toFixed(1)}%${suffix}`, state: 'warn' }); s = deduct(s, 10) }
      else                 { f.push({ label: `Top 10 wallets hold ${top10.toFixed(1)}%${suffix}`, state: 'pass' }) }
    }

    if (custodialPct > 1) {
      f.push({ label: `${custodialPct.toFixed(1)}% held by locks or exchanges`, state: 'pass',
        detail: 'Locked or custodial supply — not freely sellable, so excluded from whale risk.' })
    }
  } else {
    f.push({ label: 'Holder distribution unavailable', state: 'unknown' })
  }

  return pillar('holders', 'Holder Distribution', weight, f, s)
}

// ── Solana ────────────────────────────────────────────────────────────────────
export async function scanSolana(address: string): Promise<ScanReport> {
  const res = await fetch(
    `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${address}`
  ).then(r => r.json())

  if (res?.code !== 1) throw new Error(res?.message || 'GoPlus Solana API error')
  const d: any = Object.values(res.result ?? {})[0]
  if (!d) throw new Error('No Solana token found at that mint address')

  const market = await dexData(address, SOLANA_CHAIN_ID)

  const on = (v: any) => String(v?.status ?? v) === '1'
  const authorityList = (v: any): string[] =>
    (v?.authority ?? []).map((a: any) => a?.address).filter(Boolean)

  const mintable   = on(d.mintable)
  const freezable  = on(d.freezable)
  const closable   = on(d.closable)
  const balMutable = on(d.balance_mutable_authority)
  const metaMutable = on(d.metadata_mutable)
  const nonTransferable = String(d.non_transferable) === '1'
  const transferFee  = d.transfer_fee && Object.keys(d.transfer_fee).length > 0 ? d.transfer_fee : null
  const transferHook = Array.isArray(d.transfer_hook) && d.transfer_hook.length > 0
  const trusted = Number(d.trusted_token) === 1

  const pillars: Pillar[] = []
  let critical = false

  // 1. Authorities & Control — 30%
  {
    const f: Finding[] = []
    let s = 100

    if (freezable) {
      const who = authorityList(d.freezable)[0]
      f.push({ label: 'Freeze authority is live', state: 'fail',
        detail: `Holders' accounts can be frozen at will, which blocks selling entirely${who ? ` (authority ${who.slice(0, 8)}…)` : ''}.` })
      s = deduct(s, 55); critical = true
    } else {
      f.push({ label: 'Freeze authority revoked', state: 'pass', detail: 'Nobody can freeze holder accounts.' })
    }

    if (mintable) {
      f.push({ label: 'Mint authority is live', state: 'fail', detail: 'New supply can be printed at any time, diluting holders.' })
      s = deduct(s, 40)
    } else {
      f.push({ label: 'Mint authority revoked', state: 'pass', detail: 'Supply is fixed.' })
    }

    if (balMutable) { f.push({ label: 'Balances can be modified by an authority', state: 'fail', detail: 'An authority can alter holder balances directly.' }); s = deduct(s, 45); critical = true }
    if (closable)   { f.push({ label: 'Mint account can be closed', state: 'warn', detail: 'The mint can be closed by its authority.' }); s = deduct(s, 15) }

    pillars.push(pillar('authorities', 'Authorities & Control', 0.30, f, s))
  }

  // 2. Liquidity — 22%
  pillars.push(liquidityPillar(market.liquidityUsd, 0.22))

  // 3. Holders — 20%
  pillars.push(holderPillar(parseInt(d.holder_count ?? '0') || 0, d.holders ?? [], 0.20))

  // 4. Token extensions — 13%
  {
    const f: Finding[] = []
    let s = 100

    if (nonTransferable) { f.push({ label: 'Token is non-transferable', state: 'fail', detail: 'This is a soulbound token — it cannot be traded at all.' }); s = 0; critical = true }
    if (transferHook)    { f.push({ label: 'Transfer hook present', state: 'fail', detail: 'Custom code runs on every transfer and can block sells.' }); s = deduct(s, 45); critical = true }
    if (transferFee) {
      const bps = num(transferFee.transfer_fee_bps ?? transferFee.fee_rate ?? 0)
      f.push({ label: bps ? `Transfer fee ${(bps / 100).toFixed(2)}%` : 'Transfer fee enabled', state: bps > 1000 ? 'fail' : 'warn',
        detail: 'A Token-2022 fee is taken on every transfer.' })
      s = deduct(s, bps > 1000 ? 35 : 15)
    }
    if (String(d.default_account_state) === '2') {
      f.push({ label: 'New accounts default to frozen', state: 'fail', detail: 'Buyers receive frozen accounts unless explicitly thawed.' })
      s = deduct(s, 50); critical = true
    }
    if (!f.length) f.push({ label: 'No restrictive token extensions', state: 'pass', detail: 'No transfer hook, fee, or freeze-by-default behaviour.' })

    pillars.push(pillar('extensions', 'Token Extensions', 0.13, f, s))
  }

  // 5. Metadata — 8%
  {
    const f: Finding[] = []
    let s = 100
    if (metaMutable) {
      f.push({ label: 'Metadata is mutable', state: 'warn', detail: 'Name, symbol and image can be changed after launch — a common impersonation vector.' })
      s = deduct(s, 40)
    } else {
      f.push({ label: 'Metadata is immutable', state: 'pass' })
    }
    if (trusted) f.push({ label: 'Recognised as a well-known token', state: 'pass', detail: 'Appears on GoPlus\'s trusted list.' })
    pillars.push(pillar('metadata', 'Metadata', 0.08, f, s))
  }

  // 6. Market — 7%
  pillars.push(marketPillar(market.pairAgeDays, market.volume24h, 0.07))

  const { score, coverage } = rollUp(pillars)
  const holders = d.holders ?? []

  return {
    name:   d.metadata?.name   ?? 'Unknown Token',
    symbol: d.metadata?.symbol ?? '???',
    address, chainId: SOLANA_CHAIN_ID,
    score, coverage, verdict: verdictFor(score, critical), pillars,
    // Solana expresses "can this be tampered with" as authorities, and
    // "is the contract legible" as metadata; creator share is not exposed by
    // the API, so that rule cannot fire here rather than firing wrongly.
    ratingOverride: computeRatingOverride({
      pillars,
      keys: { liquidity: 'liquidity', code: 'metadata', ownership: 'authorities' },
      creatorPct: 0,
      pairAgeDays: market.pairAgeDays,
    }),
    buyTax: 0, sellTax: 0,
    isHoneypot: false,
    honeypotReason: undefined,
    holders: parseInt(d.holder_count ?? '0') || 0,
    liquidityUsd: market.liquidityUsd,
    volume24h: market.volume24h,
    lpLockedPct: 0, lpBurnedPct: 0,
    ownerRenounced: !mintable && !freezable,
    ownerAddress: authorityList(d.mintable)[0] ?? authorityList(d.freezable)[0] ?? '',
    topHolderPct: holders.length ? num(holders[0]?.percent) * 100 : 0,
    top10Pct: holders.slice(0, 10).reduce((a: number, h: any) => a + num(h.percent), 0) * 100,
    creatorPct: 0,
    totalSupply: String(d.total_supply ?? '—'),
    isOpenSource: null, isProxy: null, isMintable: mintable,
    pairAgeDays: market.pairAgeDays,
    logoUrl: logoFromPairs(market.pairs),
  }
}

// ── Sui ───────────────────────────────────────────────────────────────────────
export async function scanSui(coinType: string): Promise<ScanReport> {
  const res = await fetch(
    `https://api.gopluslabs.io/api/v1/sui/token_security?contract_addresses=${encodeURIComponent(coinType)}`
  ).then(r => r.json())

  if (res?.code !== 1) throw new Error(res?.message || 'GoPlus Sui API error')
  const d: any = Object.values(res.result ?? {})[0]
  if (!d) throw new Error('No Sui coin found for that type')

  const market = await dexData(coinType, SUI_CHAIN_ID)

  // Sui wraps each capability as { value: "0"|"1", cap_owner }
  const capOn  = (v: any) => String(v?.value ?? v) === '1'
  const capWho = (v: any) => String(v?.cap_owner ?? '')

  const mintable    = capOn(d.mintable)
  const upgradeable = capOn(d.contract_upgradeable)
  const blacklist   = capOn(d.blacklist)
  const metaModifiable = capOn(d.metadata_modifiable)
  const trusted = Number(d.trusted_token) === 1

  const pillars: Pillar[] = []
  let critical = false

  // 1. Capabilities — 32%
  {
    const f: Finding[] = []
    let s = 100

    if (blacklist) {
      const who = capWho(d.blacklist)
      f.push({ label: 'Blacklist capability is live', state: 'fail',
        detail: `Specific addresses can be blocked from transferring${who ? ` (cap owner ${who.slice(0, 10)}…)` : ''}.` })
      s = deduct(s, 50); critical = true
    } else {
      f.push({ label: 'No blacklist capability', state: 'pass' })
    }

    if (mintable) {
      f.push({ label: 'Treasury cap retained — supply is mintable', state: 'fail', detail: 'New coins can be minted at any time, diluting holders.' })
      s = deduct(s, 40)
    } else {
      f.push({ label: 'Treasury cap burned — supply is fixed', state: 'pass' })
    }

    if (upgradeable) {
      f.push({ label: 'Package is upgradeable', state: 'warn', detail: 'The publisher retains the upgrade cap and can change contract behaviour.' })
      s = deduct(s, 30)
    } else {
      f.push({ label: 'Package is immutable', state: 'pass', detail: 'Upgrade cap has been destroyed.' })
    }

    pillars.push(pillar('capabilities', 'Capabilities & Control', 0.32, f, s))
  }

  // 2. Liquidity — 24%
  pillars.push(liquidityPillar(market.liquidityUsd, 0.24))

  // 3. Holders — 22%
  pillars.push(holderPillar(Number(d.holder_count) || 0, d.holders ?? [], 0.22))

  // 4. Metadata — 10%
  {
    const f: Finding[] = []
    let s = 100
    if (metaModifiable) {
      f.push({ label: 'Coin metadata is modifiable', state: 'warn', detail: 'Name, symbol and icon can be changed after launch.' })
      s = deduct(s, 40)
    } else {
      f.push({ label: 'Coin metadata is frozen', state: 'pass' })
    }
    if (trusted) f.push({ label: 'Recognised as a well-known coin', state: 'pass' })
    pillars.push(pillar('metadata', 'Metadata', 0.10, f, s))
  }

  // 5. Market — 12%
  pillars.push(marketPillar(market.pairAgeDays, market.volume24h, 0.12))

  const { score, coverage } = rollUp(pillars)
  const holders = d.holders ?? []

  return {
    name:   d.name   ?? 'Unknown Coin',
    symbol: d.symbol ?? '???',
    address: coinType, chainId: SUI_CHAIN_ID,
    score, coverage, verdict: verdictFor(score, critical), pillars,
    ratingOverride: computeRatingOverride({
      pillars,
      keys: { liquidity: 'liquidity', code: 'metadata', ownership: 'capabilities' },
      creatorPct: 0,
      pairAgeDays: market.pairAgeDays,
    }),
    buyTax: 0, sellTax: 0,
    isHoneypot: false,
    honeypotReason: undefined,
    holders: Number(d.holder_count) || 0,
    liquidityUsd: market.liquidityUsd,
    volume24h: market.volume24h,
    lpLockedPct: 0, lpBurnedPct: 0,
    ownerRenounced: !mintable && !upgradeable,
    ownerAddress: d.creator ?? '',
    topHolderPct: holders.length ? num(holders[0]?.percent) * 100 : 0,
    top10Pct: holders.slice(0, 10).reduce((a: number, h: any) => a + num(h.percent), 0) * 100,
    creatorPct: 0,
    totalSupply: String(d.total_supply ?? '—'),
    isOpenSource: null, isProxy: upgradeable, isMintable: mintable,
    pairAgeDays: market.pairAgeDays,
    logoUrl: logoFromPairs(market.pairs),
  }
}
