import { useState } from 'react'
import { StatusBox } from '../ui-kit'

interface VaultControlsProps {
  migrationId: string
  paused?: boolean
}

export function VaultControls({ migrationId: _migrationId, paused }: VaultControlsProps) {
  const [status, setStatus] = useState<{ msg: string; type: 'info' | 'ok' | 'err' } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handle(action: string) {
    setLoading(true)
    setStatus(null)
    try {
      await new Promise(r => setTimeout(r, 600))
      throw new Error(`${action}: MigrationVault contract not yet deployed.`)
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
          onClick={() => handle(paused ? 'unpause' : 'pause')}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          className="btn-ghost"
          style={{ flex: 1, minWidth: 100 }}
          disabled={loading}
          onClick={() => handle('extend window')}
        >
          ⏱ Extend
        </button>
        <button
          className="btn-ghost"
          style={{ flex: 1, minWidth: 100 }}
          disabled={loading}
          onClick={() => handle('snapshot')}
        >
          📸 Snapshot
        </button>
      </div>

      {/* Emergency stop */}
      <button
        className="btn-ghost"
        style={{
          width: '100%',
          border: '0.5px solid rgba(255,82,82,0.4)',
          color: 'var(--red)',
        }}
        disabled={loading}
        onClick={() => {
          if (window.confirm('Emergency stop will halt all migrations immediately. Are you sure?')) {
            handle('emergency stop')
          }
        }}
      >
        🛑 Emergency Stop
      </button>

      {status && <StatusBox msg={status.msg} type={status.type} />}
    </div>
  )
}
