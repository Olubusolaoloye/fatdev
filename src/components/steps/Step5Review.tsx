import { useState } from 'react'
import { useChainId } from 'wagmi'
import { useStore } from '../../lib/store'
import { Pill, CodeBlock, SumTile, Btn } from '../ui-kit'
import { generateParams } from '../../lib/contracts'

export function Step5Review() {
  const { cfg } = useStore()
  const chainId = useChainId()
  const [copied, setCopied] = useState(false)

  const params = generateParams(cfg, chainId)
  const fmt = (n: number) => `${(n / 100).toFixed(2)}%`
  const distTotal = cfg.mktPct + cfg.lpPct + cfg.teamPct + cfg.buybackPct + cfg.burnPct

  function copyParams() {
    navigator.clipboard.writeText(params)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  function downloadParams() {
    const b = new Blob([params], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(b)
    a.download = `${cfg.symbol || 'token'}-params.txt`
    a.click()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary tiles */}
      <div style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        borderRadius: 'var(--fd-radius-lg)',
        padding: '4px 20px',
      }}>
        <SumTile val={cfg.name || '—'}          label="Name" />
        <SumTile val={cfg.symbol || '—'}         label="Symbol" />
        <SumTile val={cfg.tokenType.toUpperCase()} label="Type" />
        {cfg.taxOnBuy  && <SumTile val={fmt(cfg.buyTax)}      label="Buy tax" />}
        {cfg.taxOnSell && <SumTile val={fmt(cfg.sellTax)}     label="Sell tax" />}
      </div>

      {/* Constructor params */}
      <div style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        borderRadius: 'var(--fd-radius-lg)',
        padding: '20px',
      }}>
        <div style={{
          fontSize: 11, fontFamily: 'var(--fd-font-mono)', color: 'var(--fd-ghost)',
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12,
        }}>
          Deployment parameters
        </div>
        <CodeBlock text={params} />
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <Btn variant="secondary" onClick={copyParams} style={{ fontSize: 12, padding: '7px 16px' }}>
            {copied ? '✓ Copied' : '⎘ Copy params'}
          </Btn>
          <Btn variant="secondary" onClick={downloadParams} style={{ fontSize: 12, padding: '7px 16px' }}>
            ↓ Download .txt
          </Btn>
        </div>
      </div>

      {/* Validation pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Pill ok={cfg.name.length > 0}                           label="Name" />
        <Pill ok={cfg.symbol.length > 0}                         label="Symbol" />
        <Pill ok={cfg.fundAddress.length > 10}                   label="Marketing wallet" />
        <Pill ok={cfg.receiveAddress.length > 10}                label="Receive address" />
        {cfg.taxOnBuy  && <Pill ok={cfg.buyTax  < 2500} label={`Buy ${fmt(cfg.buyTax)}`} />}
        {cfg.taxOnSell && <Pill ok={cfg.sellTax < 2500} label={`Sell ${fmt(cfg.sellTax)}`} />}
        {cfg.taxOnTransfer && <Pill ok={cfg.transferTax < 2500} label={`Transfer ${fmt(cfg.transferTax)}`} />}
        {cfg.tokenType !== 'standard' && <Pill ok={distTotal === 100} label={`Distribution ${distTotal}%`} />}
      </div>
    </div>
  )
}
