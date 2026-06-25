import { useStore } from '../../lib/store'
import { FeeInput, TaxBar, Pill, StatusBox, FieldGroup } from '../ui-kit'

const taxTotal = (cfg: any, side: 'buy' | 'sell') =>
  side === 'buy' ? cfg.buyFund + cfg.buyLP + cfg.buyReward + cfg.buyBurn
                 : cfg.sellFund + cfg.sellLP + cfg.sellReward + cfg.sellBurn

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--fd-slate)',
  border: '1px solid var(--fd-border)',
  borderRadius: 'var(--fd-radius)',
  padding: '10px 14px',
  color: 'var(--fd-white)',
  fontFamily: 'var(--fd-font-display)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 150ms ease',
}

export function Step3Taxes() {
  const { cfg, setCfg } = useStore()
  const buyTotal  = taxTotal(cfg, 'buy')
  const sellTotal = taxTotal(cfg, 'sell')
  const buyOk     = buyTotal < 2500
  const sellOk    = sellTotal < 2500
  const fmt = (n: number) => `${(n / 100).toFixed(2)}%`

  const TaxCard = ({ side }: { side: 'buy' | 'sell' }) => {
    const total = taxTotal(cfg, side)
    const ok = total < 2500
    return (
      <div style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        borderRadius: 'var(--fd-radius-lg)',
        padding: '20px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{
            fontFamily: 'var(--fd-font-display)', fontWeight: 600, fontSize: 15,
            color: 'var(--fd-white)',
          }}>
            {side === 'buy' ? '▲ Buy' : '▼ Sell'} taxes
          </span>
          <Pill ok={ok} label={fmt(total)} />
        </div>

        {/* Bar + bps readout */}
        <TaxBar val={total} />
        <div style={{
          fontFamily: 'var(--fd-font-mono)', fontSize: 11,
          color: 'var(--fd-cyan)', marginTop: 6, marginBottom: 14,
          letterSpacing: '0.04em',
        }}>
          {total} bps
        </div>

        {/* Fee inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {side === 'buy' ? (<>
            <FeeInput label="Fund"   value={cfg.buyFund}   onChange={v => setCfg({ buyFund: v })} />
            <FeeInput label="LP"     value={cfg.buyLP}     onChange={v => setCfg({ buyLP: v })} />
            <FeeInput label="Reward" value={cfg.buyReward} onChange={v => setCfg({ buyReward: v })} />
            <FeeInput label="Burn"   value={cfg.buyBurn}   onChange={v => setCfg({ buyBurn: v })} />
          </>) : (<>
            <FeeInput label="Fund"   value={cfg.sellFund}   onChange={v => setCfg({ sellFund: v })} />
            <FeeInput label="LP"     value={cfg.sellLP}     onChange={v => setCfg({ sellLP: v })} />
            <FeeInput label="Reward" value={cfg.sellReward} onChange={v => setCfg({ sellReward: v })} />
            <FeeInput label="Burn"   value={cfg.sellBurn}   onChange={v => setCfg({ sellBurn: v })} />
          </>)}
        </div>

        {/* Total footer */}
        <div style={{
          height: 1, background: 'var(--fd-border)', margin: '14px 0 10px',
        }} />
        <div style={{
          fontSize: 11, fontFamily: 'var(--fd-font-mono)',
          color: 'var(--fd-ghost)', letterSpacing: '0.04em',
        }}>
          Total: <span style={{ color: ok ? 'var(--fd-green)' : '#FF6B6B' }}>{total} bps ({fmt(total)})</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="grid-2-tax">
        <TaxCard side="buy" /><TaxCard side="sell" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="grid-2-tax">
        <FieldGroup label="Max buy amount (tokens)">
          <input style={inputStyle} type="number" value={cfg.maxBuyAmount}
            onChange={e => setCfg({ maxBuyAmount: e.target.value })} />
        </FieldGroup>
        <FieldGroup label="Max wallet amount (tokens)">
          <input style={inputStyle} type="number" value={cfg.maxWalletAmount}
            onChange={e => setCfg({ maxWalletAmount: e.target.value })} />
        </FieldGroup>
      </div>

      {(!buyOk || !sellOk) && (
        <StatusBox msg="Tax total exceeds 2500 bps (25%). Contract will revert on deploy." type="err" />
      )}

      <style>{`
        @media (max-width: 540px) {
          .grid-2-tax { grid-template-columns: 1fr !important; }
        }
        input:focus { border-color: var(--fd-cyan) !important; }
      `}</style>
    </div>
  )
}
