/**
 * LiquidityLaunch — post-deploy launch sequence
 *
 * Walks the user through the correct order:
 *   1. Approve DEX router to spend tokens  (prevents TransferHelper: TRANSFER_FROM_FAILED)
 *   2. Add Liquidity  (ETH + token amount, configurable slippage)
 *   3. startLP()      (enable LP additions on the contract)
 *   4. launch()       (open public trading — irreversible)
 */
import { useState } from 'react'
import { useWalletClient, usePublicClient, useChainId, useAccount } from 'wagmi'
import { parseEther, parseUnits, maxUint256 } from 'viem'
import { ROUTERS, CHAIN_EXPLORERS } from '../../lib/wagmi'
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

const FAT_ABI = [
  { name: 'startLP', type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { name: 'launch',  type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
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
  const [tokenAmt,  setTokenAmt]  = useState('')          // token amount for LP
  const [ethAmt,    setEthAmt]    = useState('')          // ETH/BNB amount for LP
  const [slippage,  setSlippage]  = useState('1')         // % slippage tolerance

  // Execution state
  const [steps, setSteps]         = useState<LaunchState>(INIT)
  const [msgs,  setMsgs]          = useState<Partial<Record<keyof LaunchState, string>>>({})
  const [running, setRunning]     = useState(false)
  const [txLinks, setTxLinks]     = useState<Partial<Record<keyof LaunchState, string>>>({})

  const router    = ROUTERS[chainId]
  const explorer  = CHAIN_EXPLORERS[chainId]
  const nativeSymbol = chainId === 56 || chainId === 97 ? 'BNB' : 'ETH'

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
    setRunning(true)
    setSteps(INIT)
    setMsgs({})
    setTxLinks({})

    const tokenAddress = contractAddress as `0x${string}`
    const routerAddress = router as `0x${string}`
    const slippageBps = Math.round(Number(slippage) * 100)    // e.g. 1% → 100
    const slippageFactor = 10000 - slippageBps               // e.g. 9900

    try {
      // ── STEP 1: Approve ────────────────────────────────────────────────────
      setStep('approve', 'pending', 'Checking existing allowance…')

      const [acct] = await walletClient.getAddresses()
      const currentAllowance = await publicClient.readContract({
        address: tokenAddress, abi: ERC20_ABI,
        functionName: 'allowance',
        args: [acct, routerAddress],
      }) as bigint

      const tokenAmtBig = parseUnits(tokenAmt, tokenDecimals)

      if (currentAllowance < tokenAmtBig) {
        setStep('approve', 'pending', `Approving ${routerAddress.slice(0, 10)}… to spend your tokens…`)
        const appHash = await walletClient.writeContract({
          address: tokenAddress, abi: ERC20_ABI,
          functionName: 'approve',
          args: [routerAddress, maxUint256],
          account: acct, chain: walletClient.chain!,
        })
        setStep('approve', 'pending', 'Waiting for approval confirmation…')
        await publicClient.waitForTransactionReceipt({ hash: appHash })
        setTxLink('approve', appHash)
        setStep('approve', 'ok', 'Router approved ✓')
      } else {
        setStep('approve', 'ok', 'Router already approved ✓')
      }

      // ── STEP 2: Add Liquidity ──────────────────────────────────────────────
      setStep('addLiq', 'pending', `Adding ${tokenAmt} ${tokenSymbol} + ${ethAmt} ${nativeSymbol} to liquidity pool…`)

      const ethAmtBig      = parseEther(ethAmt)
      const tokenAmtMin    = (tokenAmtBig * BigInt(slippageFactor)) / 10000n
      const ethAmtMin      = (ethAmtBig   * BigInt(slippageFactor)) / 10000n
      const deadline       = BigInt(Math.floor(Date.now() / 1000) + 1200) // 20 min

      const liqHash = await walletClient.writeContract({
        address: routerAddress, abi: ROUTER_ABI,
        functionName: 'addLiquidityETH',
        args: [tokenAddress, tokenAmtBig, tokenAmtMin, ethAmtMin, acct, deadline],
        value: ethAmtBig,
        account: acct, chain: walletClient.chain!,
      })
      setStep('addLiq', 'pending', 'Waiting for liquidity confirmation…')
      await publicClient.waitForTransactionReceipt({ hash: liqHash })
      setTxLink('addLiq', liqHash)
      setStep('addLiq', 'ok', 'Liquidity added ✓')

      // ── STEP 3: startLP ────────────────────────────────────────────────────
      setStep('startLP', 'pending', 'Calling startLP() to enable LP additions…')
      const startLPHash = await walletClient.writeContract({
        address: tokenAddress, abi: FAT_ABI,
        functionName: 'startLP',
        account: acct, chain: walletClient.chain!,
      })
      await publicClient.waitForTransactionReceipt({ hash: startLPHash })
      setTxLink('startLP', startLPHash)
      setStep('startLP', 'ok', 'startLP() confirmed ✓')

      // ── STEP 4: launch ─────────────────────────────────────────────────────
      setStep('launch', 'pending', 'Calling launch() — this opens public trading…')
      const launchHash = await walletClient.writeContract({
        address: tokenAddress, abi: FAT_ABI,
        functionName: 'launch',
        account: acct, chain: walletClient.chain!,
      })
      await publicClient.waitForTransactionReceipt({ hash: launchHash })
      setTxLink('launch', launchHash)
      setStep('launch', 'ok', `🚀 ${tokenSymbol} is now live for public trading!`)

    } catch (e: any) {
      // Mark whichever step is still pending as failed
      const pending = (['approve', 'addLiq', 'startLP', 'launch'] as const)
        .find(k => steps[k] === 'pending' || (steps.approve === 'ok' && k === 'addLiq' && steps.addLiq === 'idle'))
      const failKey = pending ?? 'addLiq'
      const raw = e.message ?? String(e)
      // Friendly error translation
      const friendly =
        raw.includes('TRANSFER_FROM_FAILED') ? 'Approve step failed — the router was not approved to spend your tokens. This was the bug! Re-run the sequence.' :
        raw.includes('INSUFFICIENT_OUTPUT')  ? `Slippage too tight — try increasing slippage above ${slippage}%` :
        raw.includes('EXPIRED')              ? 'Transaction expired — please try again' :
        raw.includes('insufficient funds')   ? `Insufficient ${nativeSymbol} for liquidity + gas` :
        raw.includes('user rejected')        ? 'Transaction rejected in wallet' :
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

        {/* Input row */}
        <div className="grid-2" style={{ gap: 10, marginBottom: 14 }}>
          <div>
            <div className="field-label">Token amount for LP ({tokenSymbol})</div>
            <input className="field-input" type="number" min="0" placeholder="e.g. 500000000"
              value={tokenAmt} onChange={e => setTokenAmt(e.target.value)} />
          </div>
          <div>
            <div className="field-label">{nativeSymbol} amount for LP</div>
            <input className="field-input" type="number" min="0" step="0.01" placeholder="e.g. 1.5"
              value={ethAmt} onChange={e => setEthAmt(e.target.value)} />
          </div>
          <div>
            <div className="field-label">Slippage %</div>
            <input className="field-input" type="number" min="0.1" max="50" step="0.1"
              value={slippage} onChange={e => setSlippage(e.target.value)} />
          </div>
        </div>

        {/* DEX router info */}
        {router && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, fontFamily: "'Space Mono',monospace" }}>
            Router: <span style={{ color: 'var(--gold)' }}>{router}</span>
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
                  color: state === 'idle' ? 'var(--text-muted)' : 'var(--navy)',
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
            disabled={running || !tokenAmt || !ethAmt || !walletClient || !router}>
            {running
              ? 'Running launch sequence…'
              : hasError
              ? '↺ Retry from failed step'
              : `Run launch sequence for ${tokenSymbol}`}
          </button>
        )}

        {!router && (
          <StatusBox msg="No DEX router configured for this chain. Add it to ROUTERS in lib/wagmi.ts." type="err" />
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
