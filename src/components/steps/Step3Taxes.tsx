import { useStore } from '../../lib/store'
import { FeeInput, TaxBar, Pill, StatusBox, FieldGroup } from '../ui-kit'

const taxTotal = (cfg: any, side: 'buy' | 'sell') =>
  side === 'buy' ? cfg.buyFund + cfg.buyLP + cfg.buyReward + cfg.buyBurn
                 : cfg.sellFund + cfg.sellLP + cfg.sellReward + cfg.sellBurn

export function Step3Taxes() {
  const { cfg, setCfg } = useStore()
  const buyTotal = taxTotal(cfg, 'buy')
  const sellTotal = taxTotal(cfg, 'sell')
  const buyOk = buyTotal < 2500
  const sellOk = sellTotal < 2500
  const fmt = (n: number) => `${(n / 100).toFixed(2)}%`

  const TaxCard = ({ side }: { side: 'buy' | 'sell' }) => {
    const total = taxTotal(cfg, side)
    const ok = total < 2500
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{side === 'buy' ? '🟢 Buy' : '🔴 Sell'} taxes</span>
          <Pill ok={ok} label={fmt(total)} />
        </div>
        <TaxBar val={total} />
        <div style={{ height: 12 }} />
        <div className="grid-2" style={{ gap: 10 }}>
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
        <div className="divider" />
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total: {total} bps ({fmt(total)})</div>
      </div>
    )
  }

  return (
    <div className="step-panel">
      <div className="grid-2" style={{ gap: 20 }}>
        <TaxCard side="buy" /><TaxCard side="sell" />
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <FieldGroup label="Max buy amount (tokens)">
          <input className="field-input" type="number" value={cfg.maxBuyAmount}
            onChange={e => setCfg({ maxBuyAmount: e.target.value })} />
        </FieldGroup>
        <FieldGroup label="Max wallet amount (tokens)">
          <input className="field-input" type="number" value={cfg.maxWalletAmount}
            onChange={e => setCfg({ maxWalletAmount: e.target.value })} />
        </FieldGroup>
      </div>
      {(!buyOk || !sellOk) && (
        <StatusBox msg="Tax total exceeds 2500 bps (25%). Contract will revert on deploy." type="err" />
      )}
    </div>
  )
}
