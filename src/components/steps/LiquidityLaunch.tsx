import { useState, useEffect } from 'react'
import { useWalletClient, usePublicClient, useChainId, useAccount } from 'wagmi'
import { parseEther, parseUnits, formatUnits, maxUint256 } from 'viem'
import { ROUTERS, WETH, DEX_FACTORIES, DEX_NAMES, CHAIN_EXPLORERS } from '../../lib/wagmi'
import { Spinner } from '../ui-kit'

// ── ABIs ──────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  { name: 'approve',   type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }] },
] as const

const ROUTER_ABI = [
  { name: 'addLiquidityETH', type: 'function', stateMutability: 'payable',
    inputs: [
      { name: 'token',              type: 'address'  },
      { name: 'amountTokenDesired', type: 'uint256'  },
      { name: 'amountTokenMin',     type: 'uint256'  },
      { name: 'amountETHMin',       type: 'uint256'  },
      { name: 'to',                 type: 'address'  },
      { name: 'deadline',           type: 'uint256'  },
    ],
    outputs: [
      { name: 'amountToken', type: 'uint256' },
      { name: 'amountETH',   type: 'uint256' },
      { name: 'liquidity',   type: 'uint256' },
    ],
  },
] as const

const FACTORY_ABI = [
  { name: 'getPair', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }],
    outputs: [{ name: 'pair', type: 'address' }] },
] as const

const FAT_TAX_ABI = [
  { name: 'setDexPair', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'pair', type: 'address' }, { name: 'status', type: 'bool' }],
    outputs: [] },
  { name: 'isDexPair', type: 'function', stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'dexRouter', type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ type: 'address' }] },
] as const

// ── Types ─────────────────────────────────────────────────────────────────────
type StepKey   = 'approve' | 'addLiq'
type StepState = 'idle' | 'pending' | 'ok' | 'err' | 'skip'

interface StepStatus { state: StepState; msg: string; txUrl?: string }

const IDLE: StepStatus = { state: 'idle', msg: '' }

function stepBg(s: StepState) {
  return s === 'ok'      ? 'rgba(0,230,118,0.08)'   :
         s === 'err'     ? 'rgba(255,82,82,0.08)'   :
         s === 'pending' ? 'rgba(0,207,255,0.08)'   :
         s === 'skip'    ? 'rgba(255,255,255,0.03)' :
         'rgba(255,255,255,0.03)'
}
function stepBorder(s: StepState) {
  return s === 'ok'      ? 'rgba(0,230,118,0.3)'  :
         s === 'err'     ? 'rgba(255,82,82,0.3)'  :
         s === 'pending' ? 'rgba(0,207,255,0.3)'  :
         'var(--border)'
}
function stepColor(s: StepState) {
  return s === 'ok'  ? 'var(--green)' :
         s === 'err' ? 'var(--red)'   :
         s === 'pending' ? 'var(--fd-cyan)' : '#fff'
}
function badgeBg(s: StepState) {
  return s === 'ok'      ? 'var(--green)'     :
         s === 'err'     ? 'var(--red)'       :
         s === 'pending' ? 'var(--fd-cyan)'   :
         s === 'skip'    ? 'var(--text-muted)' :
         'rgba(255,255,255,0.12)'
}
function badgeLabel(s: StepState, n: string) {
  return s === 'ok' ? '✓' : s === 'err' ? '✗' : s === 'pending' ? '…' : s === 'skip' ? '—' : n
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  contractAddress: string
  tokenSymbol:     string
  tokenDecimals?:  number
  tokenType?:      'standard' | 'tax' | 'deflationary' | 'reflection'
}

