/**
 * lifi.ts — LI.FI SDK client for FatDev's own bridge UI.
 *
 * The bridge used to be LI.FI's drop-in widget. It is now built on the raw SDK
 * so the whole surface is ours, and so we control how balances are loaded.
 *
 * ── Why the old bridge was slow ──────────────────────────────────────────────
 * The widget asks its provider for the balances of every token on a chain, and
 * the adapter answered that with one `readContract` per token, awaited in
 * sequence. A chain's token list runs to several hundred entries, so opening
 * the token picker meant several hundred serial RPC round-trips — tens of
 * seconds before anything rendered.
 *
 * Two things fix it here:
 *   1. `loadWalletBalances` asks LI.FI's own balance endpoint, which returns
 *      every token the wallet actually holds, on every chain, in ONE request.
 *      That is what the UI renders from, so the picker is populated immediately.
 *   2. `getBalance` (which the SDK still calls internally during execution)
 *      batches through multicall3 and runs chains in parallel, so even the
 *      fallback path is one round-trip per chain rather than one per token.
 */
import {
  createClient, getChains, getTokens, getWalletBalances, getQuote,
  convertQuoteToRoute, executeRoute, ChainType,
} from '@lifi/sdk'
import type {
  SDKClient, SDKProvider, StepExecutorOptions, Token, TokenAmount,
  ExtendedChain, LiFiStep, Route, RouteExtended,
} from '@lifi/sdk'
import { isAddress as viemIsAddress, createPublicClient, http, erc20Abi, type WalletClient } from 'viem'
import { EVMStepExecutor } from './lifiExecutor'

export const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000'

/** Integrator fee, as a fraction. Set VITE_LIFI_FEE to charge one. */
export const LIFI_FEE = Number(import.meta.env.VITE_LIFI_FEE ?? 0)

// ── Wallet plumbing ──────────────────────────────────────────────────────────
// The SDK provider is built once, but the wallet client and chain-switcher it
// needs change on every connect/disconnect. Holding them in module-level refs
// lets the provider stay stable while always reading the current values.
const wallet: {
  client: WalletClient | null | undefined
  switchChain: ((chainId: number) => Promise<void>) | null
} = { client: null, switchChain: null }

export function setBridgeWallet(
  client: WalletClient | null | undefined,
  switchChain: (chainId: number) => Promise<void>,
) {
  wallet.client = client
  wallet.switchChain = switchChain
}

// ── Balance helpers ──────────────────────────────────────────────────────────

/** Read many balances on one chain in a single multicall round-trip. */
async function balancesOnChain(
  client: SDKClient, chainId: number, owner: string, tokens: Token[],
): Promise<TokenAmount[]> {
  let rpcUrl: string
  try {
    rpcUrl = (await client.getRpcUrlsByChainId(chainId))[0]
  } catch {
    return tokens.map(t => ({ ...t, amount: 0n }))
  }
  const pub = createPublicClient({ transport: http(rpcUrl), batch: { multicall: true } })
  const owner_ = owner as `0x${string}`

  const erc20 = tokens.filter(t => t.address.toLowerCase() !== NATIVE_ADDRESS)
  const native = tokens.filter(t => t.address.toLowerCase() === NATIVE_ADDRESS)

  const [erc20Results, nativeAmount] = await Promise.all([
    erc20.length
      ? pub.multicall({
          allowFailure: true,
          contracts: erc20.map(t => ({
            address: t.address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'balanceOf' as const,
            args: [owner_] as const,
          })),
        })
      : Promise.resolve([]),
    native.length ? pub.getBalance({ address: owner_ }).catch(() => 0n) : Promise.resolve(0n),
  ])

  return [
    ...erc20.map((t, i) => ({
      ...t,
      amount: erc20Results[i]?.status === 'success' ? (erc20Results[i].result as bigint) : 0n,
    })),
    ...native.map(t => ({ ...t, amount: nativeAmount })),
  ]
}

// ── SDK provider ─────────────────────────────────────────────────────────────

const evmProvider: SDKProvider = {
  type: ChainType.EVM,

  isAddress: (addr: string) => viemIsAddress(addr),

  async resolveAddress() { return undefined },

  /** Batched per chain, parallel across chains — see the note at the top. */
  async getBalance(client: SDKClient, walletAddress: string, tokens: Token[]): Promise<TokenAmount[]> {
    const byChain = new Map<number, Token[]>()
    for (const t of tokens) {
      const list = byChain.get(t.chainId)
      if (list) list.push(t)
      else byChain.set(t.chainId, [t])
    }
    const perChain = await Promise.all(
      [...byChain].map(([chainId, chainTokens]) =>
        balancesOnChain(client, chainId, walletAddress, chainTokens)
          .catch(() => chainTokens.map(t => ({ ...t, amount: 0n }))),
      ),
    )
    return perChain.flat()
  },

  async getStepExecutor(options: StepExecutorOptions) {
    const executor = new EVMStepExecutor(options)
    executor.setRefs(
      wallet.client,
      async (chainId: number) => {
        if (!wallet.switchChain) throw new Error('Wallet not ready')
        await wallet.switchChain(chainId)
      },
    )
    return executor
  },
}

