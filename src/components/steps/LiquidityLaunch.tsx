/**
 * LiquidityLaunch — post-deploy launch sequence
 *
 * Walks the user through the correct order:
 *   1. Approve DEX router to spend tokens  (prevents TransferHelper: TRANSFER_FROM_FAILED)
 *   2. Add Liquidity  (ETH + token amount, configurable slippage)
 *   3. startLP()      (enable LP additions on the contract)
 *   4. launch()       (open public trading — irreversible)
 */
import { useState, useEffect } from 'react'
import { useWalletClient, usePublicClient, useChainId, useAccount } from 'wagmi'
import { parseEther, parseUnits, formatUnits, maxUint256 } from 'viem'
import { CHAIN_EXPLORERS } from '../../lib/wagmi'
import { StatusBox, Spinner } from '../ui-kit'

// ── Minimal ABIs ──────────────────────────────────────────────────────────────
const ERC20_ABI = [
  { name: 'approve',   type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'decimals',  type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
] as const

// Reads the router + currency the token was actually deployed with
const FAT_CONFIG_ABI = [
  { name: '_swapRouter',      type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'currency',         type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'currencyIsEth',    type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'antiSYNC',         type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { name: 'startTradeBlock',  type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'startLPBlock',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

const FAT_ABI = [
  { name: 'startLP',            type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'launch',             type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'setAntiSYNCEnable',  type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 's', type: 'bool' }], outputs: [] },
] as const

const ROUTER_ABI = [
  {
    name: 'addLiquidityETH', type: 'function', stateMutability: 'payable',
    inputs: [
      { name: 'token',              type: 'address' },
      { name: 'amountTokenDesired', type: 'uint256' },
      { name: 'amountTokenMin',     type: 'uint256' },
      { name: 'amountETHMin',       type: 'uint256' },
      { name: 'to',                 type: 'address'  },
      { name: 'deadline',           type: 'uint256' },
    ],
    outputs: [
      { name: 'amountToken', type: 'uint256' },
      { name: 'amountETH',   type: 'uint256' },
      { name: 'liquidity',   type: 'uint256' },
    ],
  },
] as const

// ── Step status types ─────────────────────────────────────────────────────────
type StepState = 'idle' | 'pending' | 'ok' | 'err'

interface LaunchState {
  approve:  StepState
  addLiq:   StepState
  startLP:  StepState
  launch:   StepState
}

const INIT: LaunchState = { approve: 'idle', addLiq: 'idle', startLP: 'idle', launch: 'idle' }

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  contractAddress: string   // deployed FatTokenV5 address
  tokenSymbol:     string
  tokenDecimals?:  number   // default 18 if not known
}

export function LiquidityLaunch({ contractAddress, tokenSymbol, tokenDecimals = 18 }: Props) {
  const { address } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  // Form inputs
  const [tokenAmt,  setTokenAmt]  = useState('')
  const [ethAmt,    setEthAmt]    = useState('')
  const [slippage,  setSlippage]  = useState('5')   // default 5% — tolerant for new pools

  // On-chain balance & decimals
  const [tokenBal,  setTokenBal]  = useState<bigint | null>(null)
  const [decimals,  setDecimals]  = useState<number>(tokenDecimals)
  const [balLoading, setBalLoading] = useState(false)

  // Token's own router + currency (read from contract, not hardcoded)
  const [tokenRouter, setTokenRouter]                 = useState<string | null>(null)
  const [tokenCurrencyIsEth, setTokenCurrencyIsEth]   = useState<boolean | null>(null)
  const [tokenCurrency, setTokenCurrency]             = useState<string | null>(null)
  const [antiSyncEnabled, setAntiSyncEnabled]         = useState<boolean>(false)
  const [alreadyLaunched, setAlreadyLaunched]         = useState<boolean>(false)
  const [alreadyStartedLP, setAlreadyStartedLP]       = useState<boolean>(false)

  // Execution state
  const [steps, setSteps]         = useState<LaunchState>(INIT)
  const [msgs,  setMsgs]          = useState<Partial<Record<keyof LaunchState, string>>>({})
  const [running, setRunning]     = useState(false)
  const [txLinks, setTxLinks]     = useState<Partial<Record<keyof LaunchState, string>>>({})

  const explorer     = CHAIN_EXPLORERS[chainId]
  const nativeSymbol = chainId === 56 || chainId === 97 ? 'BNB' : 'ETH'

  // ── Read decimals, balance, AND the token's own router from chain ──────────
  useEffect(() => {
    if (!publicClient || !address || !contractAddress.startsWith('0x')) return
    const token = contractAddress as `0x${string}`
    setBalLoading(true)
    Promise.all([
      publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'decimals' }),
      publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [address as `0x${string}`] }),
      publicClient.readContract({ address: token, abi: FAT_CONFIG_ABI, functionName: '_swapRouter' }),
      publicClient.readContract({ address: token, abi: FAT_CONFIG_ABI, functionName: 'currencyIsEth' }),
      publicClient.readContract({ address: token, abi: FAT_CONFIG_ABI, functionName: 'currency' }),
      publicClient.readContract({ address: token, abi: FAT_CONFIG_ABI, functionName: 'antiSYNC' }),
      publicClient.readContract({ address: token, abi: FAT_CONFIG_ABI, functionName: 'startTradeBlock' }),
      publicClient.readContract({ address: token, abi: FAT_CONFIG_ABI, functionName: 'startLPBlock' }),
    ])
      .then(([dec, bal, router, isEth, currency, antiSync, tradeBlock, lpBlock]) => {
        setDecimals(Number(dec as bigint | number))
        setTokenBal(bal as bigint)
        setTokenRouter((router as string).toLowerCase())
        setTokenCurrencyIsEth(isEth as boolean)
        setTokenCurrency(currency as string)
        setAntiSyncEnabled(antiSync as boolean)
        setAlreadyLaunched((tradeBlock as bigint) > 0n)
        setAlreadyStartedLP((lpBlock as bigint) > 0n)
      })
      .catch(() => {})
      .finally(() => setBalLoading(false))
  }, [publicClient, address, contractAddress])

  const balFormatted = tokenBal !== null ? formatUnits(tokenBal, decimals) : null
  const balNum       = balFormatted ? parseFloat(balFormatted) : 0
  const inputNum     = parseFloat(tokenAmt) || 0
  const balInsufficient = tokenBal !== null && tokenAmt !== '' && inputNum > balNum

  function setStep(key: keyof LaunchState, state: StepState, msg?: string) {
    setSteps(s => ({ ...s, [key]: state }))
    if (msg !== undefined) setMsgs(m => ({ ...m, [key]: msg }))
  }
  function setTxLink(key: keyof LaunchState, hash: string) {
    setTxLinks(t => ({ ...t, [key]: `${explorer}/tx/${hash}` }))
  }

  async function run() {
    if (!walletClient || !publicClient || !address) return
    if (!tokenAmt || !ethAmt) return

    // Guard: check balance before doing anything
    if (balInsufficient) {
      setStep('approve', 'err',
        `Your wallet only holds ${Number(balFormatted).toLocaleString()} ${tokenSymbol}. ` +
        `Reduce the token amount or transfer tokens to this wallet first.`)
      return
    }

    // Guard: non-ETH currency needs addLiquidity, not addLiquidityETH
    if (tokenCurrencyIsEth === false) {
      setStep('approve', 'err',
        `This token is paired with ${tokenCurrency ? tokenCurrency.slice(0,8)+'…' : 'a non-native token'}, not ${nativeSymbol}. ` +
        `Use your DEX's "Add Liquidity" UI directly with both token addresses.`)
      return
    }

    if (!tokenRouter) {
      setStep('approve', 'err', 'Still reading token contract data — wait a moment and retry.')
      return
    }

    setRunning(true)
    setSteps(INIT)
    setMsgs({})
    setTxLinks({})

    const tokenAddress  = contractAddress as `0x${string}`
    // Use the router the token was ACTUALLY deployed with, not a hardcoded constant
    const routerAddress = tokenRouter as `0x${string}`
    void slippage // minimums are 0n for first add — no existing price to protect

    try {
      const [acct] = await walletClient.getAddresses()

      // ── STEP 0 (inside approve): Disable antiSYNC if on ───────────────────
      // antiSYNC blocks the PancakeSwap pair from calling balanceOf(pair)
      // during mint() when the pool is empty — first LP add always reverts.
      setStep('approve', 'pending', antiSyncEnabled ? 'Disabling antiSYNC (required for first liquidity add)…' : 'Checking existing allowance…')

      if (antiSyncEnabled) {
        const disableHash = await walletClient.writeContract({
          address: tokenAddress as `0x${string}`, abi: FAT_ABI,
          functionName: 'setAntiSYNCEnable',
          args: [false],
          account: acct, chain: walletClient.chain!,
        })
        await publicClient.waitForTransactionReceipt({ hash: disableHash })
        setAntiSyncEnabled(false)
        setStep('approve', 'pending', 'antiSYNC disabled. Checking allowance…')
      }

      // ── STEP 1: Approve ────────────────────────────────────────────────────
      // Re-read live balance at run time (user may have received tokens after mount)
      const liveBal = await publicClient.readContract({
        address: tokenAddress as `0x${string}`, abi: ERC20_ABI,
        functionName: 'balanceOf', args: [acct],
      }) as bigint

      const tokenAmtBig = parseUnits(tokenAmt, decimals)

      if (liveBal < tokenAmtBig) {
        throw new Error(
          `Wallet balance too low: you have ${formatUnits(liveBal, decimals)} ${tokenSymbol} ` +
          `but entered ${tokenAmt}. Use the MAX button or reduce the amount.`
        )
      }

      const currentAllowance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`, abi: ERC20_ABI,
        functionName: 'allowance',
        args: [acct, routerAddress],
      }) as bigint

      if (currentAllowance < tokenAmtBig) {
        setStep('approve', 'pending', 'Approving router to spend your tokens (unlimited approval)…')
        const appHash = await walletClient.writeContract({
          address: tokenAddress as `0x${string}`, abi: ERC20_ABI,
          functionName: 'approve',
          args: [routerAddress, maxUint256],
          account: acct, chain: walletClient.chain!,
        })
        setStep('approve', 'pending', 'Waiting for approval tx to confirm…')
        await publicClient.waitForTransactionReceipt({ hash: appHash })
        setTxLink('approve', appHash)
        // Brief pause — some chains need 1–2 blocks before allowance is queryable
        await new Promise(r => setTimeout(r, 2000))
        setStep('approve', 'ok', 'Router approved ✓')
      } else {
        setStep('approve', 'ok', 'Router already approved ✓')
      }

      // ── STEP 2: Add Liquidity ──────────────────────────────────────────────
      setStep('addLiq', 'pending', `Adding ${tokenAmt} ${tokenSymbol} + ${ethAmt} ${nativeSymbol} to liquidity pool…`)

      const ethAmtBig      = parseEther(ethAmt)
      // Use 0 minimums for the very first liquidity add — no existing price to protect
      const tokenAmtMin    = 0n
      const ethAmtMin      = 0n
      const deadline       = BigInt(Math.floor(Date.now() / 1000) + 1200) // 20 min

      const liqHash = await walletClient.writeContract({
        address: routerAddress, abi: ROUTER_ABI,
        functionName: 'addLiquidityETH',
        args: [tokenAddress as `0x${string}`, tokenAmtBig, tokenAmtMin, ethAmtMin, acct, deadline],
        value: ethAmtBig,
        account: acct, chain: walletClient.chain!,
      })
      setStep('addLiq', 'pending', 'Waiting for liquidity confirmation…')
      await publicClient.waitForTransactionReceipt({ hash: liqHash })
      setTxLink('addLiq', liqHash)
      setStep('addLiq', 'ok', 'Liquidity added ✓')

      // ── STEP 3: startLP (skip if already done) ────────────────────────────
      if (alreadyStartedLP) {
        setStep('startLP', 'ok', 'startLP() already called ✓')
      } else {
        setStep('startLP', 'pending', 'Calling startLP() to enable LP additions…')
        const startLPHash = await walletClient.writeContract({
          address: tokenAddress as `0x${string}`, abi: FAT_ABI,
          functionName: 'startLP',
          account: acct, chain: walletClient.chain!,
        })
        await publicClient.waitForTransactionReceipt({ hash: startLPHash })
        setTxLink('startLP', startLPHash)
        setAlreadyStartedLP(true)
        setStep('startLP', 'ok', 'startLP() confirmed ✓')
      }

      // ── STEP 4: launch (skip if already done) ─────────────────────────────
      if (alreadyLaunched) {
        setStep('launch', 'ok', `${tokenSymbol} trading was already open ✓`)
      } else {
        setStep('launch', 'pending', 'Calling launch() — this opens public trading…')
        const launchHash = await walletClient.writeContract({
          address: tokenAddress as `0x${string}`, abi: FAT_ABI,
          functionName: 'launch',
          account: acct, chain: walletClient.chain!,
        })
        await publicClient.waitForTransactionReceipt({ hash: launchHash })
        setTxLink('launch', launchHash)
        setAlreadyLaunched(true)
        setStep('launch', 'ok', `🚀 ${tokenSymbol} is now live for public trading!`)
      }

    } catch (e: any) {
      // Mark whichever step is still pending as failed
      const pending = (['approve', 'addLiq', 'startLP', 'launch'] as const)
        .find(k => steps[k] === 'pending' || (steps.approve === 'ok' && k === 'addLiq' && steps.addLiq === 'idle'))
      const failKey = pending ?? 'addLiq'
      const raw = e.message ?? String(e)
      // Friendly error translation
      const friendly =
        raw.includes('Wallet balance too low')      ? raw :
        raw.includes('TRANSFER_FROM_FAILED')        ? `Token transfer failed — your wallet may not hold enough ${tokenSymbol}. Check your balance and use the MAX button.` :
        raw.includes('!sync')                       ? 'antiSYNC is blocking the pool — click Retry and it will be disabled automatically.' :
        raw.includes('INSUFFICIENT_A')              ? 'Add liquidity failed (INSUFFICIENT_A) — try again, amounts are already 0-slippage.' :
        raw.includes('INSUFFICIENT_OUTPUT')         ? 'Add liquidity failed (INSUFFICIENT_OUTPUT) — try again.' :
        raw.includes('insufficient allowance')      ? 'Approval did not register in time — click Retry to re-run.' :
        raw.includes('startedAddLP')                ? 'startLP() already called — click Retry, it will be skipped.' :
        raw.includes('already open')                ? 'launch() already called — click Retry, it will be skipped.' :
        raw.includes('EXPIRED')                     ? 'Transaction expired — please try again' :
        raw.includes('insufficient funds')          ? `Not enough ${nativeSymbol} in wallet for liquidity + gas fees` :
        raw.includes('user rejected')               ? 'Transaction rejected in wallet' :
        raw.includes('execution reverted')          ? `Contract reverted: ${raw.slice(0, 120)}` :
        raw
      setStep(failKey, 'err', friendly)
    }
    setRunning(false)
  }

  const allDone = steps.launch === 'ok'
  const hasError = (['approve', 'addLiq', 'startLP', 'launch'] as const).some(k => steps[k] === 'err')

  return (
    <div style={{ marginTop: 20 }}>
      <div className="card">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>💧</span>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Add Liquidity &amp; Launch</div>
          <span className="pill pill-gold" style={{ fontSize: 10 }}>Post-deploy</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
          Runs the 4-step launch sequence in order: <strong style={{ color: '#fff' }}>Approve → Add Liquidity → startLP → launch()</strong>.
          Skips the approve if the router already has sufficient allowance.
        </div>

        {/* Balance display */}
        <div style={{
          marginBottom: 14, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(255,215,0,0.05)', border: '0.5px solid rgba(255,215,0,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {balLoading
              ? 'Reading wallet balance…'
              : tokenBal === null
                ? 'Connect wallet to see balance'
                : balNum === 0
                  ? <span style={{ color: 'var(--red)' }}>
                      ⚠ No {tokenSymbol} in this wallet. Tokens were sent to the receiveAddress — switch wallet or transfer tokens here first.
                    </span>
                  : <span>Wallet balance: <strong style={{ color: 'var(--green)', fontFamily: "'Space Mono',monospace" }}>
                      {Number(balFormatted).toLocaleString()} {tokenSymbol}
                    </strong></span>
            }
          </div>
          {balNum > 0 && (
            <button onClick={() => setTokenAmt(balFormatted!)}
              style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20,
                background: 'rgba(255,215,0,0.15)', color: 'var(--fd-cyan)',
                border: '0.5px solid rgba(255,215,0,0.3)', cursor: 'pointer', fontWeight: 700 }}>
              USE MAX
            </button>
          )}
        </div>

        {/* antiSYNC auto-fix notice */}
        {antiSyncEnabled && (
          <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(255,152,0,0.07)', border: '0.5px solid rgba(255,152,0,0.3)',
            fontSize: 12, color: '#ffab40', lineHeight: 1.6 }}>
            ⚡ <strong>antiSYNC is ON</strong> — this blocks the first liquidity add.
            It will be <strong>automatically disabled</strong> as step 1 of the sequence.
          </div>
        )}

        {/* Already-launched notice */}
        {alreadyLaunched && (
          <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(0,230,118,0.07)', border: '0.5px solid rgba(0,230,118,0.25)',
            fontSize: 12, color: 'var(--green)', lineHeight: 1.6 }}>
            ✓ Trading is already open. You can still add more liquidity — startLP/launch steps will be skipped.
          </div>
        )}

        {/* Input row */}
        <div className="grid-2" style={{ gap: 10, marginBottom: 14 }}>
          <div>
            <div className="field-label">Token amount for LP ({tokenSymbol})</div>
            <input className="field-input" type="number" min="0" placeholder="e.g. 500000000"
              value={tokenAmt} onChange={e => setTokenAmt(e.target.value)}
              style={{ borderColor: balInsufficient ? 'var(--red)' : undefined }} />
            {balInsufficient && (
              <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>
                Exceeds balance — use MAX or reduce amount
              </div>
            )}
          </div>
          <div>
            <div className="field-label">{nativeSymbol} amount for LP</div>
            <input className="field-input" type="number" min="0" step="0.01" placeholder="e.g. 1.5"
              value={ethAmt} onChange={e => setEthAmt(e.target.value)} />
          </div>
          <div>
            <div className="field-label">Slippage % <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(5–10% recommended for new pools)</span></div>
            <input className="field-input" type="number" min="1" max="50" step="0.5"
              value={slippage} onChange={e => setSlippage(e.target.value)} />
          </div>
        </div>

        {/* DEX router info (read from token contract) */}
        {tokenRouter ? (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, fontFamily: "'Space Mono',monospace" }}>
            Router (from contract): <span style={{ color: 'var(--fd-cyan)' }}>{tokenRouter}</span>
          </div>
        ) : balLoading ? (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Reading token contract…</div>
        ) : null}
        {tokenCurrencyIsEth === false && (
          <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8,
            background: 'rgba(255,82,82,0.07)', border: '0.5px solid rgba(255,82,82,0.25)',
            fontSize: 12, color: 'var(--red)', lineHeight: 1.6 }}>
            ⚠ This token is paired with a non-native token (not {nativeSymbol}).
            Use your DEX's Add Liquidity interface directly with both token contract addresses.
          </div>
        )}

        {/* Step tracker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
          {([ ['approve', '1', 'Approve router'],
               ['addLiq',  '2', 'Add Liquidity'],
               ['startLP', '3', 'startLP()'],
               ['launch',  '4', 'launch()'],
          ] as const).map(([key, num, label]) => {
            const state = steps[key]
            const msg   = msgs[key]
            const link  = txLinks[key]
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                background:
                  state === 'ok'      ? 'rgba(0,230,118,0.07)'  :
                  state === 'err'     ? 'rgba(255,82,82,0.07)'  :
                  state === 'pending' ? 'rgba(74,144,226,0.07)' :
                  'rgba(255,255,255,0.03)',
                border: `0.5px solid ${
                  state === 'ok'      ? 'rgba(0,230,118,0.25)'  :
                  state === 'err'     ? 'rgba(255,82,82,0.25)'  :
                  state === 'pending' ? 'rgba(74,144,226,0.25)' :
                  'var(--border)'
                }`,
              }}>
                {/* Badge */}
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800,
                  background:
                    state === 'ok'      ? 'var(--green)' :
                    state === 'err'     ? 'var(--red)'   :
                    state === 'pending' ? '#4A90E2'      : 'var(--border)',
                  color: state === 'idle' ? 'var(--text-muted)' : 'var(--fd-void)',
                }}>
                  {state === 'ok' ? '✓' : state === 'err' ? '✗' : state === 'pending' ? '…' : num}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: state === 'ok' ? 'var(--green)' : state === 'err' ? 'var(--red)' : '#fff',
                  }}>
                    {label}
                  </div>
                  {msg && (
                    <div style={{ fontSize: 11, color: state === 'err' ? 'var(--red)' : 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
                      {msg}
                    </div>
                  )}
                  {link && (
                    <a href={link} target="_blank" rel="noopener"
                      style={{ fontSize: 11, color: 'var(--blue)', fontFamily: "'Space Mono',monospace", marginTop: 2, display: 'block' }}>
                      View tx →
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {running && <Spinner />}

        {allDone ? (
          <StatusBox msg={`🚀 ${tokenSymbol} is live! All 4 steps complete.`} type="ok" />
        ) : (
          <button
            className="btn-primary" style={{ width: '100%', padding: 13 }}
            onClick={run}
            disabled={running || !tokenAmt || !ethAmt || !walletClient || !tokenRouter || balInsufficient || tokenCurrencyIsEth === false}>
            {running
              ? 'Running launch sequence…'
              : hasError
              ? '↺ Retry from failed step'
              : `Run launch sequence for ${tokenSymbol}`}
          </button>
        )}

        {!tokenRouter && !balLoading && contractAddress.startsWith('0x') && (
          <StatusBox msg="Could not read router from token contract. Make sure you're on the right chain." type="err" />
        )}

        {/* Warning about launch() being irreversible */}
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 8,
          background: 'rgba(255,82,82,0.05)', border: '0.5px solid rgba(255,82,82,0.2)',
          fontSize: 11, color: 'rgba(255,82,82,0.8)', lineHeight: 1.6,
        }}>
          ⚠ <strong>launch()</strong> opens public trading permanently — it cannot be undone.
          Make sure liquidity is added before proceeding.
        </div>
      </div>
    </div>
  )
}
