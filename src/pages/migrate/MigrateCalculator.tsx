import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ParticipationSlider } from '../../components/migrate/ParticipationSlider'
import { calcVaultNeeded } from '../../lib/migrate/utils'

const SCENARIOS = [
  { label: 'Conservative', pct: 25, desc: 'Most holders inactive — safe minimum vault.' },
  { label: 'Realistic', pct: 60, desc: 'Average community participation.' },
  { label: 'Optimistic', pct: 85, desc: 'High engagement — large vault needed.' },
]

export function MigrateCalculator() {
  const navigate = useNavigate()
  const [supply, setSupply] = useState(1_000_000_000)
  const [ratio, setRatio] = useState(1)
  const [participation, setParticipation] = useState(60)

  return (
    <div className="migrate-page step-panel">
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span className="pill pill-gold" style={{ marginBottom: 12, display: 'inline-block' }}>Vault Calculator</span>
          <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>How Much V2 Do You Need?</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Adjust the sliders to estimate the vault size for your migration.
          </p>
        </div>

        {/* Token params row */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: 'var(--text-secondary)' }}>Token Parameters</div>
          <div className="grid-2" style={{ gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                V1 Total Supply
              </label>
              <input
                className="field-input"
                type="number"
                value={supply}
                onChange={e => setSupply(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                V2 per V1 Ratio
              </label>
              <input
                className="field-input"
                type="number"
                step="0.01"
                min="0.01"
                value={ratio}
                onChange={e => setRatio(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Participation slider */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: 'var(--text-secondary)' }}>
            Expected Participation
          </div>
          <ParticipationSlider
            totalV1Supply={supply}
            ratio={ratio}
            participation={participation}
            onChange={setParticipation}
          />
        </div>

        {/* Scenario cards */}
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)' }}>
          Quick Scenarios
        </div>
        <div className="grid-3" style={{ gap: 12, marginBottom: 24 }}>
          {SCENARIOS.map(sc => {
            const needed = calcVaultNeeded(supply, ratio, sc.pct)
            const isActive = participation === sc.pct
            return (
              <div
                key={sc.label}
                className="tier-card"
                style={{ cursor: 'pointer', borderColor: isActive ? 'var(--fd-cyan)' : undefined }}
                onClick={() => setParticipation(sc.pct)}
              >
                {isActive && <div className="tier-badge">{sc.pct}%</div>}
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{sc.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{sc.desc}</div>
                <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, color: 'var(--fd-cyan)', fontWeight: 700 }}>
                  {needed.toLocaleString()} V2
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>tokens needed in vault</div>
              </div>
            )
          })}
        </div>

        {/* Key takeaway */}
        <div style={{
          background: 'rgba(255,215,0,0.05)', border: '0.5px solid var(--border-strong)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 28,
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <span style={{ fontSize: 18 }}>💡</span>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: '#fff' }}>Recommendation:</strong> Fund your vault with{' '}
            <strong style={{ color: 'var(--fd-cyan)' }}>
              {calcVaultNeeded(supply, ratio, Math.min(participation + 10, 99)).toLocaleString()} V2 tokens
            </strong>{' '}
            ({Math.min(participation + 10, 99)}% scenario) to account for last-minute migrations.
            Unclaimed tokens can be retrieved after the migration window closes.
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <button
            className="btn-primary"
            style={{ padding: '12px 36px', fontSize: 15 }}
            onClick={() => navigate('/migrate/create')}
          >
            Create Migration →
          </button>
        </div>
      </div>
    </div>
  )
}
