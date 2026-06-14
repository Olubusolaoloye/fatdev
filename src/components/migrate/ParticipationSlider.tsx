import { calcVaultNeeded } from '../../lib/migrate/utils'

interface ParticipationSliderProps {
  totalV1Supply: number
  ratio: number
  participation: number
  onChange: (pct: number) => void
}

export function ParticipationSlider({ totalV1Supply, ratio, participation, onChange }: ParticipationSliderProps) {
  const tokensToMigrate = Math.floor(totalV1Supply * (participation / 100))
  const v2VaultNeeded = calcVaultNeeded(totalV1Supply, ratio, participation)
  const unreachedHolders = Math.floor(totalV1Supply * ((100 - participation) / 100))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Slider */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Expected participation</span>
          <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--gold)', fontFamily: "'Space Mono',monospace" }}>
            {participation}%
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={99}
          value={participation}
          onChange={e => onChange(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--gold)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
          <span>1%</span>
          <span>50%</span>
          <span>99%</span>
        </div>
      </div>

      {/* Live tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="sum-tile">
          <div className="sum-val">{tokensToMigrate.toLocaleString()}</div>
          <div className="sum-label">Tokens to Migrate</div>
        </div>
        <div className="sum-tile">
          <div className="sum-val">{v2VaultNeeded.toLocaleString()}</div>
          <div className="sum-label">V2 Vault Needed</div>
        </div>
        <div className="sum-tile">
          <div className="sum-val">{unreachedHolders.toLocaleString()}</div>
          <div className="sum-label">Unreached Holders</div>
        </div>
      </div>
    </div>
  )
}
