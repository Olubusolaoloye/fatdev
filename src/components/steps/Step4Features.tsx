import { useStore } from '../../lib/store'
import { Toggle, FieldGroup, StatusBox } from '../ui-kit'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--fd-slate)',
  border: '1px solid var(--fd-border)',
  borderRadius: 'var(--fd-radius)',
  padding: '10px 14px',
  color: 'var(--fd-white)',
  fontFamily: 'var(--fd-font-mono)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 150ms ease',
}

export function Step4Features() {
  const { cfg, setCfg } = useStore()
  const isStandard = cfg.tokenType === 'standard'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Auto-swap */}
      <div style={{
        background: 'var(--fd-surface)', border: '1px solid var(--fd-border)',
        borderRadius: 'var(--fd-radius-lg)', padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ fontFamily: 'var(--fd-font-display)', fontWeight: 600, fontSize: 14, color: 'var(--fd-white)' }}>
          Auto-swap
        </div>
        <Toggle
          on={cfg.autoSwap}
          onChange={v => setCfg({ autoSwap: v })}
          name="Auto-swap tax to ETH"
          desc="Collected tax tokens are automatically swapped to ETH and distributed to wallets. Disable to accumulate tokens in the contract instead."
        />
        {cfg.autoSwap && (
          <FieldGroup label="Swap threshold (tokens)">
            <input style={inputStyle} type="number" value={cfg.swapThreshold}
              onChange={e => setCfg({ swapThreshold: e.target.value })}
              placeholder="500000" />
            <div style={{ fontSize: 11, color: 'var(--fd-ghost)', fontFamily: 'var(--fd-font-display)', marginTop: 4 }}>
              Auto-swap triggers when contract holds this many tax tokens
            </div>
          </FieldGroup>
        )}
      </div>

      {/* Limits */}
      <div style={{
        background: 'var(--fd-surface)', border: '1px solid var(--fd-border)',
        borderRadius: 'var(--fd-radius-lg)', padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ fontFamily: 'var(--fd-font-display)', fontWeight: 600, fontSize: 14, color: 'var(--fd-white)' }}>
          Transfer limits
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="grid-2-feat">
          <FieldGroup label="Max buy per tx (tokens)">
            <input style={inputStyle} type="number" value={cfg.maxBuyAmount}
              onChange={e => setCfg({ maxBuyAmount: e.target.value })} />
            <div style={{ fontSize: 11, color: 'var(--fd-ghost)', fontFamily: 'var(--fd-font-display)', marginTop: 4 }}>
              0 = unlimited
            </div>
          </FieldGroup>
          <FieldGroup label="Max wallet (tokens)">
            <input style={inputStyle} type="number" value={cfg.maxWalletAmount}
              onChange={e => setCfg({ maxWalletAmount: e.target.value })} />
            <div style={{ fontSize: 11, color: 'var(--fd-ghost)', fontFamily: 'var(--fd-font-display)', marginTop: 4 }}>
              0 = unlimited
            </div>
          </FieldGroup>
        </div>
      </div>

      {isStandard && (
        <StatusBox
          msg="Standard tokens have no fees — auto-swap and limits are only relevant for tax/deflationary/reflection types."
          type="info"
        />
      )}

      <style>{`
        @media (max-width: 540px) { .grid-2-feat { grid-template-columns: 1fr !important; } }
        input:focus { border-color: var(--fd-cyan) !important; }
      `}</style>
    </div>
  )
}
