import { useAccount, useChainId } from 'wagmi'
import { useEffect } from 'react'
import { useStore } from '../../lib/store'
import { FieldGroup } from '../ui-kit'
import { bsc, mainnet, arbitrum, bscTestnet } from 'wagmi/chains'

const CHAINS = [
  { id: bsc.id,        name: 'BNB Chain'    },
  { id: mainnet.id,    name: 'Ethereum'     },
  { id: arbitrum.id,   name: 'Arbitrum One' },
  { id: bscTestnet.id, name: 'BSC Testnet'  },
]

export function Step2Identity() {
  const { address } = useAccount()
  const chainId = useChainId()
  const { cfg, setCfg } = useStore()

  // Pre-fill addresses from connected wallet
  useEffect(() => {
    if (address && !cfg.fundAddress) setCfg({ fundAddress: address, receiveAddress: address })
  }, [address])

  return (
    <div className="step-panel">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <FieldGroup label="Token name">
          <input className="field-input" placeholder="e.g. Blin Token" value={cfg.name}
            onChange={e => setCfg({ name: e.target.value })} />
        </FieldGroup>
        <FieldGroup label="Symbol">
          <input className="field-input" placeholder="BLIN" value={cfg.symbol}
            onChange={e => setCfg({ symbol: e.target.value.toUpperCase() })} />
        </FieldGroup>
        <FieldGroup label="Decimals">
          <input className="field-input" type="number" min={0} max={18} value={cfg.decimals}
            onChange={e => setCfg({ decimals: +e.target.value })} />
        </FieldGroup>
        <FieldGroup label="Total supply">
          <input className="field-input" value={cfg.totalSupply}
            onChange={e => setCfg({ totalSupply: e.target.value })} />
        </FieldGroup>
      </div>

      <div className="divider" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <FieldGroup label="Fund address — fee receiver (EOA only, not a contract)">
          <input className="field-input" style={{ fontFamily: "'Space Mono',monospace" }} placeholder="0x..."
            value={cfg.fundAddress} onChange={e => setCfg({ fundAddress: e.target.value })} />
        </FieldGroup>
        <FieldGroup label="Receive address — gets 100% of supply at deploy">
          <input className="field-input" style={{ fontFamily: "'Space Mono',monospace" }} placeholder="0x..."
            value={cfg.receiveAddress} onChange={e => setCfg({ receiveAddress: e.target.value })} />
        </FieldGroup>
        <FieldGroup label="Reward token — LP holders earn this (leave blank for WBNB/WETH)">
          <input className="field-input" style={{ fontFamily: "'Space Mono',monospace" }} placeholder="0x... (optional — defaults to WBNB/WETH for selected chain)"
            value={cfg.rewardToken} onChange={e => setCfg({ rewardToken: e.target.value })} />
        </FieldGroup>
      </div>

      <div className="divider" />

      <div>
        <div className="field-label" style={{ marginBottom: 8 }}>Target chain — switch network in your wallet to change</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CHAINS.map(c => (
            <div key={c.id} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: chainId === c.id ? 'rgba(255,215,0,0.1)' : 'transparent',
              border: `0.5px solid ${chainId === c.id ? 'var(--gold)' : 'var(--border-strong)'}`,
              color: chainId === c.id ? 'var(--gold)' : 'var(--text-muted)' }}>
              {c.name}{chainId === c.id ? ' ← connected' : ''}
            </div>
          ))}
        </div>
      </div>

      {cfg.name && cfg.symbol && (
        <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="pill pill-gold">{cfg.symbol}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {cfg.name} · {cfg.decimals} decimals · {Number(cfg.totalSupply).toLocaleString()} supply
          </span>
        </div>
      )}
    </div>
  )
}
