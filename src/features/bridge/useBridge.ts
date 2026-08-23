/**
 * useBridge — all bridge state, kept out of the view layer.
 *
 * Balances come from LI.FI's wallet-balances endpoint (one request for every
 * chain) rather than per-token RPC reads, which is what made the old widget
 * take tens of seconds to populate its token picker.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAccount, useWalletClient, useSwitchChain } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import {
  loadChains, loadTokens, loadWalletBalances, clearBalanceCache,
  fetchQuote, quoteToRoute, runRoute, setBridgeWallet, NATIVE_ADDRESS,
  type ExtendedChain, type Token, type TokenAmount, type LiFiStep, type RouteExtended,
} from '../../lib/lifi'

export type Side = 'from' | 'to'
export type Phase = 'idle' | 'quoting' | 'ready' | 'running' | 'done' | 'error'

/** A token plus the connected wallet's balance of it, if any. */
export type TokenRow = Token & { amount?: bigint }

const DEFAULT_FROM_CHAIN = 1     // Ethereum
const DEFAULT_TO_CHAIN = 56      // BNB Chain
const QUOTE_DEBOUNCE = 450
const QUOTE_REFRESH = 20_000

export function useBridge() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { switchChainAsync } = useSwitchChain()

  // Keep the SDK provider pointed at the live wallet.
  useEffect(() => {
    setBridgeWallet(walletClient, async (chainId: number) => { await switchChainAsync({ chainId }) })
  }, [walletClient, switchChainAsync])

  // ── Chains ─────────────────────────────────────────────────────────────────
  const [chains, setChains] = useState<ExtendedChain[]>([])
  const [chainsError, setChainsError] = useState('')
  useEffect(() => {
    let alive = true
    loadChains()
      .then(c => { if (alive) setChains(c) })
      .catch(e => { if (alive) setChainsError(e?.message ?? 'Could not load chains') })
    return () => { alive = false }
  }, [])

  // ── Selection ──────────────────────────────────────────────────────────────
  const [fromChain, setFromChain] = useState(DEFAULT_FROM_CHAIN)
  const [toChain, setToChain] = useState(DEFAULT_TO_CHAIN)
  const [fromToken, setFromToken] = useState<Token | null>(null)
  const [toToken, setToToken] = useState<Token | null>(null)
  const [amount, setAmount] = useState('')

  // ── Balances — one request, every chain ────────────────────────────────────
  const [balances, setBalances] = useState<Record<number, TokenAmount[]>>({})
  const [balancesLoading, setBalancesLoading] = useState(false)

  const refreshBalances = useCallback(async (force = false) => {
    if (!address) { setBalances({}); return }
    setBalancesLoading(true)
    try {
      setBalances(await loadWalletBalances(address, force))
    } catch {
      setBalances({})   // the picker still works from the full token list
    } finally {
      setBalancesLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (!address) { clearBalanceCache(); setBalances({}); return }
    refreshBalances()
  }, [address, refreshBalances])

  const balanceOf = useCallback((chainId: number, tokenAddress: string): bigint => {
    const hit = balances[chainId]?.find(
      t => t.address.toLowerCase() === tokenAddress.toLowerCase(),
    )
    return hit?.amount ? BigInt(hit.amount) : 0n
  }, [balances])

  // ── Token lists ────────────────────────────────────────────────────────────
  // Held tokens first (they come from the balances call and are already loaded),
  // then the rest of the chain's tokens for search.
  const [tokenLists, setTokenLists] = useState<Record<number, Token[]>>({})
  const ensureTokens = useCallback(async (chainId: number) => {
    if (tokenLists[chainId]) return
    try {
      const list = await loadTokens(chainId)
      setTokenLists(prev => (prev[chainId] ? prev : { ...prev, [chainId]: list }))
    } catch { /* held tokens still render */ }
  }, [tokenLists])

  // Ethereum alone returns ~5,400 tokens, and this runs for the picker and for
  // both default-token effects — so the merge+sort is memoised per chain rather
  // than redone on every render.
  const sortedByChain = useMemo(() => {
    const out = new Map<number, TokenRow[]>()
    const chainIds = new Set([
      ...Object.keys(balances).map(Number),
      ...Object.keys(tokenLists).map(Number),
    ])
    for (const chainId of chainIds) {
      const held = balances[chainId] ?? []
      const heldKeys = new Set(held.map(t => t.address.toLowerCase()))

      // Held tokens first, ranked by what they are worth.
      const withBalance: TokenRow[] = held
        .map(t => ({ ...t, amount: BigInt(t.amount ?? 0) }))
        .sort((a, b) => usdValue(b) - usdValue(a))

      // Then the rest of the chain. The API's order reads as noise, so surface
      // recognisable tokens — native coin, then priced-and-logoed ones — first.
      const rest = (tokenLists[chainId] ?? [])
        .filter(t => !heldKeys.has(t.address.toLowerCase()))
        .sort((a, b) => rank(b) - rank(a))

      out.set(chainId, [...withBalance, ...rest])
    }
    return out
  }, [balances, tokenLists])

  const tokensFor = useCallback(
    (chainId: number): TokenRow[] => sortedByChain.get(chainId) ?? [],
    [sortedByChain],
  )

  // Preload both sides' token lists so the picker opens instantly.
  useEffect(() => { ensureTokens(fromChain) }, [fromChain, ensureTokens])
  useEffect(() => { ensureTokens(toChain) }, [toChain, ensureTokens])

  // Default each side to the chain's native coin once its list arrives.
  useEffect(() => {
    if (fromToken?.chainId === fromChain) return
    const native = tokensFor(fromChain).find(t => t.address.toLowerCase() === NATIVE_ADDRESS)
    if (native) setFromToken(native)
  }, [fromChain, fromToken, tokensFor])

  useEffect(() => {
    if (toToken?.chainId === toChain) return
    const native = tokensFor(toChain).find(t => t.address.toLowerCase() === NATIVE_ADDRESS)
    if (native) setToToken(native)
  }, [toChain, toToken, tokensFor])

  // ── Quote ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('idle')
  const [quote, setQuote] = useState<LiFiStep | null>(null)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const fromAmountRaw = useMemo(() => {
    if (!fromToken || !amount) return null
    try {
      const v = parseUnits(amount as `${number}`, fromToken.decimals)
      return v > 0n ? v.toString() : null
    } catch { return null }
  }, [amount, fromToken])

  const insufficient = useMemo(() => {
    if (!fromToken || !fromAmountRaw || !isConnected) return false
    return BigInt(fromAmountRaw) > balanceOf(fromChain, fromToken.address)
  }, [fromToken, fromAmountRaw, fromChain, balanceOf, isConnected])

  const requestQuote = useCallback(async () => {
    abortRef.current?.abort()
    if (!fromToken || !toToken || !fromAmountRaw || !address) {
      setQuote(null); setPhase('idle'); setError('')
      return
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setPhase('quoting'); setError('')
    try {
      const q = await fetchQuote({
        fromChain, toChain,
        fromToken: fromToken.address,
        toToken: toToken.address,
        fromAmount: fromAmountRaw,
        fromAddress: address,
      }, ctrl.signal)
      if (ctrl.signal.aborted) return
      setQuote(q); setPhase('ready')
    } catch (e: any) {
      if (ctrl.signal.aborted || e?.name === 'AbortError') return
      setQuote(null); setPhase('error')
      setError(readableQuoteError(e))
    }
  }, [fromChain, toChain, fromToken, toToken, fromAmountRaw, address])

  // Debounce while typing; refresh a standing quote so the rate stays live.
  useEffect(() => {
    if (phase === 'running') return
    const t = setTimeout(requestQuote, QUOTE_DEBOUNCE)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestQuote])

  useEffect(() => {
    if (phase !== 'ready') return
    const t = setInterval(requestQuote, QUOTE_REFRESH)
    return () => clearInterval(t)
  }, [phase, requestQuote])

  // ── Execution ──────────────────────────────────────────────────────────────
  const [route, setRoute] = useState<RouteExtended | null>(null)

  const execute = useCallback(async () => {
    if (!quote) return
    setPhase('running'); setError('')
    const initial = quoteToRoute(quote)
    setRoute(initial as RouteExtended)
    try {
      const finished = await runRoute(initial, r => setRoute({ ...r }))
      setRoute(finished)
      setPhase('done')
      refreshBalances(true)
    } catch (e: any) {
      setPhase('error')
      setError(e?.message ?? 'The bridge failed')
    }
  }, [quote, refreshBalances])

  const reset = useCallback(() => {
    setRoute(null); setQuote(null); setAmount(''); setPhase('idle'); setError('')
  }, [])

  const swapSides = useCallback(() => {
    setFromChain(toChain); setToChain(fromChain)
    setFromToken(toToken); setToToken(fromToken)
    setAmount('')
  }, [fromChain, toChain, fromToken, toToken])

  const setMax = useCallback(() => {
    if (!fromToken) return
    const bal = balanceOf(fromChain, fromToken.address)
    if (bal <= 0n) return
    // Leave a little native coin behind for gas, or the bridge tx cannot be paid for.
    const spendable = fromToken.address.toLowerCase() === NATIVE_ADDRESS
      ? (bal * 95n) / 100n
      : bal
    setAmount(formatUnits(spendable, fromToken.decimals))
  }, [fromToken, fromChain, balanceOf])

  return {
    // wallet
    address, isConnected,
    // chains + tokens
    chains, chainsError, tokensFor, ensureTokens,
    fromChain, toChain, setFromChain, setToChain,
    fromToken, toToken, setFromToken, setToToken,
    // amounts
    amount, setAmount, setMax, insufficient,
    // balances
    balanceOf, balancesLoading, refreshBalances,
    // quote + run
    phase, quote, route, error, execute, reset, swapSides,
  }
}

function usdValue(t: TokenRow): number {
  if (!t.amount || !t.priceUSD) return 0
  const v = Number(t.amount) / 10 ** t.decimals * Number(t.priceUSD)
  return isFinite(v) ? v : 0
}

/** Crude recognisability score used to order an unfiltered chain list. */
function rank(t: Token): number {
  let n = 0
  if (t.address.toLowerCase() === NATIVE_ADDRESS) n += 100
  if (t.logoURI) n += 10
  if (t.priceUSD && Number(t.priceUSD) > 0) n += 5
  if (t.symbol && t.symbol.length <= 5) n += 1
  return n
}

/** LI.FI's raw errors are not for end users. */
function readableQuoteError(e: any): string {
  const msg: string = e?.message ?? ''
  if (/no available quotes|no routes/i.test(msg)) {
    return 'No route available for this pair right now. Try a different token or a larger amount.'
  }
  if (/amount.*too low|minimum/i.test(msg)) {
    return 'Amount is below the minimum this route supports. Try a larger amount.'
  }
  if (/insufficient/i.test(msg)) return 'Not enough balance to cover this transfer plus fees.'
  return msg || 'Could not fetch a quote'
}
