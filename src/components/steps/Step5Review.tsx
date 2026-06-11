import { useState } from 'react'
import { useChainId } from 'wagmi'
import { useStore } from '../../lib/store'
import { Pill, CodeBlock, SumTile } from '../ui-kit'
import { generateParams } from '../../lib/contracts'

const taxTotal = (cfg: any, side: 'buy' | 'sell') =>
  side === 'buy' ? cfg.buyFund + cfg.buyLP + cfg.buyReward + cfg.buyBurn
                 : cfg.sellFund + cfg.sellLP + cfg.sellReward + cfg.sellBurn

export function Step5Review() {
  const { cfg } = useStore()
  const chainId = useChainId()
  const [copied, setCopied] = useState(false)

  const buyTotal = taxTotal(cfg, 'buy')
  const sellTotal = taxTotal(cfg, 'sell')
  const params = generateParams(cfg, chainId)
  const fmt = (n: number) => `${(n / 100).toFixed(2)}%`

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
    <div className="step-panel">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <SumTile val={cfg.name || '—'} label="Name" />
        <SumTile val={cfg.symbol || '—'} label="Symbol" />
        <SumTile val={fmt(buyTotal)} label="Buy tax" />
        <SumTile val={fmt(sellTotal)} label="Sell tax" />
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          Constructor params
        </div>
        <CodeBlock text={params} />
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={copyParams} style={{ fontSize: 12 }}>
            {copied ? '✓ Copied' : 'Copy params'}
          </button>
          <button className="btn-ghost" onClick={downloadParams} style={{ fontSize: 12 }}>
            Download .txt
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Pill ok={buyTotal < 2500}           label={`Buy ${fmt(buyTotal)}`} />
        <Pill ok={sellTotal < 2500}          label={`Sell ${fmt(sellTotal)}`} />
        <Pill ok={cfg.name.length > 0}       label="Name" />
        <Pill ok={cfg.symbol.length > 0}     label="Symbol" />
        <Pill ok={cfg.fundAddress.length > 10}   label="Fund addr" />
        <Pill ok={cfg.receiveAddress.length > 10} label="Receive addr" />
        <Pill ok={true} gold label="Reward token (auto: WBNB/WETH if blank)" />
      </div>
    </div>
  )
}
