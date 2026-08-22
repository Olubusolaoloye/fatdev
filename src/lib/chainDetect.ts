/**
 * chainDetect.ts — works out which chain(s) a pasted contract address lives on,
 * so users never have to pick a network manually.
 *
 * Two-stage strategy, second stage only when the first comes up empty:
 *
 *   1. DexScreener — one request returns every chain the token actually trades
 *      on, plus liquidity. Authoritative for anything with a pair, and it also
 *      identifies which deployment is the *real* one when the same address
 *      exists on several chains (common with CREATE2 / vanity deploys).
 *
 *   2. Bytecode probe — parallel `eth_getCode` across every supported chain.
 *      Only reached when stage 1 finds nothing, i.e. pre-launch tokens with no
 *      pair yet.
 *
 * Running stage 2 unconditionally cost ~6s on every lookup — it fans out to 20
 * public RPCs and is bounded by the slowest, while stage 1 answers in ~10ms.
 * Since a token with a live pair is by definition deployed on that chain, the
 * probe adds nothing in the common case and is now skipped there.
 */
import { SUPPORTED_CHAINS, CHAIN_RPC_LIST, DEXSCREENER_SLUG, CHAIN_ID_BY_DEX_SLUG } from './wagmi'
import {
  detectEcosystem, SOLANA_CHAIN_ID, SUI_CHAIN_ID, SOLANA_RPC_LIST, ADDRESS_HINT,
} from './ecosystems'

export type ChainCandidate = {
  chainId: number
  /** True when DexScreener reports a live pair on this chain */
  hasLiquidity: boolean
  /** Total USD liquidity across pairs on this chain, when known */
  liquidityUsd: number
  /** 24h volume across pairs on this chain, when known */
  volume24h: number
  /** Oldest pair creation timestamp (ms), when known */
  pairCreatedAt: number | null
}

export type DetectResult = {
  candidates: ChainCandidate[]
  /** Best guess — highest liquidity, else first chain with bytecode */
  best: ChainCandidate | null
  /** Raw DexScreener pairs for the winning chain, for downstream market data */
  dexPairs: any[]
}

/** DexScreener is a single fast CDN-backed request. */
const DEX_TIMEOUT_MS = 4000
/**
 * Per-RPC timeout for the bytecode probe. Kept tight because this path fans out
 * to 20 public endpoints at once and a couple of them are routinely slow or
 * unreachable — waiting on the slowest would hold the whole scan hostage.
 */
const RPC_TIMEOUT_MS = 2500

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>(res => setTimeout(() => res(null), ms)),
  ])
}

