import { useNavigate } from 'react-router-dom'
import { useStore } from '../../lib/store'
import { MigrationCard } from '../../components/migrate/MigrationCard'

export function MigrateDashboard() {
  const navigate = useNavigate()
  const { migrations, vaultStats } = useStore()

  const active = migrations.filter(m => m.status === 'active' || m.status === 'paused' || m.status === 'draft')
  const completed = migrations.filter(m => m.status === 'completed' || m.status === 'stopped')

  // Aggregate stats
  const totalParticipants = Object.values(vaultStats).reduce((s, v) => s + v.participantCount, 0)
  const totalSwapped = Object.values(vaultStats).reduce((s, v) => s + Number(v.totalSwapped), 0)

  return (
    <div className="migrate-page step-panel">
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '3rem 2rem' }}>

        {/* Header stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          <div className="sum-tile">
            <div className="sum-val">{active.length}</div>
            <div className="sum-label">Active Vaults</div>
          </div>
          <div className="sum-tile">
            <div className="sum-val">{totalParticipants.toLocaleString()}</div>
            <div className="sum-label">Total Participants</div>
          </div>
          <div className="sum-tile">
            <div className="sum-val">{totalSwapped > 0 ? `${Math.round(totalSwapped / 1e6)}M` : '0'}</div>
            <div className="sum-label">Tokens Swapped</div>
          </div>
          <div className="sum-tile">
            <div className="sum-val" style={{ color: active.length > 0 ? 'var(--green)' : 'var(--text-muted)' }}>
              {active.length > 0 ? 'Live' : 'Idle'}
            </div>
            <div className="sum-label">Oracle Status</div>
          </div>
        </div>

        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>My Migrations</h2>
          <button className="btn-primary" style={{ padding: '8px 20px' }} onClick={() => navigate('/migrate/create')}>
            + New Migration
          </button>
        </div>

        {/* Active migrations */}
        {active.length === 0 && completed.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No migrations yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Create your first migration to get started.
            </div>
            <button className="btn-primary" onClick={() => navigate('/migrate/create')}>
              Create Migration →
            </button>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Active
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {active.map(m => (
                    <MigrationCard key={m.id} migration={m} stats={vaultStats[m.id]} />
                  ))}
                </div>
              </div>
            )}

            {completed.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Completed
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {completed.map(m => (
                    <MigrationCard key={m.id} migration={m} stats={vaultStats[m.id]} dimmed />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
