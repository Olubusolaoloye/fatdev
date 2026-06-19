import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '../../lib/store'
import { EventFeed } from '../../components/migrate/EventFeed'
import { VaultControls } from '../../components/migrate/VaultControls'
import type { OracleEvent } from '../../lib/store'

export function OraclePanel() {
  const { id } = useParams<{ id: string }>()
  const { migrations, oracleEvents, vaultStats, addOracleEvent } = useStore()

  const migration = migrations.find(m => m.id === id)
  const events = id ? (oracleEvents[id] ?? []) : []
  const stats = id ? vaultStats[id] : undefined

  const [oracleInterval, setOracleInterval] = useState(30)
  const [maxGas, setMaxGas] = useState(300000)

  function handleRetry(event: OracleEvent) {
    if (!id) return
    addOracleEvent(id, {
      ...event,
      id: `${event.id}_retry_${Date.now()}`,
      status: 'pending',
      timestamp: Date.now(),
    })
  }

  return (
    <div className="migrate-page step-panel">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 2rem' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Oracle Panel
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>
            {migration?.title ?? `Migration ${id}`}
          </h1>
        </div>

        {/* Stats row */}
        <div className="grid-4" style={{ gap: 10, marginBottom: 28 }}>
          {[
            { val: events.filter(e => e.status === 'ok').length.toString(), label: 'Events OK' },
            { val: events.filter(e => e.status === 'failed').length.toString(), label: 'Failed' },
            { val: events.filter(e => e.status === 'pending').length.toString(), label: 'Pending' },
            { val: stats?.participantCount.toLocaleString() ?? '0', label: 'Participants' },
            { val: Number(stats?.totalSwapped ?? 0).toLocaleString(), label: 'Total Swapped' },
          ].map(s => (
            <div key={s.label} className="sum-tile">
              <div className="sum-val" style={{ fontSize: 18 }}>{s.val}</div>
              <div className="sum-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 2-col layout */}
        <div className="grid-2-collapse" style={{ gap: 20 }}>

          {/* Event feed */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '14px 16px',
              borderBottom: '0.5px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Oracle Event Feed</div>
              <span className="pill pill-ok" style={{ fontSize: 10 }}>
                {events.length > 0 ? 'Live' : 'Waiting'}
              </span>
            </div>
            <EventFeed events={events} onRetry={handleRetry} />
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Oracle config */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Oracle Configuration</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Poll Interval (seconds)
                  </label>
                  <input
                    className="field-input"
                    type="number"
                    min={5}
                    value={oracleInterval}
                    onChange={e => setOracleInterval(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Max Gas per Tx
                  </label>
                  <input
                    className="field-input"
                    type="number"
                    min={50000}
                    step={50000}
                    value={maxGas}
                    onChange={e => setMaxGas(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <button className="btn-primary" style={{ width: '100%' }}>
                  Save Config
                </button>
              </div>
            </div>

            {/* Vault controls */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Vault Controls</div>
              <VaultControls
                vaultAddress={migration?.vaultAddress}
                paused={migration?.status === 'paused'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