// ── Stage 1: DexScreener ──────────────────────────────────────────────────────
async function fromDexScreener(address: string): Promise<{
  byChain: Map<number, ChainCandidate>
  pairsByChain: Map<number, any[]>
}> {
  const byChain = new Map<number, ChainCandidate>()
  const pairsByChain = new Map<number, any[]>()

  const res = await withTimeout(
    fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`).then(r => r.json()),
    DEX_TIMEOUT_MS
  )
  const all: any[] = res?.pairs ?? []

  // Only count pairs where this token is the BASE asset. DexScreener also
  // returns pairs where it is merely the quote currency, and for widely-quoted
  // tokens those dominate the (truncated) response — querying USDC returned
  // enough PulseChain pairs quoting USDC to outrank its actual home on
  // Ethereum. Being the quote side says nothing about where a token lives.
  const lower = address.toLowerCase()
  const pairs = all.filter(p => p?.baseToken?.address?.toLowerCase() === lower)

  for (const p of pairs) {
    const chainId = CHAIN_ID_BY_DEX_SLUG[p.chainId]
    if (!chainId) continue   // chain we don't support — ignore

    const prev = byChain.get(chainId)
    const liq  = Number(p.liquidity?.usd ?? 0)
    const vol  = Number(p.volume?.h24 ?? 0)
    const born = p.pairCreatedAt ? Number(p.pairCreatedAt) : null

    byChain.set(chainId, {
      chainId,
      hasLiquidity: true,
      liquidityUsd: (prev?.liquidityUsd ?? 0) + liq,
      volume24h:    (prev?.volume24h ?? 0) + vol,
      pairCreatedAt: prev?.pairCreatedAt && born
        ? Math.min(prev.pairCreatedAt, born)
        : (born ?? prev?.pairCreatedAt ?? null),
    })

    pairsByChain.set(chainId, [...(pairsByChain.get(chainId) ?? []), p])
  }

  return { byChain, pairsByChain }
}

// ── Stage 2: bytecode probe ───────────────────────────────────────────────────
async function hasBytecode(address: string, chainId: number): Promise<boolean> {
  const urls = CHAIN_RPC_LIST[chainId] ?? []
  const body = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [address, 'latest'],
  })

  // Walk the endpoint list — public RPCs fail often enough that a single dead
  // URL used to take the whole chain out of detection.
  for (const url of urls) {
    const json = await withTimeout(
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }).then(r => r.json()),
      RPC_TIMEOUT_MS
    )
    if (json?.result === undefined) continue      // endpoint failed — try the next
    const code = json.result
    return typeof code === 'string' && code !== '0x' && code.length > 2
  }
  return false
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function detectChains(address: string): Promise<DetectResult> {
  // ── Fast path ──────────────────────────────────────────────────────────────
  // DexScreener answers in tens of milliseconds and knows every chain a token
  // actually trades on. When it returns anything, that IS the answer — a token
  // with a live pair is definitionally deployed there — so the 20-way RPC fan-out
  // is skipped entirely. This is the overwhelming majority of real lookups.
  const dex = await fromDexScreener(address)

  if (dex.byChain.size > 0) {
    // If a fork chain showed up, make sure its origin is considered even when
    // DexScreener's capped response contained none of the origin's pairs.
    // Querying USDT returns 30 PulseChain pairs and zero Ethereum ones, so
    // without this the origin never becomes a candidate to prefer.
    for (const id of [...dex.byChain.keys()]) {
      const origin = FORK_ORIGIN[id]
      if (origin && !dex.byChain.has(origin) && await hasBytecode(address, origin)) {
        dex.byChain.set(origin, {
          chainId: origin, hasLiquidity: true,
          liquidityUsd: 0, volume24h: 0, pairCreatedAt: null,
        })
      }
    }

    const candidates = resolveForkPreference([...dex.byChain.values()].sort(rankCandidates))
    const best = candidates[0]
    return { candidates, best, dexPairs: dex.pairsByChain.get(best.chainId) ?? [] }
  }

  // ── Slow path ──────────────────────────────────────────────────────────────
  // No trading pair anywhere. The token may be pre-launch, so fall back to
  // probing bytecode across every supported chain in parallel.
  const probeChains = SUPPORTED_CHAINS.filter(c => !c.testnet).map(c => c.id)
  const codeHits = await Promise.all(
    probeChains.map(async id => ({ id, has: await hasBytecode(address, id) }))
  )

  const candidates = codeHits
    .filter(h => h.has)
    .map(h => ({
      chainId: h.id, hasLiquidity: false,
      liquidityUsd: 0, volume24h: 0, pairCreatedAt: null,
    }))
    .sort(rankCandidates)

  const ordered = resolveForkPreference(candidates)
  return { candidates: ordered, best: ordered[0] ?? null, dexPairs: [] }
}

/**
 * Chains that forked another chain's entire state, mapped to their origin.
 *
 * PulseChain copied Ethereum at the fork block, so every pre-fork Ethereum
 * contract exists there at the same address. Bytecode presence on such a chain
 * is an artifact of the fork, not a deliberate deployment, and DexScreener's
 * 30-pair cap makes the copies easy to over-count: querying USDT returns 30
 * PulseChain pairs and no Ethereum ones at all.
 *
 * So when an address appears on both a fork and its origin, the origin wins
 * unless the fork is doing materially more volume. The scanner still lists both
 * as candidates, so a user who genuinely wants the fork can switch to it.
 */
const FORK_ORIGIN: Record<number, number> = { 369: 1 }

/**
 * When both a fork and its origin hold the same address, the origin wins.
 *
 * No volume comparison: the origin is often added from a bytecode probe with no
 * market data attached, and treating "we did not measure it" as "it has zero
 * volume" hands the decision straight back to the fork. A contract that exists
 * on both is an Ethereum contract that PulseChain copied, and that stays true
 * whatever the sampled pair data happens to say.
 */
function resolveForkPreference(candidates: ChainCandidate[]): ChainCandidate[] {
  const present = new Set(candidates.map(c => c.chainId))
  return [...candidates].sort((a, b) => {
    const aIsCopy = FORK_ORIGIN[a.chainId] != null && present.has(FORK_ORIGIN[a.chainId])
    const bIsCopy = FORK_ORIGIN[b.chainId] != null && present.has(FORK_ORIGIN[b.chainId])
    if (aIsCopy !== bIsCopy) return aIsCopy ? 1 : -1
    return 0
  })
}

/**
 * Traded deployments first, then by 24h VOLUME, then liquidity.
 *
 * Volume leads deliberately. DexScreener caps its response at 30 pairs, and
 * chains that forked Ethereum's state host the same contract at the same
 * address — querying USDC returns 29 PulseChain pairs and 1 Ethereum pair.
 * Ranking on sampled liquidity picked PulseChain ($10.6M vs $884k in-sample),
 * which is wrong: Ethereum did $104.8M of volume that day against PulseChain's
 * $101k. Real economic activity identifies a token's home; a truncated
 * liquidity sample does not.
 */
function rankCandidates(a: ChainCandidate, b: ChainCandidate): number {
  if (a.hasLiquidity !== b.hasLiquidity) return a.hasLiquidity ? -1 : 1
  if (b.volume24h !== a.volume24h) return b.volume24h - a.volume24h
  return b.liquidityUsd - a.liquidityUsd
}

/** Market data for a token on one chain — reused by the scanner's pillars. */
export async function fetchDexPairs(address: string, chainId: number): Promise<any[]> {
  const slug = DEXSCREENER_SLUG[chainId]
  if (!slug) return []
  const res = await withTimeout(
    fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`).then(r => r.json()),
    DEX_TIMEOUT_MS
  )
  return (res?.pairs ?? []).filter((p: any) => p.chainId === slug)
}

