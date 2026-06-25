import { useNavigate } from 'react-router-dom'
import type { MigrationConfig, VaultStats } from '../../lib/store'
import { formatMigrationId } from '../../lib/migrate/utils'

interface MigrationCardProps {
  migration: MigrationConfig
  stats?: VaultStats
  dimmed?: boolean
}

const STATUS_COLOR: Record<MigrationConfig['status'], string> = {
  draft: 'var(--text-muted)',
  active: 'var(--green)',
  paused: 'var(--fd-cyan)',
  completed: 'var(--blue)',
  stopped: 'var(--red)',
}

export function MigrationCard({ migration, stats, dimmed }: MigrationCardProps) {
  const navigate = useNavigate()

  const deposited = Number(stats?.totalDeposited ?? 0)
  const balance = Number(stats?.vaultBalance ?? 0)
  const pct = deposited > 0 ? Math.min(100, Math.round(((deposited - balance) / deposited) * 100)) : 0

  return (
    <div
      className="card card-hover"
      style={{
        opacity: dimmed ? 0.55 : 1,
        cursor: 'pointer',
        transition: 'opacity 0.2s',
      }}
      onClick={() => navigate(`/migrate/${migration.id}`)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{migration.title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace", marginTop: 2 }}>
            {formatMigrationId(migration.id)}
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
          background: `${STATUS_COLOR[migration.status]}22`,
          color: STATUS_COLOR[migration.status],
          border: `0.5px solid ${STATUS_COLOR[migration.status]}66`,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {migration.status}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
          <span>Migration progress</span>
          <span style={{ color: pct > 0 ? 'var(--green)' : 'var(--text-muted)' }}>{pct}%</span>
        </div>
        <div className="vault-bar">
          <div className="vault-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
        <span>Ratio: <strong style={{ color: '#fff' }}>{migration.ratio}×</strong></span>
        {stats && (
          <>
            <span>Participants: <strong style={{ color: '#fff' }}>{stats.participantCount.toLocaleString()}</strong></span>
            <span>Swapped: <strong style={{ color: 'var(--green)' }}>{Number(stats.totalSwapped).toLocaleString()}</strong></span>
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }} onClick={e => e.stopPropagation()}>
        <button
          className="btn-ghost"
          style={{ padding: '4px 12px', fontSize: 11 }}
          onClick={() => navigate(`/migrate/${migration.id}`)}
        >
          Swap Page ↗
        </button>
        <button
          className="btn-ghost"
          style={{ padding: '4px 12px', fontSize: 11 }}
          onClick={() => navigate(`/migrate/${migration.id}/oracle`)}
        >
          Oracle
        </button>
        <button
          className="btn-ghost"
          style={{ padding: '4px 12px', fontSize: 11 }}
          onClick={() => navigate(`/migrate/${migration.id}/snapshot`)}
        >
          Snapshot
        </button>
      </div>
    </div>
  )
}
