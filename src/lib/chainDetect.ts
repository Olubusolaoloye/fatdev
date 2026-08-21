/**
 * chainDetect.ts — works out which chain(s) a pasted contract address lives on,
 * so users never have to pick a network manually.
 *
 * Two-stage strategy:
 *
 *   1. DexScreener — one request returns every chain the token actually trades
 *      on, plus liquidity. Authoritative and fast for anything with a pair, and
 *      it also tells us which deployment is the *real* one when an address
 *      exists on several chains (common with CREATE2 / vanity deploys).
 *
 *   2. Bytecode probe — parallel `eth_getCode` across every supported chain.
 *      Catches tokens with no liquidity yet (pre-launch, freshly deployed),
 *      which DexScreener has never heard of.
 *
 * Stage 2 always runs so a pre-launch token is still found; stage 1 results are
 * ranked above it because trading activity is much stronger evidence.
 */
import { SUPPORTED_CHAINS, CHAIN_RPC, DEXSCREENER_SLUG, CHAIN_ID_BY_DEX_SLUG } from './wagmi'

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

const DETECT_TIMEOUT_MS = 6000

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
    DETECT_TIMEOUT_MS
  )
  const pairs: any[] = res?.pairs ?? []

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
  const url = CHAIN_RPC[chainId]
  if (!url) return false
  const body = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [address, 'latest'],
  })
  const json = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).then(r => r.json()),
    DETECT_TIMEOUT_MS
  )
  const code = json?.result
  return typeof code === 'string' && code !== '0x' && code.length > 2
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function detectChains(address: string): Promise<DetectResult> {
  const probeChains = SUPPORTED_CHAINS.filter(c => !c.testnet).map(c => c.id)

  const [dex, codeHits] = await Promise.all([
    fromDexScreener(address),
    Promise.all(
      probeChains.map(async id => ({ id, has: await hasBytecode(address, id) }))
    ),
  ])

  const byChain = new Map(dex.byChain)

  // Fold in chains that have code but no DexScreener pair
  for (const { id, has } of codeHits) {
    if (has && !byChain.has(id)) {
      byChain.set(id, {
        chainId: id, hasLiquidity: false,
        liquidityUsd: 0, volume24h: 0, pairCreatedAt: null,
      })
    }
  }

  const candidates = [...byChain.values()].sort((a, b) => {
    // Traded deployments first, then by liquidity, then by volume
    if (a.hasLiquidity !== b.hasLiquidity) return a.hasLiquidity ? -1 : 1
    if (b.liquidityUsd !== a.liquidityUsd) return b.liquidityUsd - a.liquidityUsd
    return b.volume24h - a.volume24h
  })

  const best = candidates[0] ?? null

  return {
    candidates,
    best,
    dexPairs: best ? (dex.pairsByChain.get(best.chainId) ?? []) : [],
  }
}

/** Market data for a token on one chain — reused by the scanner's pillars. */
export async function fetchDexPairs(address: string, chainId: number): Promise<any[]> {
  const slug = DEXSCREENER_SLUG[chainId]
  if (!slug) return []
  const res = await withTimeout(
    fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`).then(r => r.json()),
    DETECT_TIMEOUT_MS
  )
  return (res?.pairs ?? []).filter((p: any) => p.chainId === slug)
}