// ── Reading a token from the chain it actually lives on ───────────────────────
import { createPublicClient, http as viemHttp, fallback as viemFallback, type PublicClient } from 'viem'

const clientCache = new Map<number, PublicClient>()

/**
 * A read-only client bound to a specific chain.
 *
 * Tools must not read token metadata through wagmi's usePublicClient: that is
 * scoped to whichever network the user's wallet happens to be on, so pasting a
 * BSC token while connected to Ethereum makes `symbol()` return "0x" and the
 * tool reports a broken contract. The address decides the chain, not the wallet.
 */
export function publicClientFor(chainId: number): PublicClient | null {
  const urls = CHAIN_RPC_LIST[chainId]
  if (!urls?.length) return null
  let c = clientCache.get(chainId)
  if (!c) {
    c = createPublicClient({
      transport: viemFallback(urls.map(u => viemHttp(u, { timeout: 15_000 }))),
    }) as PublicClient
    clientCache.set(chainId, c)
  }
  return c
}

const ERC20_META = [
  { name: 'symbol',   type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }]  },
  { name: 'name',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const

export type ResolvedToken = {
  address: string
  chainId: number
  symbol: string
  decimals: number
  name: string
}

/**
 * Find which chain a token is on, then read its metadata from there.
 * Throws with an explanation rather than a raw ABI decode error.
 */
export async function resolveToken(address: string): Promise<ResolvedToken> {
  const clean = address.trim()
  const eco = detectEcosystem(clean)

  if (eco === 'solana') return resolveSolanaToken(clean)
  if (eco === 'sui')    return resolveSuiToken(clean)
  if (eco !== 'evm')    throw new Error(ADDRESS_HINT)

  const det = await detectChains(clean)
  if (!det.best) {
    throw new Error(
      'No contract found at this address on any supported network. ' +
      'Check the address — it may be a wallet rather than a token, or on a chain FatDev does not cover yet.'
    )
  }

  const chainId = det.best.chainId
  const client  = publicClientFor(chainId)
  if (!client) throw new Error(`No RPC configured for chain ${chainId}`)

  try {
    const [symbol, decimals, name] = await Promise.all([
      client.readContract({ address: clean as `0x${string}`, abi: ERC20_META, functionName: 'symbol' }),
      client.readContract({ address: clean as `0x${string}`, abi: ERC20_META, functionName: 'decimals' }),
      client.readContract({ address: clean as `0x${string}`, abi: ERC20_META, functionName: 'name' })
        .catch(() => ''),
    ])
    return {
      address: clean, chainId,
      symbol: String(symbol), decimals: Number(decimals), name: String(name || symbol),
    }
  } catch {
    throw new Error(
      'That address has code but does not respond like an ERC-20 token — ' +
      'no symbol() or decimals(). It may be an NFT, a proxy, or a non-token contract.'
    )
  }
}


// ── Non-EVM metadata ──────────────────────────────────────────────────────────
/**
 * Solana mint metadata.
 *
 * Name and symbol come from GoPlus (which reads the Metaplex metadata account);
 * decimals come from the mint itself via getTokenSupply, since GoPlus does not
 * return them. DexScreener is the fallback for name/symbol on tokens GoPlus has
 * no metadata for.
 */
async function resolveSolanaToken(mint: string): Promise<ResolvedToken> {
  const [gp, supply, dex] = await Promise.all([
    fetch(`https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${mint}`)
      .then(r => r.json()).catch(() => null),
    solanaTokenSupply(mint),
    withTimeout(
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`).then(r => r.json()),
      DEX_TIMEOUT_MS
    ),
  ])

  const d: any = gp?.code === 1 ? Object.values(gp.result ?? {})[0] : null
  const pair = (dex?.pairs ?? []).find(
    (p: any) => p?.baseToken?.address?.toLowerCase() === mint.toLowerCase()
  )

  const name   = d?.metadata?.name   ?? pair?.baseToken?.name
  const symbol = d?.metadata?.symbol ?? pair?.baseToken?.symbol

  if (!name && !symbol && supply == null) {
    throw new Error(
      'No SPL token found at that mint address. Check it is a token mint rather than a wallet.'
    )
  }

  return {
    address: mint,
    chainId: SOLANA_CHAIN_ID,
    symbol: String(symbol ?? '???'),
    decimals: supply?.decimals ?? 9,
    name: String(name ?? symbol ?? 'Unknown Token'),
  }
}

async function solanaTokenSupply(mint: string): Promise<{ decimals: number; amount: string } | null> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenSupply', params: [mint] })
  for (const url of SOLANA_RPC_LIST) {
    const json = await withTimeout(
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
        .then(r => r.json()),
      RPC_TIMEOUT_MS
    )
    const v = json?.result?.value
    if (v && typeof v.decimals === 'number') return { decimals: v.decimals, amount: String(v.amount) }
  }
  return null
}

/** Sui coin metadata — GoPlus returns name, symbol and decimals directly. */
async function resolveSuiToken(coinType: string): Promise<ResolvedToken> {
  const gp = await fetch(
    `https://api.gopluslabs.io/api/v1/sui/token_security?contract_addresses=${encodeURIComponent(coinType)}`
  ).then(r => r.json()).catch(() => null)

  const d: any = gp?.code === 1 ? Object.values(gp.result ?? {})[0] : null
  if (!d) throw new Error('No Sui coin found for that type. Expected 0x…::module::TYPE.')

  return {
    address: coinType,
    chainId: SUI_CHAIN_ID,
    symbol: String(d.symbol ?? '???'),
    decimals: Number(d.decimals ?? 9),
    name: String(d.name ?? d.symbol ?? 'Unknown Coin'),
  }
}
