import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useStore } from '../../lib/store'
import { CountdownTimer } from '../../components/migrate/CountdownTimer'
import { SwapBox } from '../../components/migrate/SwapBox'
import { StatusBox } from '../../components/ui-kit'
import { swapV1 } from '../../lib/migrate/contracts'

export function HolderSwap() {
  const { id } = useParams<{ id: string }>()
  const { isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { migrations, vaultStats } = useStore()

  const migration = migrations.find(m => m.id === id)
  const stats = id ? vaultStats[id] : undefined

  const [loading, setLoading] = useState(false)
  const [swapStatus, setSwapStatus] = useState<{ msg: string; type: 'info' | 'ok' | 'err' } | null>(null)

  async function handleSwap(v1Amount: string) {
    if (!walletClient || !publicClient) {
      setSwapStatus({ msg: 'Wallet not connected', type: 'err' })
      return
    }
    if (!migration?.vaultAddress) {
      setSwapStatus({ msg: 'Vault not yet deployed', type: 'err' })
      return
    }
    setLoading(true)
    setSwapStatus(null)
    try {
      const txHash = await swapV1(
        {
          vaultAddress: migration.vaultAddress,
          v1TokenAddress: migration.v1Token,
          v1Amount: BigInt(v1Amount),
        },
        walletClient as any,
        publicClient as any,
        msg => setSwapStatus({ msg, type: 'info' })
      )
      setSwapStatus({ msg: `Swap successful! Tx: ${txHash}`, type: 'ok' })
    } catch (e: unknown) {
      setSwapStatus({ msg: e instanceof Error ? e.message : String(e), type: 'err' })
    } finally {
      setLoading(false)
    }
  }

  // Vault capacity
  const deposited = Number(stats?.totalDeposited ?? 0)
  const balance = Number(stats?.vaultBalance ?? 0)
  const capacityPct = deposited > 0 ? Math.min(100, Math.round((balance / deposited) * 100)) : 0

  // Migration window
  const windowEnd = stats?.windowEnd
    ? stats.windowEnd * 1000
    : Date.now() + 30 * 24 * 60 * 60 * 1000 // default 30 days for demo

  const windowClosed = Date.now() > windowEnd

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

  return (
    <div className="migrate-page step-panel">
      <div style={{ maxWidth: 540, margin: '0 auto', padding: '3rem 2rem' }}>

        {/* Token logo + title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--gold), #B8960A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 12px',
            boxShadow: '0 0 30px rgba(255,215,0,0.3)',
          }}>
            🪙
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{m.title}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Swap your V1 tokens for V2</p>
        </div>

        {/* Countdown */}
        <div className="card" style={{ marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Migration Window
          </div>
          <CountdownTimer targetMs={windowEnd} />
        </div>

        {/* Missed window notice */}
        {windowClosed && (
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
              <SwapBox
                ratio={m.ratio}
                v1Symbol="V1"
                v2Symbol="V2"
                disabled={windowClosed}
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

        {/* Vault capacity */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
            <span style={{ color: 'var(--text-muted)' }}>Vault Capacity Remaining</span>
            <span style={{ color: capacityPct > 20 ? 'var(--green)' : 'var(--red)' }}>{capacityPct}%</span>
          </div>
          <div className="vault-bar">
            <div className="vault-bar-fill" style={{ width: `${capacityPct}%`, background: capacityPct > 20 ? 'var(--green)' : 'var(--red)' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            {Number(balance).toLocaleString()} V2 tokens available
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <div className="sum-tile">
            <div className="sum-val" style={{ fontSize: 16 }}>{m.ratio}×</div>
            <div className="sum-label">Rate</div>
          </div>
          <div className="sum-tile">
            <div className="sum-val" style={{ fontSize: 16 }}>{stats?.participantCount.toLocaleString() ?? '—'}</div>
            <div className="sum-label">Swapped</div>
          </div>
          <div className="sum-tile">
            <div className="sum-val" style={{ fontSize: 16, color: m.status === 'active' ? 'var(--green)' : 'var(--red)' }}>
              {m.status === 'active' ? 'Live' : m.status}
            </div>
            <div className="sum-label">Status</div>
          </div>
        </div>
      </div>
    </div>
  )
}
