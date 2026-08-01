import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { parseUnits, formatUnits } from 'viem'
import { useStore } from '../../lib/store'
import { CountdownTimer } from '../../components/migrate/CountdownTimer'
import { SwapBox } from '../../components/migrate/SwapBox'
import { StatusBox, Spinner } from '../../components/ui-kit'
import {
  swapV1, readVaultStats, readTokenMeta, readTokenBalance,
  type LiveVaultStats, type TokenMeta,
} from '../../lib/migrate/contracts'

export function HolderSwap() {
  const { id } = useParams<{ id: string }>()
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { migrations } = useStore()

  const migration = migrations.find(m => m.id === id)

  const [loading, setLoading] = useState(false)
  const [swapStatus, setSwapStatus] = useState<{ msg: string; type: 'info' | 'ok' | 'err' } | null>(null)

  // Live on-chain state
  const [live,       setLive]       = useState<LiveVaultStats | null>(null)
  const [v1Meta,     setV1Meta]     = useState<TokenMeta | null>(null)
  const [v2Meta,     setV2Meta]     = useState<TokenMeta | null>(null)
  const [v1Balance,  setV1Balance]  = useState<bigint | null>(null)
  const [loadingLive, setLoadingLive] = useState(false)

  const refresh = useCallback(async () => {
    if (!publicClient || !migration?.vaultAddress) return
    setLoadingLive(true)
    try {
      const [stats, m1, m2] = await Promise.all([
        readVaultStats(migration.vaultAddress, publicClient as any),
        readTokenMeta(migration.v1Token, publicClient as any),
        readTokenMeta(migration.v2Token, publicClient as any),
      ])
      setLive(stats); setV1Meta(m1); setV2Meta(m2)
      if (address) {
        setV1Balance(await readTokenBalance(migration.v1Token, address, publicClient as any))
      }
    } catch {
      // vault or tokens unreadable on this chain — leave nulls, UI falls back
    }
    setLoadingLive(false)
  }, [publicClient, migration?.vaultAddress, migration?.v1Token, migration?.v2Token, address])

  useEffect(() => { refresh() }, [refresh])

  async function handleSwap(v1Amount: string) {
    if (!walletClient || !publicClient) {
      setSwapStatus({ msg: 'Wallet not connected', type: 'err' })
      return
    }
    if (!migration?.vaultAddress) {
      setSwapStatus({ msg: 'Vault not yet deployed', type: 'err' })
      return
    }
    if (!v1Meta) {
      setSwapStatus({ msg: 'Token data still loading — try again in a moment', type: 'err' })
      return
    }
    setLoading(true)
    setSwapStatus(null)
    try {
      const txHash = await swapV1(
        {
          vaultAddress: migration.vaultAddress,
          v1TokenAddress: migration.v1Token,
          v1Amount: parseUnits(v1Amount, v1Meta.decimals),
        },
        walletClient as any,
        publicClient as any,
        msg => setSwapStatus({ msg, type: 'info' })
      )
      setSwapStatus({ msg: `Swap successful! Tx: ${txHash}`, type: 'ok' })
      refresh()
    } catch (e: unknown) {
      setSwapStatus({ msg: e instanceof Error ? e.message : String(e), type: 'err' })
    } finally {
      setLoading(false)
    }
  }

  if (!migration && migrations.length > 0) {
    return (
      <div className="migrate-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Migration not found</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>ID: {id}</div>
        </div>
      </div>
    )
  }

  const m = migration ?? {
    title: 'Token Migration',
    v1Token: '0x000…V1',
    v2Token: '0x000…V2',
    ratio: 1,
    status: 'active' as const,
    description: '',
  }

  const v1Sym = v1Meta?.symbol ?? 'V1'
  const v2Sym = v2Meta?.symbol ?? 'V2'

  // Real window from chain when available
  const windowEnd = live ? Number(live.windowEnd) * 1000 : 0
  const windowClosed = live ? !live.isWindowOpen : false
  const vaultPaused  = live?.paused || live?.stopped

  // Vault capacity from live data
  const vaultBalanceFmt = live && v2Meta
    ? Number(formatUnits(live.vaultBalance, v2Meta.decimals))
    : null
  const totalDepositedFmt = live && v2Meta
    ? Number(formatUnits(live.totalDeposited, v2Meta.decimals))
    : null
  const capacityPct = vaultBalanceFmt !== null && totalDepositedFmt !== null && totalDepositedFmt > 0
    ? Math.min(100, Math.round((vaultBalanceFmt / totalDepositedFmt) * 100))
    : 0

  const v1BalanceFmt = v1Balance !== null && v1Meta
    ? Number(formatUnits(v1Balance, v1Meta.decimals))
    : null

  return (
    <div className="migrate-page step-panel">
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '3rem 2rem' }}>

        {/* Token logo + title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--fd-cyan), #B8960A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 12px',
            boxShadow: '0 0 30px rgba(255,215,0,0.3)',
          }}>
            🪙
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{m.title}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Swap your {v1Sym} tokens for {v2Sym}
          </p>
        </div>

        {/* Countdown — real on-chain window */}
        <div className="card" style={{ marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Migration Window
          </div>
          {live ? (
            <CountdownTimer targetMs={windowEnd} />
          ) : loadingLive ? (
            <Spinner />
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Connect to a supported network to load window data
            </div>
          )}
        </div>

        {/* Paused / stopped notice */}
        {vaultPaused && (
          <div style={{
            marginBottom: 20, padding: '14px 16px', borderRadius: 8,
            background: 'rgba(255,215,0,0.08)', border: '0.5px solid rgba(255,215,0,0.3)',
            fontSize: 13, color: 'var(--fd-cyan)', textAlign: 'center', lineHeight: 1.6,
          }}>
            ⏸ This migration is currently {live?.stopped ? 'stopped' : 'paused'} by the project team.
          </div>
        )}

        {/* Missed window notice */}
        {windowClosed && !vaultPaused && (
          <div style={{
            marginBottom: 20, padding: '14px 16px', borderRadius: 8,
            background: 'rgba(255,82,82,0.08)', border: '0.5px solid rgba(255,82,82,0.3)',
            fontSize: 13, color: 'var(--red)', textAlign: 'center', lineHeight: 1.6,
          }}>
            ⏰ The migration window has closed. Contact the project team about post-window options.
          </div>
        )}

        {/* Swap box */}
        <div className="card" style={{ marginBottom: 20 }}>
          {isConnected ? (
            <>
              {v1BalanceFmt !== null && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, textAlign: 'right' }}>
                  Your balance: <strong style={{ color: '#fff' }}>{v1BalanceFmt.toLocaleString(undefined, { maximumFractionDigits: 4 })} {v1Sym}</strong>
                </div>
              )}
              <SwapBox
                ratio={m.ratio}
                v1Symbol={v1Sym}
                v2Symbol={v2Sym}
                disabled={windowClosed || vaultPaused}
                onSwap={handleSwap}
                loading={loading}
              />
              {swapStatus && <div style={{ marginTop: 12 }}><StatusBox msg={swapStatus.msg} type={swapStatus.type} /></div>}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                Connect your wallet to swap
              </p>
              <ConnectButton />
            </div>
          )}
        </div>

        {/* Vault capacity — live */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
            <span style={{ color: 'var(--text-muted)' }}>Vault Capacity Remaining</span>
            <span style={{ color: capacityPct > 20 ? 'var(--green)' : 'var(--red)' }}>
              {live ? `${capacityPct}%` : '—'}
            </span>
          </div>
          <div className="vault-bar">
            <div className="vault-bar-fill" style={{ width: `${capacityPct}%`, background: capacityPct > 20 ? 'var(--green)' : 'var(--red)' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            {vaultBalanceFmt !== null
              ? `${vaultBalanceFmt.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${v2Sym} available`
              : 'Loading vault balance…'}
          </div>
        </div>

        {/* Stats row — live */}
        <div className="grid-3" style={{ gap: 10 }}>
          <div className="sum-tile">
            <div className="sum-val" style={{ fontSize: 16 }}>{m.ratio}×</div>
            <div className="sum-label">Rate</div>
          </div>
          <div className="sum-tile">
            <div className="sum-val" style={{ fontSize: 16 }}>
              {live ? Number(live.participantCount).toLocaleString() : '—'}
            </div>
            <div className="sum-label">Swapped</div>
          </div>
          <div className="sum-tile">
            <div className="sum-val" style={{
              fontSize: 16,
              color: vaultPaused ? 'var(--fd-cyan)' : windowClosed ? 'var(--red)' : 'var(--green)',
            }}>
              {vaultPaused ? 'Paused' : windowClosed ? 'Closed' : 'Live'}
            </div>
            <div className="sum-label">Status</div>
          </div>
        </div>
      </div>
    </div>
  )
}
