/**
 * BridgeSection — FatDev's own bridge UI.
 *
 * Built directly on @lifi/sdk. The LI.FI widget is gone: no iframe, no MUI
 * theme, no borrowed chrome — every element here is ours and themed from our
 * own tokens, so it follows light/dark like the rest of the app.
 */
import { useState } from 'react'
import { formatUnits } from 'viem'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import Icon from '../../components/ui-kit/Icon'
import { Spinner } from '../../components/ui-kit'
import TokenPicker from './TokenPicker'
import { useBridge, type Side } from './useBridge'
import { LIFI_FEE, type Token } from '../../lib/lifi'
import { CHAIN_EXPLORERS } from '../../lib/wagmi'

function fmt(amount: string | bigint | undefined, decimals: number): string {
  if (amount === undefined) return '0'
  const n = Number(formatUnits(BigInt(amount), decimals))
  if (n === 0) return '0'
  if (n < 0.0001) return '<0.0001'
  if (n < 1000) return Number(n.toFixed(6)).toString()
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function usd(v?: string): string | null {
  const n = Number(v)
  if (!v || !isFinite(n) || n <= 0) return null
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export function BridgeSection() {
  const b = useBridge()
  const { openConnectModal } = useConnectModal()
  const [picker, setPicker] = useState<Side | null>(null)

  const pickerSide = picker
  const pickerChain = pickerSide === 'to' ? b.toChain : b.fromChain
  const setPickerChain = (id: number) => {
    if (pickerSide === 'to') { b.setToChain(id); b.ensureTokens(id) }
    else { b.setFromChain(id); b.ensureTokens(id) }
  }
  const pickToken = (t: Token) => {
    if (pickerSide === 'to') b.setToToken(t)
    else b.setFromToken(t)
  }

  const running = b.phase === 'running'
  const chainName = (id: number) => b.chains.find(c => c.id === id)?.name ?? `Chain ${id}`
  const chainLogo = (id: number) => b.chains.find(c => c.id === id)?.logoURI

  const fromBal = b.fromToken ? b.balanceOf(b.fromChain, b.fromToken.address) : 0n
  const est = b.quote?.estimate

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px 56px' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <h1 style={{
          fontSize: 'clamp(24px, 4vw, 30px)', fontWeight: 800,
          fontFamily: 'var(--fd-font-display)',
          color: 'var(--fd-white)', margin: '0 0 8px', lineHeight: 1.2,
        }}>
          Cross-Chain Bridge
        </h1>
        <p style={{ fontSize: 14, color: 'var(--fd-ghost)', margin: 0, lineHeight: 1.6 }}>
          Move any token to any chain. Best route picked automatically across 20+ bridges.
        </p>
      </div>

      {b.chainsError && (
        <Callout tone="err" text={`Could not reach the bridge network list — ${b.chainsError}`} />
      )}

      {/* ── Swap card ───────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        borderRadius: 'var(--fd-radius-lg)',
        padding: 18,
        boxShadow: 'var(--fd-shadow)',
        position: 'relative',
      }}>

        {/* From */}
        <Panel label="From">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <TokenButton
              chainName={chainName(b.fromChain)}
              chainLogo={chainLogo(b.fromChain)}
              token={b.fromToken}
              onClick={() => setPicker('from')}
              disabled={running}
            />
            <input
              value={b.amount}
              onChange={e => {
                const v = e.target.value
                if (v === '' || /^\d*\.?\d*$/.test(v)) b.setAmount(v)
              }}
              inputMode="decimal"
              placeholder="0.0"
              disabled={running}
              aria-label="Amount to bridge"
              style={{
                flex: 1, minWidth: 0, textAlign: 'right',
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--fd-white)', fontSize: 26, fontWeight: 700,
                fontFamily: 'var(--fd-font-mono)', padding: 0,
              }}
            />
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 10, fontSize: 11.5, color: 'var(--fd-ghost)', minHeight: 18,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {b.isConnected && b.fromToken && (
                <>
                  <span style={{ fontFamily: 'var(--fd-font-mono)' }}>
                    Balance {fmt(fromBal, b.fromToken.decimals)}
                  </span>
                  {fromBal > 0n && (
                    <button onClick={b.setMax} disabled={running}
                      style={{
                        background: 'var(--fd-accent-ghost)',
                        border: '1px solid var(--fd-border-accent)',
                        borderRadius: 5, padding: '1px 7px',
                        color: 'var(--fd-accent)', fontSize: 10, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'var(--fd-font-display)',
                      }}>MAX</button>
                  )}
                  {b.balancesLoading && <Spinner />}
                </>
              )}
            </span>
            <span style={{ fontFamily: 'var(--fd-font-mono)' }}>
              {usd(est?.fromAmountUSD) ?? ''}
            </span>
          </div>
        </Panel>

        {/* Flip */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '-8px 0', position: 'relative', zIndex: 1 }}>
          <button onClick={b.swapSides} disabled={running} aria-label="Swap direction"
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--fd-surface)',
              border: '1px solid var(--fd-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: running ? 'not-allowed' : 'pointer',
              color: 'var(--fd-accent)', transition: 'transform 0.2s, border-color 0.15s',
            }}
            onMouseEnter={e => { if (!running) e.currentTarget.style.transform = 'rotate(180deg)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'rotate(0deg)' }}>
            <Icon name="refresh" size={15} />
          </button>
        </div>

        {/* To */}
        <Panel label="To">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <TokenButton
              chainName={chainName(b.toChain)}
              chainLogo={chainLogo(b.toChain)}
              token={b.toToken}
              onClick={() => setPicker('to')}
              disabled={running}
            />
            <span style={{
              flex: 1, minWidth: 0, textAlign: 'right',
              fontSize: 26, fontWeight: 700, fontFamily: 'var(--fd-font-mono)',
              color: est ? 'var(--fd-white)' : 'var(--fd-hint)',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {b.phase === 'quoting'
                ? '…'
                : est && b.toToken ? fmt(est.toAmount, b.toToken.decimals) : '0.0'}
            </span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'flex-end',
            marginTop: 10, fontSize: 11.5, color: 'var(--fd-ghost)', minHeight: 18,
            fontFamily: 'var(--fd-font-mono)',
          }}>
            {usd(est?.toAmountUSD) ?? ''}
          </div>
        </Panel>

        {/* Route detail */}
        {b.phase === 'ready' && b.quote && est && (
          <div style={{
            marginTop: 14, padding: '12px 14px',
            background: 'var(--fd-fill)',
            border: '1px solid var(--fd-border)',
            borderRadius: 'var(--fd-radius)',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <Row label="Route" value={b.quote.toolDetails?.name ?? b.quote.tool} />
            <Row label="Est. time"
              value={est.executionDuration ? `~${Math.ceil(est.executionDuration / 60)} min` : '—'} />
            <Row label="Network cost"
              value={usd(est.gasCosts?.[0]?.amountUSD) ?? '—'} />
            {LIFI_FEE > 0 && (
              <Row label="FatDev fee" value={`${(LIFI_FEE * 100).toFixed(2)}%`} />
            )}
          </div>
        )}

        {/* Errors */}
        {b.error && b.phase !== 'running' && <Callout tone="err" text={b.error} />}
        {b.insufficient && !b.error && (
          <Callout tone="warn" text={`Not enough ${b.fromToken?.symbol ?? 'balance'} on ${chainName(b.fromChain)}.`} />
        )}

        {/* Action */}
        <ActionButton
          bridge={b}
          onConnect={() => openConnectModal?.()}
        />
      </div>

      {/* ── Progress ────────────────────────────────────────────────────────── */}
      {b.route && (b.phase === 'running' || b.phase === 'done') && (
        <Progress bridge={b} />
      )}

      <p style={{
        marginTop: 20, fontSize: 11, textAlign: 'center',
        color: 'var(--fd-hint)', lineHeight: 1.6,
      }}>
        Routing by LI.FI across 20+ bridges and DEXs.
        {LIFI_FEE > 0 && ` A ${(LIFI_FEE * 100).toFixed(2)}% FatDev fee is included in the quote.`}
      </p>

      <TokenPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        chains={b.chains}
        activeChain={pickerChain}
        onChainChange={setPickerChain}
        tokens={b.tokensFor(pickerChain)}
        onPick={pickToken}
        title={pickerSide === 'to' ? 'Receive' : 'Send'}
      />
    </div>
  )
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--fd-deep)',
      border: '1px solid var(--fd-border)',
      borderRadius: 'var(--fd-radius)',
      padding: '14px 16px',
    }}>
      <div style={{
        fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'var(--fd-hint)', marginBottom: 10,
        fontFamily: 'var(--fd-font-mono)',
      }}>{label}</div>
      {children}
    </div>
  )
}

