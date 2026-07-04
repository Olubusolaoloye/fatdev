import { useStore } from '../../lib/store'
import { FeeInput, TaxBar, Pill, StatusBox, FieldGroup, Toggle } from '../ui-kit'

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

  // Dynamic label: reward slot is "Reflect" for reflection type, "Reward" otherwise
  const rewardLabel = cfg.tokenType === 'reflection' ? 'Reflect' : 'Reward'
  // Dynamic label: fund slot described as "Marketing" for tax type
  const fundLabel = cfg.tokenType === 'standard' ? 'Fund' : 'Marketing'

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--fd-font-display)', fontWeight: 600, fontSize: 15, color: 'var(--fd-white)' }}>
            {side === 'buy' ? '▲ Buy' : '▼ Sell'} taxes
          </span>
          <Pill ok={ok} label={fmt(total)} />
        </div>

        <TaxBar val={total} />
        <div style={{
          fontFamily: 'var(--fd-font-mono)', fontSize: 11,
          color: 'var(--fd-cyan)', marginTop: 6, marginBottom: 14,
          letterSpacing: '0.04em',
        }}>
          {total} bps
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {side === 'buy' ? (<>
            <FeeInput label={fundLabel}    value={cfg.buyFund}   onChange={v => setCfg({ buyFund: v })} />
            <FeeInput label="LP"           value={cfg.buyLP}     onChange={v => setCfg({ buyLP: v })} />
            <FeeInput label={rewardLabel}  value={cfg.buyReward} onChange={v => setCfg({ buyReward: v })} />
            <FeeInput label="Burn"         value={cfg.buyBurn}   onChange={v => setCfg({ buyBurn: v })} />
          </>) : (<>
            <FeeInput label={fundLabel}    value={cfg.sellFund}   onChange={v => setCfg({ sellFund: v })} />
            <FeeInput label="LP"           value={cfg.sellLP}     onChange={v => setCfg({ sellLP: v })} />
            <FeeInput label={rewardLabel}  value={cfg.sellReward} onChange={v => setCfg({ sellReward: v })} />
            <FeeInput label="Burn"         value={cfg.sellBurn}   onChange={v => setCfg({ sellBurn: v })} />
          </>)}
        </div>

        <div style={{ height: 1, background: 'var(--fd-border)', margin: '14px 0 10px' }} />
        <div style={{ fontSize: 11, fontFamily: 'var(--fd-font-mono)', color: 'var(--fd-ghost)', letterSpacing: '0.04em' }}>
          Total: <span style={{ color: ok ? 'var(--fd-green)' : '#FF6B6B' }}>{total} bps ({fmt(total)})</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Type badge hint */}
      <div style={{
        padding: '10px 14px',
        background: 'var(--fd-slate)',
        borderRadius: 'var(--fd-radius)',
        border: '1px solid var(--fd-border)',
        fontSize: 12, color: 'var(--fd-ghost)',
        fontFamily: 'var(--fd-font-display)',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <span>Token type:</span>
        <span style={{
          padding: '2px 8px', borderRadius: 4,
          background: 'var(--fd-cyan-ghost)', color: 'var(--fd-cyan)',
          fontFamily: 'var(--fd-font-mono)', fontSize: 11, letterSpacing: '0.06em',
        }}>
          {cfg.tokenType.toUpperCase()}
        </span>
        <span style={{ color: 'var(--fd-hint)' }}>
          {cfg.tokenType === 'standard'     && '— No taxes. Pure transfer token.'}
          {cfg.tokenType === 'tax'          && '— Marketing + LP fees on buy/sell.'}
          {cfg.tokenType === 'deflationary' && '— Burn on every tx, supply shrinks over time.'}
          {cfg.tokenType === 'reflection'   && '— Holders earn rewards automatically each tx.'}
        </span>
      </div>

      {/* Buy / Sell cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="grid-2-tax">
        <TaxCard side="buy" /><TaxCard side="sell" />
      </div>

      {/* Transfer fee toggle */}
      <div style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        borderRadius: 'var(--fd-radius-lg)',
        padding: '16px 20px',
      }}>
        <Toggle
          on={cfg.enableTransferFee}
          onChange={v => setCfg({ enableTransferFee: v })}
          name="Transfer fee"
          desc="Apply buy/sell tax rates to wallet-to-wallet transfers (not just DEX swaps). Recommended for deflationary & reflection tokens."
        />
      </div>

      {/* Limits */}
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

      {/* Tax cap note per type */}
      {cfg.tokenType === 'standard' && (buyTotal > 0 || sellTotal > 0) && (
        <StatusBox msg="Standard tokens typically have 0% tax. Consider resetting fees to match token type." type="info" />
      )}
      {(cfg.tokenType === 'deflationary' || cfg.tokenType === 'reflection') && (buyTotal > 1000 || sellTotal > 1000) && (
        <StatusBox msg="Deflationary & reflection tokens work best under 10% total tax (1000 bps) to avoid trader friction." type="info" />
      )}
      {(!buyOk || !sellOk) && (
        <StatusBox msg="Tax total exceeds 2500 bps (25%). Contract will revert on deploy." type="err" />
      )}

      <style>{`
        @media (max-width: 540px) { .grid-2-tax { grid-template-columns: 1fr !important; } }
        input:focus { border-color: var(--fd-cyan) !important; }
      `}</style>
    </div>
  )
}
