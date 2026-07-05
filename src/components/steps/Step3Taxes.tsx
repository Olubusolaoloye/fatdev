import { useStore } from '../../lib/store'
import { TaxBar, Pill, StatusBox, FieldGroup, Toggle } from '../ui-kit'

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

const bps2pct = (n: number) => `${(n / 100).toFixed(2)}%`

function PctSlider({ label, value, onChange, color }: {
  label: string; value: number; onChange: (v: number) => void; color: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--fd-ghost)', fontFamily: 'var(--fd-font-display)' }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: 'var(--fd-font-mono)', color }}>{value}%</span>
      </div>
      <input
        type="range" min={0} max={100} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ accentColor: color, width: '100%', cursor: 'pointer' }}
      />
    </div>
  )
}

export function Step3Taxes() {
  const { cfg, setCfg } = useStore()
  const isStandard = cfg.tokenType === 'standard'
  const total = cfg.mktPct + cfg.lpPct + cfg.teamPct + cfg.buybackPct + cfg.burnPct
  const distOk = isStandard || total === 100
  const buyOk  = cfg.buyTax < 2500
  const sellOk = cfg.sellTax < 2500
  const xferOk = cfg.transferTax < 2500
  const burnLabel = cfg.tokenType === 'reflection' ? 'Reflection' : 'Burn'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Type badge */}
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

      {isStandard ? (
        <StatusBox msg="Standard tokens have no taxes. Distribution settings are disabled." type="info" />
      ) : (<>

        {/* Tax behavior toggles */}
        <div style={{
          background: 'var(--fd-surface)', border: '1px solid var(--fd-border)',
          borderRadius: 'var(--fd-radius-lg)', padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontFamily: 'var(--fd-font-display)', fontWeight: 600, fontSize: 14, color: 'var(--fd-white)', marginBottom: 4 }}>
            Tax behavior
          </div>
          <Toggle
            on={cfg.taxOnBuy}
            onChange={v => setCfg({ taxOnBuy: v })}
            name="Tax on buy"
            desc="Collect tax when traders buy via DEX."
          />
          <Toggle
            on={cfg.taxOnSell}
            onChange={v => setCfg({ taxOnSell: v })}
            name="Tax on sell"
            desc="Collect tax when traders sell via DEX."
          />
          <Toggle
            on={cfg.taxOnTransfer}
            onChange={v => setCfg({ taxOnTransfer: v })}
            name="Tax on transfer"
            desc="Collect tax on wallet-to-wallet transfers (not just DEX swaps)."
          />
        </div>

        {/* Tax rates */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14,
        }} className="grid-3-tax">
          {cfg.taxOnBuy && (
            <FieldGroup label={`Buy tax (bps) — ${bps2pct(cfg.buyTax)}`}>
              <input style={inputStyle} type="number" min={0} max={2499} value={cfg.buyTax}
                onChange={e => setCfg({ buyTax: Math.min(2499, Number(e.target.value)) })} />
              <div style={{ marginTop: 6 }}><TaxBar val={cfg.buyTax} /></div>
            </FieldGroup>
          )}
          {cfg.taxOnSell && (
            <FieldGroup label={`Sell tax (bps) — ${bps2pct(cfg.sellTax)}`}>
              <input style={inputStyle} type="number" min={0} max={2499} value={cfg.sellTax}
                onChange={e => setCfg({ sellTax: Math.min(2499, Number(e.target.value)) })} />
              <div style={{ marginTop: 6 }}><TaxBar val={cfg.sellTax} /></div>
            </FieldGroup>
          )}
          {cfg.taxOnTransfer && (
            <FieldGroup label={`Transfer tax (bps) — ${bps2pct(cfg.transferTax)}`}>
              <input style={inputStyle} type="number" min={0} max={2499} value={cfg.transferTax}
                onChange={e => setCfg({ transferTax: Math.min(2499, Number(e.target.value)) })} />
              <div style={{ marginTop: 6 }}><TaxBar val={cfg.transferTax} /></div>
            </FieldGroup>
          )}
        </div>

        {/* Distribution */}
        <div style={{
          background: 'var(--fd-surface)', border: '1px solid var(--fd-border)',
          borderRadius: 'var(--fd-radius-lg)', padding: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontFamily: 'var(--fd-font-display)', fontWeight: 600, fontSize: 14, color: 'var(--fd-white)' }}>
              Tax distribution
            </span>
            <Pill ok={distOk} label={`${total}% / 100%`} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <PctSlider label="Marketing (→ ETH to marketing wallet)" value={cfg.mktPct}
              onChange={v => setCfg({ mktPct: v })} color="var(--fd-gold)" />
            <PctSlider label="Liquidity (→ auto-added to DEX)" value={cfg.lpPct}
              onChange={v => setCfg({ lpPct: v })} color="var(--fd-cyan)" />
            <PctSlider label="Team (→ ETH to team wallet)" value={cfg.teamPct}
              onChange={v => setCfg({ teamPct: v })} color="#a78bfa" />
            <PctSlider label="Buyback (→ ETH to buyback wallet)" value={cfg.buybackPct}
              onChange={v => setCfg({ buybackPct: v })} color="#fb923c" />
            <PctSlider
              label={`${burnLabel} (→ ${cfg.tokenType === 'reflection' ? 'reflected to holders' : 'burned as tokens'})`}
              value={cfg.burnPct}
              onChange={v => setCfg({ burnPct: v })}
              color={cfg.tokenType === 'reflection' ? '#34d399' : '#f87171'}
            />
          </div>

          {/* Distribution bar */}
          <div style={{ marginTop: 16, height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
            {[
              { val: cfg.mktPct,     color: 'var(--fd-gold)' },
              { val: cfg.lpPct,      color: 'var(--fd-cyan)' },
              { val: cfg.teamPct,    color: '#a78bfa' },
              { val: cfg.buybackPct, color: '#fb923c' },
              { val: cfg.burnPct,    color: cfg.tokenType === 'reflection' ? '#34d399' : '#f87171' },
            ].map((s, i) => s.val > 0 && (
              <div key={i} style={{ width: `${s.val}%`, background: s.color, transition: 'width 200ms ease' }} />
            ))}
            {total < 100 && (
              <div style={{ flex: 1, background: 'var(--fd-border)' }} />
            )}
          </div>

          {!distOk && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#f87171', fontFamily: 'var(--fd-font-mono)' }}>
              Distribution must total exactly 100% (currently {total}%)
            </div>
          )}
        </div>

      </>)}

      {/* Validation messages */}
      {(!buyOk || !sellOk || !xferOk) && (
        <StatusBox msg="Tax rate exceeds 2500 bps (25%). Contract will revert on deploy." type="err" />
      )}
      {(cfg.tokenType === 'deflationary' || cfg.tokenType === 'reflection') &&
        ((cfg.buyTax > 1000 && cfg.taxOnBuy) || (cfg.sellTax > 1000 && cfg.taxOnSell)) && (
        <StatusBox msg="Deflationary & reflection tokens work best under 10% total tax to avoid trader friction." type="info" />
      )}

      <style>{`
        @media (max-width: 600px) { .grid-3-tax { grid-template-columns: 1fr !important; } }
        input[type=number]:focus { border-color: var(--fd-cyan) !important; }
        input[type=range] { -webkit-appearance: none; height: 4px; border-radius: 2px; background: var(--fd-border); }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; }
      `}</style>
    </div>
  )
}