function TokenButton({ chainName, chainLogo, token, onClick, disabled }: {
  chainName: string; chainLogo?: string; token: Token | null
  onClick: () => void; disabled?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0,
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        borderRadius: 'var(--fd-radius)',
        padding: '7px 11px', cursor: disabled ? 'not-allowed' : 'pointer',
        maxWidth: '58%', textAlign: 'left',
      }}>
      <span style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
        {token?.logoURI
          ? <img src={token.logoURI} alt="" width={28} height={28} style={{ borderRadius: '50%' }} />
          : <span style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--fd-fill-strong)',
            }} />}
        {chainLogo && (
          <img src={chainLogo} alt="" width={13} height={13}
            style={{
              position: 'absolute', right: -3, bottom: -2, borderRadius: '50%',
              border: '1.5px solid var(--fd-surface)',
            }} />
        )}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block', fontSize: 14, fontWeight: 700,
          color: 'var(--fd-white)', fontFamily: 'var(--fd-font-display)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{token?.symbol ?? 'Select'}</span>
        <span style={{
          display: 'block', fontSize: 10.5, color: 'var(--fd-ghost)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{chainName}</span>
      </span>
      <Icon name="arrowRight" size={13} style={{ color: 'var(--fd-hint)', flexShrink: 0, transform: 'rotate(90deg)' }} />
    </button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'var(--fd-ghost)' }}>{label}</span>
      <span style={{ color: 'var(--fd-white)', fontWeight: 600, fontFamily: 'var(--fd-font-mono)' }}>{value}</span>
    </div>
  )
}