// ── Client ───────────────────────────────────────────────────────────────────

let client: SDKClient | null = null

export function lifiClient(): SDKClient {
  if (!client) {
    client = createClient({
      integrator: 'fatdev',
      apiKey: import.meta.env.VITE_LIFI_API_KEY || undefined,
      providers: [evmProvider],
      preloadChains: true,
    })
  }
  return client
}

// ── Cached reads ─────────────────────────────────────────────────────────────
// Chains and token lists are effectively static for a session, so they are
// memoised as in-flight promises: concurrent callers share one request instead
// of racing duplicates.

let chainsPromise: Promise<ExtendedChain[]> | null = null

export function loadChains(): Promise<ExtendedChain[]> {
  chainsPromise ??= getChains(lifiClient(), { chainTypes: [ChainType.EVM] })
    .catch(e => { chainsPromise = null; throw e })
  return chainsPromise
}

const tokensByChain = new Map<number, Promise<Token[]>>()

/** Full token list for a chain — the searchable universe in the picker. */
export function loadTokens(chainId: number): Promise<Token[]> {
  let p = tokensByChain.get(chainId)
  if (!p) {
    p = getTokens(lifiClient(), { chains: [chainId] })
      .then(res => res.tokens?.[chainId] ?? [])
      .catch(e => { tokensByChain.delete(chainId); throw e })
    tokensByChain.set(chainId, p)
  }
  return p
}

/**
 * Every token the wallet holds, on every chain, in one request.
 *
 * This is the call that made the bridge usable: it replaces the per-token RPC
 * fan-out entirely. Results are cached per address for BALANCE_TTL so switching
 * chains or reopening the picker is instant; `force` bypasses the cache after a
 * bridge completes.
 */
const BALANCE_TTL = 30_000
type BalanceCache = { address: string; at: number; data: Record<number, TokenAmount[]> }
let balanceCache: BalanceCache | null = null
let balanceInFlight: Promise<Record<number, TokenAmount[]>> | null = null

export async function loadWalletBalances(
  address: string, force = false,
): Promise<Record<number, TokenAmount[]>> {
  const key = address.toLowerCase()
  if (!force && balanceCache && balanceCache.address === key
      && Date.now() - balanceCache.at < BALANCE_TTL) {
    return balanceCache.data
  }
  if (balanceInFlight && !force) return balanceInFlight

  balanceInFlight = getWalletBalances(lifiClient(), address)
    .then(res => {
      // WalletTokenExtended already carries `amount`; normalise to TokenAmount.
      const data: Record<number, TokenAmount[]> = {}
      for (const [chainId, tokens] of Object.entries(res ?? {})) {
        // WalletTokenExtended carries the same fields as TokenAmount plus
        // extras; only non-zero holdings are worth showing in the picker.
        const list = (tokens as unknown as TokenAmount[])
          .filter(t => { try { return BigInt(t.amount ?? 0) > 0n } catch { return false } })
        if (list.length) data[Number(chainId)] = list
      }
      balanceCache = { address: key, at: Date.now(), data }
      return data
    })
    .finally(() => { balanceInFlight = null })

  return balanceInFlight
}

export function clearBalanceCache() {
  balanceCache = null
}

// ── Quote + execution ────────────────────────────────────────────────────────

export type QuoteParams = {
  fromChain: number
  toChain: number
  fromToken: string
  toToken: string
  /** Base units, as a decimal string. */
  fromAmount: string
  fromAddress: string
  toAddress?: string
  /** Fraction, e.g. 0.005 for 0.5%. */
  slippage?: number
}

export function fetchQuote(params: QuoteParams, signal?: AbortSignal): Promise<LiFiStep> {
  return getQuote(lifiClient(), {
    ...params,
    integrator: 'fatdev',
    ...(LIFI_FEE > 0 ? { fee: LIFI_FEE } : {}),
  }, { signal })
}

export function quoteToRoute(quote: LiFiStep): Route {
  return convertQuoteToRoute(quote)
}

export function runRoute(
  route: Route,
  onUpdate: (r: RouteExtended) => void,
): Promise<RouteExtended> {
  return executeRoute(lifiClient(), route, { updateRouteHook: onUpdate })
}

export type { ExtendedChain, Token, TokenAmount, LiFiStep, Route, RouteExtended }
