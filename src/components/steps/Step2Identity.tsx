import { useAccount, useChainId } from 'wagmi'
import { useEffect } from 'react'
import { useStore } from '../../lib/store'
import { FieldGroup, Badge } from '../ui-kit'
import { bsc, mainnet, arbitrum, bscTestnet } from 'wagmi/chains'

const CHAINS = [
  { id: bsc.id,        name: 'BNB Chain'    },
  { id: mainnet.id,    name: 'Ethereum'     },
  { id: arbitrum.id,   name: 'Arbitrum One' },
  { id: bscTestnet.id, name: 'BSC Testnet'  },
]

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

const monoInputStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: 'var(--fd-font-mono)',
  fontSize: 13,
}

export function Step2Identity() {
  const { address } = useAccount()
  const chainId = useChainId()
  const { cfg, setCfg } = useStore()

  // Pre-fill addresses from connected wallet
  useEffect(() => {
    if (address && !cfg.fundAddress) setCfg({ fundAddress: address, receiveAddress: address })
  }, [address])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="grid-2-id">

        <FieldGroup label="Token name">
          <input style={inputStyle} placeholder="e.g. Blin Token" value={cfg.name}
            onChange={e => setCfg({ name: e.target.value })} />
        </FieldGroup>

        <FieldGroup label="Symbol">
          <input style={inputStyle} placeholder="BLIN" value={cfg.symbol}
            onChange={e => setCfg({ symbol: e.target.value.toUpperCase() })} />
        </FieldGroup>

        <FieldGroup label="Decimals">
          <input style={inputStyle} type="number" min={0} max={18} value={cfg.decimals}
            onChange={e => setCfg({ decimals: +e.target.value })} />
        </FieldGroup>

        <FieldGroup label="Total supply">
          <input style={inputStyle} value={cfg.totalSupply}
            onChange={e => setCfg({ totalSupply: e.target.value })} />
        </FieldGroup>
      </div>

      <div style={{ height: 1, background: 'var(--fd-border)' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FieldGroup label="Fund address — fee receiver (EOA only, not a contract)">
          <input style={monoInputStyle} placeholder="0x..."
            value={cfg.fundAddress} onChange={e => setCfg({ fundAddress: e.target.value })} />
        </FieldGroup>
        <FieldGroup label="Receive address — gets 100% of supply at deploy">
          <input style={monoInputStyle} placeholder="0x..."
            value={cfg.receiveAddress} onChange={e => setCfg({ receiveAddress: e.target.value })} />
        </FieldGroup>
        <FieldGroup label="Reward token — LP holders earn this (leave blank for WBNB/WETH)">
          <input style={monoInputStyle} placeholder="0x... (optional — defaults to WBNB/WETH for selected chain)"
            value={cfg.rewardToken} onChange={e => setCfg({ rewardToken: e.target.value })} />
        </FieldGroup>
      </div>

      <div style={{ height: 1, background: 'var(--fd-border)' }} />

      {/* Chain selector */}
      <div>
        <div style={{
          fontSize: 11, fontFamily: 'var(--fd-font-mono)', color: 'var(--fd-ghost)',
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10,
        }}>
          Target chain — switch network in wallet to change
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CHAINS.map(c => {
            const active = chainId === c.id
            return (
              <div key={c.id} style={{
                padding: '7px 14px',
                borderRadius: 'var(--fd-radius)',
                fontSize: 13, fontWeight: 500,
                fontFamily: 'var(--fd-font-display)',
                background: active ? 'var(--fd-cyan-ghost)' : 'var(--fd-slate)',
                border: `1px solid ${active ? 'var(--fd-border-cyan)' : 'var(--fd-border)'}`,
                color: active ? 'var(--fd-cyan)' : 'var(--fd-ghost)',
                transition: 'all 150ms ease',
              }}>
                {c.name}{active ? ' ✓' : ''}
              </div>
            )
          })}
        </div>
      </div>

      {/* Live preview badge */}
      {cfg.name && cfg.symbol && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge variant="cyan">{cfg.symbol}</Badge>
          <span style={{ fontSize: 13, color: 'var(--fd-ghost)' }}>
            {cfg.name} · {cfg.decimals} decimals · {Number(cfg.totalSupply).toLocaleString()} supply
          </span>
        </div>
      )}

      <style>{`
        @media (max-width: 500px) { .grid-2-id { grid-template-columns: 1fr !important; } }
        input:focus { border-color: var(--fd-cyan) !important; }
      `}</style>
    </div>
  )
}
