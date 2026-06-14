import { useState } from 'react'
import { useWalletClient, usePublicClient } from 'wagmi'
import { useNavigate, useParams } from 'react-router-dom'
import { StatusBox } from '../ui-kit'
import {
  pauseVault, unpauseVault, emergencyStopVault, extendWindowVault,
} from '../../lib/migrate/contracts'

interface VaultControlsProps {
  vaultAddress?: string | null
  paused?: boolean
}

export function VaultControls({ vaultAddress, paused }: VaultControlsProps) {
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [status, setStatus] = useState<{ msg: string; type: 'info' | 'ok' | 'err' } | null>(null)
  const [loading, setLoading] = useState(false)

  async function run(label: string, fn: () => Promise<string>) {
    if (!walletClient || !publicClient) {
      setStatus({ msg: 'Connect your wallet first', type: 'err' })
      return
    }
    if (!vaultAddress) {
      setStatus({ msg: 'No vault address — deploy a vault first', type: 'err' })
      return
    }
    setLoading(true)
    setStatus({ msg: `${label}… confirm in wallet`, type: 'info' })
    try {
      const txHash = await fn()
      setStatus({ msg: `${label} successful. Tx: ${txHash}`, type: 'ok' })
    } catch (e: unknown) {
      setStatus({ msg: e instanceof Error ? e.message : String(e), type: 'err' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className="btn-ghost"
          style={{ flex: 1, minWidth: 100 }}
          disabled={loading}
          onClick={() => run(
            paused ? 'Unpause' : 'Pause',
            () => paused
              ? unpauseVault(vaultAddress!, walletClient as any, publicClient as any)
              : pauseVault(vaultAddress!, walletClient as any, publicClient as any)
          )}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          className="btn-ghost"
          style={{ flex: 1, minWidth: 100 }}
          disabled={loading}
          onClick={() => run(
            'Extend window (+7d)',
            () => extendWindowVault(vaultAddress!, 7, walletClient as any, publicClient as any)
          )}
        >
          ⏱ +7 Days
        </button>
        <button
          className="btn-ghost"
          style={{ flex: 1, minWidth: 100 }}
          disabled={loading}
          onClick={() => navigate(`/migrate/${id}/snapshot`)}
        >
          📸 Snapshot
        </button>
      </div>

      <button
        className="btn-ghost"
        style={{ width: '100%', border: '0.5px solid rgba(255,82,82,0.4)', color: 'var(--red)' }}
        disabled={loading}
        onClick={() => {
          if (window.confirm('Emergency stop halts all migrations immediately. This cannot be undone. Continue?')) {
            run('Emergency stop', () =>
              emergencyStopVault(vaultAddress!, walletClient as any, publicClient as any)
            )
          }
        }}
      >
        🛑 Emergency Stop
      </button>

      {status && <StatusBox msg={status.msg} type={status.type} />}
    </div>
  )
}