export function LiquidityLaunch({
  contractAddress,
  tokenSymbol,
  tokenDecimals = 18,
  tokenType = 'tax',
}: Props) {
  const { address, isConnected } = useAccount()
  const chainId                  = useChainId()
  const { data: walletClient }   = useWalletClient()
  const publicClient             = usePublicClient()

  // Chain-level config — always available, no contract reads needed
  const router    = ROUTERS[chainId]
  const weth      = WETH[chainId]
  const factory   = DEX_FACTORIES[chainId]
  const dexName   = DEX_NAMES[chainId] ?? 'DEX'
  const explorer  = CHAIN_EXPLORERS[chainId] ?? ''
  const native    = chainId === 56 || chainId === 97 ? 'BNB' : 'ETH'
  const isTaxed   = tokenType !== 'standard'

  // Form state
  const [tokenAmt, setTokenAmt] = useState('')
  const [nativeAmt, setNativeAmt] = useState('')

  // Balances
  const [tokenBal,   setTokenBal]   = useState<bigint | null>(null)
  const [nativeBal,  setNativeBal]  = useState<bigint | null>(null)
  const [balLoading, setBalLoading] = useState(false)
  const [decimals] = useState(tokenDecimals)

  // LP pair already registered?
  const [pairAlreadySet, setPairAlreadySet] = useState(false)

  // Step state
  const [approve,  setApprove]  = useState<StepStatus>(IDLE)
  const [addLiq,   setAddLiq]   = useState<StepStatus>(IDLE)
  const [running,  setRunning]  = useState(false)

  // setDexPair — separate optional action after liquidity is added
  const [pairStatus, setPairStatus] = useState<StepStatus>(IDLE)
  const [pairRunning, setPairRunning] = useState(false)
  const [lpPairAddr, setLpPairAddr] = useState<`0x${string}` | null>(null)

  // ── Load balances + check pair registration on mount ──────────────────────
  useEffect(() => {
    if (!publicClient || !address || !contractAddress.startsWith('0x')) return
    const token = contractAddress as `0x${string}`
    setBalLoading(true)

    const reads: Promise<unknown>[] = [
      publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] }),
      publicClient.getBalance({ address }),
    ]

    // Check if LP pair is already set (only for taxed tokens)
    if (isTaxed && factory && weth) {
      reads.push(
        publicClient.readContract({ address: factory, abi: FACTORY_ABI, functionName: 'getPair', args: [token, weth] })
          .then(async (pair) => {
            const p = pair as `0x${string}`
            const ZERO = '0x0000000000000000000000000000000000000000'
            if (p && p.toLowerCase() !== ZERO) {
              const isSet = await publicClient.readContract({
                address: token, abi: FAT_TAX_ABI, functionName: 'isDexPair', args: [p],
              }).catch(() => false)
              setPairAlreadySet(isSet as boolean)
            }
            return pair
          })
      )
    }

    Promise.all(reads)
      .then(([bal, native]) => {
        setTokenBal(bal as bigint)
        setNativeBal(native as bigint)
      })
      .catch(() => {})
      .finally(() => setBalLoading(false))
  }, [publicClient, address, contractAddress, chainId])

  const balFormatted  = tokenBal !== null ? formatUnits(tokenBal, decimals) : null
  const balNum        = balFormatted ? parseFloat(balFormatted) : 0
  const nativeBalEth  = nativeBal !== null ? parseFloat(formatUnits(nativeBal, 18)) : null
  const tokenInsuff   = tokenBal !== null && tokenAmt !== '' && parseFloat(tokenAmt) > balNum
  const nativeInsuff  = nativeBal !== null && nativeAmt !== '' && parseFloat(nativeAmt) > (nativeBalEth ?? 0)
  const allDone       = approve.state === 'ok' && addLiq.state === 'ok'
  const hasErr        = approve.state === 'err' || addLiq.state === 'err'

  function upd(set: (s: StepStatus) => void, state: StepState, msg: string, txHash?: `0x${string}`) {
    set({ state, msg, txUrl: txHash ? `${explorer}/tx/${txHash}` : undefined })
  }

  // ── Main run ───────────────────────────────────────────────────────────────
  async function run() {
    if (!walletClient || !publicClient || !address) return
    if (!tokenAmt || !nativeAmt) return
    if (!router || !weth) return

    setRunning(true)
    setApprove(IDLE); setAddLiq(IDLE)

    const token  = contractAddress as `0x${string}`
    const acct   = address as `0x${string}`

    try {
      // ── 1. Approve ────────────────────────────────────────────────────────
      upd(setApprove, 'pending', 'Checking current allowance…')

      const tokenAmtWei = parseUnits(tokenAmt, decimals)

      // Live balance guard
      const liveBal = await publicClient.readContract({
        address: token, abi: ERC20_ABI, functionName: 'balanceOf', args: [acct],
      }) as bigint
      if (liveBal < tokenAmtWei) {
        throw Object.assign(new Error(
          `Wallet only holds ${formatUnits(liveBal, decimals)} ${tokenSymbol} — reduce the amount or transfer tokens here first.`
        ), { step: 'approve' })
      }

      const allowance = await publicClient.readContract({
        address: token, abi: ERC20_ABI, functionName: 'allowance', args: [acct, router],
      }) as bigint

      if (allowance < tokenAmtWei) {
        upd(setApprove, 'pending', `Approving ${dexName} router… confirm in wallet`)
        const appGas = await publicClient.estimateContractGas({
          address: token, abi: ERC20_ABI, functionName: 'approve',
          args: [router, maxUint256], account: acct,
        })
        const appHash = await walletClient.writeContract({
          address: token, abi: ERC20_ABI, functionName: 'approve',
          args: [router, maxUint256],
          account: acct, chain: walletClient.chain!,
          gas: appGas * 12n / 10n,
        })
        upd(setApprove, 'pending', 'Waiting for approval confirmation…', appHash)
        await publicClient.waitForTransactionReceipt({ hash: appHash })
        await new Promise(r => setTimeout(r, 1500)) // let node propagate
        upd(setApprove, 'ok', `${dexName} router approved ✓`, appHash)
      } else {
        upd(setApprove, 'ok', 'Router already approved ✓')
      }

      // ── 2. Add Liquidity ─────────────────────────────────────────────────
      const nativeAmtWei = parseEther(nativeAmt)
      const deadline     = BigInt(Math.floor(Date.now() / 1000) + 1200) // 20 min

      upd(setAddLiq, 'pending',
        `Adding ${tokenAmt} ${tokenSymbol} + ${nativeAmt} ${native} to ${dexName} pool… confirm in wallet`)

      const liqGas = await publicClient.estimateContractGas({
        address: router, abi: ROUTER_ABI, functionName: 'addLiquidityETH',
        args: [token, tokenAmtWei, 0n, 0n, acct, deadline],
        value: nativeAmtWei, account: acct,
      }).catch(() => 500_000n)

      const liqHash = await walletClient.writeContract({
        address: router, abi: ROUTER_ABI, functionName: 'addLiquidityETH',
        args: [token, tokenAmtWei, 0n, 0n, acct, deadline],
        value: nativeAmtWei,
        account: acct, chain: walletClient.chain!,
        gas: (liqGas * 13n / 10n),
      })
      upd(setAddLiq, 'pending', 'Waiting for liquidity confirmation…', liqHash)
      await publicClient.waitForTransactionReceipt({ hash: liqHash })
      upd(setAddLiq, 'ok', `Liquidity added to ${dexName} ✓`, liqHash)

      // After liquidity is added, look up and store the LP pair address
      if (isTaxed && factory && weth) {
        await new Promise(r => setTimeout(r, 2000)) // let the node index the pair
        const pair = await publicClient.readContract({
          address: factory, abi: FACTORY_ABI, functionName: 'getPair', args: [token, weth],
        }).catch(() => null) as `0x${string}` | null
        const ZERO = '0x0000000000000000000000000000000000000000'
        if (pair && pair.toLowerCase() !== ZERO) setLpPairAddr(pair)
      }

    } catch (e: any) {
      const raw: string = e?.message ?? String(e)
      const friendly =
        raw.includes('Wallet only holds')          ? raw :
        raw.includes('TRANSFER_FROM_FAILED')       ? `Token transfer failed. Check your ${tokenSymbol} balance and use MAX.` :
        raw.includes('INSUFFICIENT_A_AMOUNT')      ? 'Liquidity failed (INSUFFICIENT_A) — pool may already exist. Try adding via the DEX UI.' :
        raw.includes('insufficient funds')         ? `Not enough ${native} for liquidity + gas` :
        raw.includes('user rejected')              ? 'Transaction rejected in wallet' :
        raw.includes('execution reverted')         ? `Contract reverted: ${raw.slice(0, 160)}` :
        raw.includes('EXPIRED')                    ? 'Transaction deadline expired — please retry' :
        raw

      // Mark the currently-pending step as failed
      if (approve.state === 'pending') upd(setApprove, 'err', friendly)
      else if (addLiq.state === 'pending') upd(setAddLiq, 'err', friendly)
      else upd(setApprove, 'err', friendly)
    }

    setRunning(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const canRun = isConnected && !!walletClient && !!router && !!tokenAmt && !!nativeAmt &&
                 !tokenInsuff && !nativeInsuff && !running

  const steps: { key: StepKey; n: string; label: string; status: StepStatus; show: boolean }[] = [
    { key: 'approve', n: '1', label: `Approve ${dexName} Router`, status: approve, show: true },
    { key: 'addLiq',  n: '2', label: 'Add Liquidity',              status: addLiq,  show: true },
  ]

  return (
    <div style={{
      background: 'var(--fd-surface)',
      border: '1px solid var(--fd-border)',
      borderRadius: 'var(--fd-radius-lg)',
      padding: '24px',
      marginTop: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(0,207,255,0.12)',
          border: '1px solid rgba(0,207,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}>💧</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Add Liquidity &amp; Launch</div>
          <div style={{ fontSize: 11, color: 'var(--fd-ghost)', marginTop: 1 }}>
            {dexName} · {isTaxed ? `${steps.filter(s => s.show).length} steps` : '2 steps'}
          </div>
        </div>
        {allDone && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 700,
            background: 'rgba(0,230,118,0.15)', color: 'var(--green)',
            border: '1px solid rgba(0,230,118,0.3)',
            padding: '3px 10px', borderRadius: 20,
          }}>LIVE</span>
        )}
      </div>

      {/* Not connected */}
      {!isConnected && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.2)',
          fontSize: 13, color: 'var(--text-secondary)',
        }}>
          Connect your wallet to add liquidity.
        </div>
      )}

      {/* Chain not supported */}
      {isConnected && !router && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: 'rgba(255,82,82,0.07)', border: '1px solid rgba(255,82,82,0.2)',
          fontSize: 13, color: 'var(--red)',
        }}>
          This chain is not supported for automatic liquidity. Use the DEX UI directly.
        </div>
      )}

      {isConnected && router && (
        <>
          {/* Balances */}
          <div style={{
            display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap',
          }}>
            {/* Token balance */}
            <div style={{
              flex: 1, minWidth: 160,
              padding: '10px 14px', borderRadius: 10,
              background: 'var(--fd-deep)', border: '1px solid var(--fd-border)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--fd-ghost)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                {tokenSymbol} balance
              </div>
              {balLoading ? (
                <div style={{ fontSize: 13, color: 'var(--fd-ghost)' }}>Loading…</div>
              ) : tokenBal === null ? (
                <div style={{ fontSize: 13, color: 'var(--fd-ghost)' }}>—</div>
              ) : balNum === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--red)' }}>
                  0 — tokens sent to receiveAddress. Transfer some here first.
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--fd-font-mono)' }}>
                    {Number(balFormatted).toLocaleString()}
                  </span>
                  <button
                    onClick={() => setTokenAmt(balFormatted!)}
                    style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: 'rgba(0,207,255,0.12)', color: 'var(--fd-cyan)',
                      border: '1px solid rgba(0,207,255,0.25)', cursor: 'pointer',
                    }}>MAX</button>
                </div>
              )}
            </div>

            {/* Native balance */}
            <div style={{
              flex: 1, minWidth: 160,
              padding: '10px 14px', borderRadius: 10,
              background: 'var(--fd-deep)', border: '1px solid var(--fd-border)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--fd-ghost)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                {native} balance
              </div>
              {balLoading ? (
                <div style={{ fontSize: 13, color: 'var(--fd-ghost)' }}>Loading…</div>
              ) : nativeBal === null ? (
                <div style={{ fontSize: 13, color: 'var(--fd-ghost)' }}>—</div>
              ) : (
                <div style={{ fontSize: 14, fontWeight: 700, color: nativeBalEth! < 0.01 ? 'var(--red)' : 'var(--fd-white)', fontFamily: 'var(--fd-font-mono)' }}>
                  {nativeBalEth!.toFixed(4)}
                </div>
              )}
            </div>
          </div>

          {/* Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fd-ghost)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {tokenSymbol} amount
              </div>
              <input
                className="field-input"
                type="number" min="0" placeholder="e.g. 500000000"
                value={tokenAmt}
                onChange={e => setTokenAmt(e.target.value)}
                style={{ borderColor: tokenInsuff ? 'var(--red)' : undefined }}
              />
              {tokenInsuff && (
                <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Exceeds balance</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fd-ghost)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {native} amount
              </div>
              <input
                className="field-input"
                type="number" min="0" step="0.01" placeholder="e.g. 1.5"
                value={nativeAmt}
                onChange={e => setNativeAmt(e.target.value)}
                style={{ borderColor: nativeInsuff ? 'var(--red)' : undefined }}
              />
              {nativeInsuff && (
                <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>Exceeds balance</div>
              )}
            </div>
          </div>

          {/* Router info */}
          <div style={{
            padding: '8px 12px', borderRadius: 8, marginBottom: 16,
            background: 'var(--fd-deep)', border: '1px solid var(--fd-border)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 12, color: 'var(--fd-ghost)' }}>DEX:</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fd-cyan)' }}>{dexName}</span>
            <span style={{ fontSize: 11, color: 'var(--fd-hint)', fontFamily: 'var(--fd-font-mono)', marginLeft: 'auto' }}>
              {router.slice(0, 10)}…
            </span>
          </div>

          {/* Step tracker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {steps.filter(s => s.show).map(({ key, n, label, status }) => (
              <div key={key} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '11px 14px', borderRadius: 10,
                background: stepBg(status.state),
                border: `1px solid ${stepBorder(status.state)}`,
                transition: 'all 0.2s ease',
              }}>
                {/* Number badge */}
                <div style={{
                  width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                  background: badgeBg(status.state),
                  color: status.state === 'idle' ? 'var(--fd-ghost)' : 'var(--fd-void)',
                  transition: 'background 0.2s',
                }}>
                  {badgeLabel(status.state, n)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: stepColor(status.state),
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {label}
                    {status.state === 'pending' && (
                      <span style={{
                        display: 'inline-block', width: 10, height: 10,
                        borderRadius: '50%', border: '2px solid var(--fd-cyan)',
                        borderTopColor: 'transparent',
                        animation: 'spin 0.8s linear infinite',
                      }} />
                    )}
                  </div>
                  {status.msg && (
                    <div style={{
                      fontSize: 11, marginTop: 3, lineHeight: 1.5,
                      color: status.state === 'err' ? 'var(--red)' : 'var(--fd-ghost)',
                    }}>
                      {status.msg}
                    </div>
                  )}
                  {status.txUrl && (
                    <a href={status.txUrl} target="_blank" rel="noopener"
                      style={{
                        display: 'inline-block', marginTop: 4,
                        fontSize: 11, color: 'var(--fd-cyan)',
                        fontFamily: 'var(--fd-font-mono)', textDecoration: 'none',
                      }}>
                      View transaction ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA button */}
          {allDone ? (
            <div style={{
              padding: '14px 20px', borderRadius: 12,
              background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>🚀</div>
              <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: 15 }}>
                {tokenSymbol} is live on {dexName}!
              </div>
              <div style={{ fontSize: 12, color: 'var(--fd-ghost)', marginTop: 4 }}>
                Liquidity added{isTaxed ? ' · buy/sell taxes active' : ''} · trading open
              </div>
            </div>
          ) : (
            <button
              className="btn-primary"
              style={{ width: '100%', height: 50, fontSize: 15, justifyContent: 'center' }}
              onClick={run}
              disabled={!canRun}
            >
              {running ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <Spinner />
                  Running sequence…
                </span>
              ) : hasErr ? (
                '↺  Retry from failed step'
              ) : (
                `Launch ${tokenSymbol} on ${dexName} →`
              )}
            </button>
          )}

          {/* Irreversible warning */}
          <div style={{
            marginTop: 10, fontSize: 11, color: 'var(--fd-hint)',
            textAlign: 'center', lineHeight: 1.5,
          }}>
            Adding liquidity is irreversible once LP tokens are minted.
          </div>

          {/* ── Optional: Activate Tax Collection ───────────────────────────── */}
          {isTaxed && allDone && !pairAlreadySet && (
            <div style={{
              marginTop: 16,
              padding: '16px 18px',
              borderRadius: 12,
              background: 'rgba(255,215,0,0.05)',
              border: '1px solid rgba(255,215,0,0.2)',
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--gold)', marginBottom: 6 }}>
                ⚡ Activate Tax Collection (optional)
              </div>
              <div style={{ fontSize: 12, color: 'var(--fd-ghost)', marginBottom: 12, lineHeight: 1.6 }}>
                Register the LP pair in your token contract so buy/sell taxes are collected.
                You can skip this now and call <code style={{ color: 'var(--fd-cyan)' }}>setDexPair(pair, true)</code> manually later.
              </div>

              {pairStatus.state === 'ok' ? (
                <div style={{
                  padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)',
                  fontSize: 13, fontWeight: 600, color: 'var(--green)',
                }}>
                  ✓ {pairStatus.msg}
                </div>
              ) : pairStatus.state === 'err' ? (
                <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{pairStatus.msg}</div>
              ) : pairStatus.state === 'pending' ? (
                <div style={{ fontSize: 12, color: 'var(--fd-cyan)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Spinner /> {pairStatus.msg}
                </div>
              ) : (
                <button
                  className="btn-primary"
                  style={{ width: '100%', height: 44, fontSize: 13, justifyContent: 'center',
                    background: 'rgba(255,215,0,0.12)', color: 'var(--gold)',
                    border: '1px solid rgba(255,215,0,0.35)' }}
                  disabled={pairRunning || !walletClient}
                  onClick={async () => {
                    if (!walletClient || !publicClient || !address) return
                    if (!factory || !weth) {
                      setPairStatus({ state: 'err', msg: 'Factory not configured for this chain.' })
                      return
                    }
                    setPairRunning(true)
                    setPairStatus({ state: 'pending', msg: 'Looking up LP pair address…' })
                    try {
                      const token = contractAddress as `0x${string}`
                      const acct  = address as `0x${string}`

                      let pair = lpPairAddr
                      if (!pair) {
                        await new Promise(r => setTimeout(r, 1000))
                        pair = await publicClient.readContract({
                          address: factory, abi: FACTORY_ABI, functionName: 'getPair', args: [token, weth],
                        }) as `0x${string}`
                      }

                      const ZERO = '0x0000000000000000000000000000000000000000'
                      if (!pair || pair.toLowerCase() === ZERO) {
                        setPairStatus({ state: 'err', msg: 'LP pair not found. Add liquidity first, then retry.' })
                        setPairRunning(false)
                        return
                      }

                      setLpPairAddr(pair)
                      setPairStatus({ state: 'pending', msg: `Confirm setDexPair(${pair.slice(0,10)}…) in wallet` })

                      const pairGas = await publicClient.estimateContractGas({
                        address: token, abi: FAT_TAX_ABI, functionName: 'setDexPair',
                        args: [pair, true], account: acct,
                      }).catch(() => 100_000n)

                      const pairHash = await walletClient.writeContract({
                        address: token, abi: FAT_TAX_ABI, functionName: 'setDexPair',
                        args: [pair, true],
                        account: acct, chain: walletClient.chain!,
                        gas: pairGas * 12n / 10n,
                      })
                      setPairStatus({ state: 'pending', msg: 'Confirming…', txUrl: `${explorer}/tx/${pairHash}` })
                      await publicClient.waitForTransactionReceipt({ hash: pairHash })
                      setPairAlreadySet(true)
                      setPairStatus({ state: 'ok', msg: 'Buy/sell taxes are now active ✓', txUrl: `${explorer}/tx/${pairHash}` })
                    } catch (e: any) {
                      const msg = e?.message?.includes('user rejected') ? 'Rejected in wallet' : (e?.message ?? String(e)).slice(0, 200)
                      setPairStatus({ state: 'err', msg })
                    }
                    setPairRunning(false)
                  }}
                >
                  Activate Tax Collection →
                </button>
              )}
              {pairStatus.txUrl && (
                <a href={pairStatus.txUrl} target="_blank" rel="noopener"
                  style={{ display: 'block', marginTop: 8, fontSize: 11, color: 'var(--fd-cyan)', fontFamily: 'var(--fd-font-mono)', textDecoration: 'none' }}>
                  View transaction ↗
                </a>
              )}
            </div>
          )}

          {isTaxed && pairAlreadySet && allDone && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)',
              fontSize: 12, color: 'var(--green)',
            }}>
              ✓ Buy/sell taxes are active — LP pair registered
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
