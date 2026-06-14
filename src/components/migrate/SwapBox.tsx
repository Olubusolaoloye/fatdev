import { useState } from 'react'

interface SwapBoxProps {
  ratio: number
  v1Symbol?: string
  v2Symbol?: string
  disabled?: boolean
  onSwap?: (v1Amount: string) => void
  loading?: boolean
}

export function SwapBox({ ratio, v1Symbol = 'V1', v2Symbol = 'V2', disabled, onSwap, loading }: SwapBoxProps) {
  const [v1, setV1] = useState('')

  const v2Out = v1 && !isNaN(Number(v1))
    ? (Number(v1) * ratio).toLocaleString(undefined, { maximumFractionDigits: 6 })
    : '0.00'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* V1 input */}
      <div className="swap-box">
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>You send</div>
          <input
            className="swap-input"
            type="number"
            min="0"
            placeholder="0.00"
            value={v1}
            onChange={e => setV1(e.target.value)}
            disabled={disabled || loading}
          />
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.07)', borderRadius: 6,
          padding: '4px 10px', fontWeight: 700, fontSize: 13,
          fontFamily: "'Space Mono',monospace",
        }}>
          {v1Symbol}
        </div>
      </div>

      {/* Arrow */}
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 18 }}>↓</div>

      {/* V2 output */}
      <div className="swap-box receive">
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>You receive</div>
          <div className="swap-input" style={{ display: 'flex', alignItems: 'center' }}>
            {v2Out}
          </div>
        </div>
        <div style={{
          background: 'rgba(0,230,118,0.1)', borderRadius: 6,
          padding: '4px 10px', fontWeight: 700, fontSize: 13,
          color: 'var(--green)', fontFamily: "'Space Mono',monospace",
          border: '0.5px solid rgba(0,230,118,0.3)',
        }}>
          {v2Symbol}
        </div>
      </div>

      {/* Rate note */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        Rate: 1 {v1Symbol} = {ratio} {v2Symbol}
      </div>

      {/* Swap button */}
      {onSwap && (
        <button
          className="btn-primary"
          style={{ marginTop: 8, width: '100%' }}
          disabled={disabled || loading || !v1 || Number(v1) <= 0}
          onClick={() => onSwap(v1)}
        >
          {loading ? 'Swapping…' : `Swap ${v1Symbol} → ${v2Symbol}`}
        </button>
      )}
    </div>
  )
}
