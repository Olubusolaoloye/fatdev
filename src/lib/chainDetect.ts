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
    RPC_TIMEOUT_MS
  )
  const code = json?.result
  return typeof code === 'string' && code !== '0x' && code.length > 2
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
    const candidates = [...dex.byChain.values()].sort(rankCandidates)
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

  return { candidates, best: candidates[0] ?? null, dexPairs: [] }
}

/** Traded deployments first, then by liquidity, then by 24h volume. */
function rankCandidates(a: ChainCandidate, b: ChainCandidate): number {
  if (a.hasLiquidity !== b.hasLiquidity) return a.hasLiquidity ? -1 : 1
  if (b.liquidityUsd !== a.liquidityUsd) return b.liquidityUsd - a.liquidityUsd
  return b.volume24h - a.volume24h
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
