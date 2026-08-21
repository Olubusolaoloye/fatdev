/**
 * priceOracle.ts — converts a USD price into the correct amount of each chain's
 * native coin.
 *
 * Why this exists: tier pricing stored a single flat `native` figure (0.05) and
 * charged it on every chain. That is not a price, it is a coincidence — 0.05 BNB
 * is about $34, 0.05 ETH is about $120, and 0.05 POL is under a cent. The same
 * "$30" tier cost wildly different amounts depending on where the user happened
 * to be connected.
 *
 * Fees are now quoted in USD and converted at live rates, so $30 is $30
 * everywhere.
 *
 * Deliberate design choice: if a rate cannot be fetched, this THROWS rather than
 * falling back to a guess. Charging the wrong amount for real money is worse
 * than asking the user to retry.
 */

export type NativeAsset = {
  /** CoinGecko id, or null for assets pegged to USD */
  id: string | null
  symbol: string
  /** Set for stablecoin-native chains (xDAI, USDT0) */
  pegged?: number
}

/**
 * Native coin per chain. Chains settling in ETH (L2s and rollups) all reference
 * the same feed.
 */
export const NATIVE_ASSET: Record<number, NativeAsset> = {
  1:     { id: 'ethereum',          symbol: 'ETH'  },
  42161: { id: 'ethereum',          symbol: 'ETH'  },
  8453:  { id: 'ethereum',          symbol: 'ETH'  },
  10:    { id: 'ethereum',          symbol: 'ETH'  },
  59144: { id: 'ethereum',          symbol: 'ETH'  },
  4663:  { id: 'ethereum',          symbol: 'ETH'  },
  56:    { id: 'binancecoin',       symbol: 'BNB'  },
  97:    { id: 'binancecoin',       symbol: 'tBNB' },
  137:   { id: 'matic-network',     symbol: 'POL'  },
  43114: { id: 'avalanche-2',       symbol: 'AVAX' },
  25:    { id: 'crypto-com-chain',  symbol: 'CRO'  },  // NOT 'cronos', a different token
  369:   { id: 'pulsechain',        symbol: 'PLS'  },
  5000:  { id: 'mantle',            symbol: 'MNT'  },
  1329:  { id: 'sei-network',       symbol: 'SEI'  },
  143:   { id: 'monad',             symbol: 'MON'  },
  // Stablecoin-native chains — no feed needed
  100:   { id: null, symbol: 'xDAI',  pegged: 1 },
  988:   { id: null, symbol: 'USDT0', pegged: 1 },
}

export type NativeQuote = {
  chainId: number
  symbol: string
  /** USD value of one native coin */
  usdPerNative: number
  /** How much native the requested USD amount converts to */
  nativeAmount: number
  usd: number
  fetchedAt: number
  /** True when the rate came from a peg rather than a live feed */
  pegged: boolean
}

const CACHE_MS = 60_000
const cache = new Map<string, { usd: number; at: number }>()
let inflight: Promise<void> | null = null

/** Batch-fetch every id we know about in one request, then cache. */
async function refreshRates(): Promise<void> {
  const ids = [...new Set(
    Object.values(NATIVE_ASSET).map(a => a.id).filter((x): x is string => !!x)
  )]
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Price feed returned ${res.status}`)
  const json = await res.json()

  const now = Date.now()
  for (const id of ids) {
    const usd = json?.[id]?.usd
    if (typeof usd === 'number' && usd > 0) cache.set(id, { usd, at: now })
  }
}

function cached(id: string): number | null {
  const hit = cache.get(id)
  if (!hit) return null
  return Date.now() - hit.at < CACHE_MS ? hit.usd : null
}

/**
 * Quote `usd` worth of chain `chainId`'s native coin.
 * Throws when the chain has no configured asset or the rate is unavailable.
 */
export async function quoteNative(chainId: number, usd: number): Promise<NativeQuote> {
  const asset = NATIVE_ASSET[chainId]
  if (!asset) {
    throw new Error(
      `No native price feed configured for chain ${chainId}. ` +
      `Pay in $BLIN, or switch to a supported network.`
    )
  }

  // Pegged chains need no feed
  if (asset.pegged) {
    return {
      chainId, symbol: asset.symbol, usdPerNative: asset.pegged,
      nativeAmount: usd / asset.pegged, usd,
      fetchedAt: Date.now(), pegged: true,
    }
  }

  const id = asset.id!
  let rate = cached(id)

  if (rate == null) {
    // Coalesce concurrent callers onto one request
    if (!inflight) {
      inflight = refreshRates().finally(() => { inflight = null })
    }
    await inflight
    rate = cached(id)
  }

  if (rate == null) {
    throw new Error(
      `Could not fetch a live ${asset.symbol} price. ` +
      `Refusing to charge without a current rate — please retry in a moment.`
    )
  }

  return {
    chainId, symbol: asset.symbol, usdPerNative: rate,
    nativeAmount: usd / rate, usd,
    fetchedAt: Date.now(), pegged: false,
  }
}

/** Round a native amount to a sane number of decimals for display and payment. */
export function roundNative(amount: number): number {
  if (amount >= 1_000) return Math.ceil(amount)
  if (amount >= 1)     return Math.ceil(amount * 1e4) / 1e4
  if (amount >= 0.001) return Math.ceil(amount * 1e6) / 1e6
  return Math.ceil(amount * 1e9) / 1e9
}

/** Human-readable amount, e.g. "0.0443 BNB". */
export function formatQuote(q: NativeQuote): string {
  const n = roundNative(q.nativeAmount)
  const digits = n >= 1 ? 4 : n >= 0.001 ? 6 : 9
  return `${n.toFixed(digits).replace(/\.?0+$/, '')} ${q.symbol}`
}

export function isChainPriceable(chainId: number): boolean {
  return !!NATIVE_ASSET[chainId]
}