function Callout({ tone, text }: { tone: 'err' | 'warn'; text: string }) {
  const color = tone === 'err' ? 'var(--fd-red)' : 'var(--fd-amber)'
  return (
    <div style={{
      marginTop: 14, padding: '10px 13px', borderRadius: 'var(--fd-radius)',
      background: 'color-mix(in srgb, currentColor 8%, transparent)',
      border: '1px solid color-mix(in srgb, currentColor 28%, transparent)',
      color, fontSize: 12.5, lineHeight: 1.55,
      display: 'flex', gap: 8, alignItems: 'flex-start',
    }}>
      <Icon name="alert" size={15} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{text}</span>
    </div>
  )
}

function ActionButton({ bridge: b, onConnect }: {
  bridge: ReturnType<typeof useBridge>; onConnect: () => void
}) {
  const base: React.CSSProperties = {
    width: '100%', marginTop: 14, padding: '14px 18px',
    borderRadius: 'var(--fd-radius)', border: 'none',
    fontSize: 15, fontWeight: 700, fontFamily: 'var(--fd-font-display)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  }

  if (!b.isConnected) {
    return (
      <button onClick={onConnect}
        style={{ ...base, background: 'var(--fd-accent-bright)', color: 'var(--fd-accent-ink)', cursor: 'pointer' }}>
        <Icon name="wallet" size={17} /> Connect Wallet
      </button>
    )
  }

  if (b.phase === 'done') {
    return (
      <button onClick={b.reset}
        style={{ ...base, background: 'var(--fd-green)', color: 'var(--fd-accent-ink)', cursor: 'pointer' }}>
        <Icon name="check" size={17} /> Bridge Again
      </button>
    )
  }

  const label =
    b.phase === 'running' ? 'Bridging…'
    : b.phase === 'quoting' ? 'Finding best route…'
    : b.insufficient ? 'Insufficient balance'
    : !b.amount ? 'Enter an amount'
    : b.phase === 'ready' ? 'Bridge'
    : 'Enter an amount'

  const enabled = b.phase === 'ready' && !b.insufficient

  return (
    <button onClick={b.execute} disabled={!enabled}
      style={{
        ...base,
        background: enabled ? 'var(--fd-accent-bright)' : 'var(--fd-fill-strong)',
        color: enabled ? 'var(--fd-accent-ink)' : 'var(--fd-hint)',
        cursor: enabled ? 'pointer' : 'not-allowed',
      }}>
      {(b.phase === 'running' || b.phase === 'quoting') && <Spinner />}
      {label}
    </button>
  )
}

/** Live per-step progress, driven by executeRoute's updateRouteHook. */
function Progress({ bridge: b }: { bridge: ReturnType<typeof useBridge> }) {
  const steps = b.route?.steps ?? []
  return (
    <div style={{
      marginTop: 16, padding: 18,
      background: 'var(--fd-surface)',
      border: '1px solid var(--fd-border)',
      borderRadius: 'var(--fd-radius-lg)',
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: 'var(--fd-ghost)', marginBottom: 14,
        fontFamily: 'var(--fd-font-mono)',
      }}>
        {b.phase === 'done' ? 'Bridge complete' : 'Bridging in progress'}
      </div>

      {steps.map(step => (step.execution?.actions ?? []).map((a, i) => {
        const tone =
          a.status === 'DONE' ? 'var(--fd-green)'
          : a.status === 'FAILED' ? 'var(--fd-red)'
          : a.status === 'ACTION_REQUIRED' ? 'var(--fd-amber)'
          : 'var(--fd-accent)'
        const explorer = a.txHash && a.chainId != null ? CHAIN_EXPLORERS[a.chainId] : undefined
        return (
          <div key={`${step.id}-${a.type}-${i}`}
            style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
              background: 'color-mix(in srgb, ' + tone + ' 15%, transparent)',
              border: `1px solid ${tone}`, color: tone,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {a.status === 'DONE' ? <Icon name="check" size={11} />
                : a.status === 'FAILED' ? <Icon name="x" size={11} />
                : <Spinner />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fd-white)',
              }}>{actionLabel(a.type)}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--fd-ghost)' }}>
                {a.status === 'ACTION_REQUIRED' ? 'Confirm in your wallet' : statusLabel(a.status)}
              </span>
              {a.txHash && explorer && (
                <a href={`${explorer}/tx/${a.txHash}`} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3,
                    fontSize: 11, color: 'var(--fd-accent)', textDecoration: 'none',
                    fontFamily: 'var(--fd-font-mono)',
                  }}>
                  {a.txHash.slice(0, 10)}… <Icon name="external" size={10} />
                </a>
              )}
            </span>
          </div>
        )
      }))}

      {b.phase === 'done' && (
        <div style={{
          marginTop: 6, padding: '11px 13px', borderRadius: 'var(--fd-radius)',
          background: 'var(--fd-green-ghost)',
          border: '1px solid var(--fd-border-green)',
          color: 'var(--fd-green)', fontSize: 12.5, fontWeight: 600,
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <Icon name="check" size={15} />
          Funds have landed on {b.chains.find(c => c.id === b.toChain)?.name ?? 'the destination chain'}.
        </div>
      )}
    </div>
  )
}

function actionLabel(type: string): string {
  switch (type) {
    case 'SET_ALLOWANCE':   return 'Approve token'
    case 'SWAP':            return 'Swap'
    case 'CROSS_CHAIN':     return 'Send on source chain'
    case 'RECEIVING_CHAIN': return 'Receive on destination chain'
    default:                return type.replace(/_/g, ' ').toLowerCase()
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'DONE':    return 'Confirmed'
    case 'PENDING': return 'Waiting for confirmation…'
    case 'FAILED':  return 'Failed'
    default:        return 'Preparing…'
  }
}
