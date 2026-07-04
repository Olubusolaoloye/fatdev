import { useAccount, useChainId } from 'wagmi'
import { useEffect, useRef } from 'react'
import { useStore } from '../../lib/store'
import type { TokenType } from '../../lib/store'
import { TOKEN_TYPE_PRESETS } from '../../lib/store'
import { FieldGroup, Badge } from '../ui-kit'
import { bsc, mainnet, arbitrum, bscTestnet } from 'wagmi/chains'

const CHAINS = [
  { id: bsc.id,        name: 'BNB Chain'    },
  { id: mainnet.id,    name: 'Ethereum'     },
  { id: arbitrum.id,   name: 'Arbitrum One' },
  { id: bscTestnet.id, name: 'BSC Testnet'  },
]

const TOKEN_TYPES: { type: TokenType; label: string; icon: string; desc: string }[] = [
  { type: 'standard',     icon: '⬡', label: 'Standard',     desc: 'Basic ERC-20/BEP-20, no taxes' },
  { type: 'tax',          icon: '◈', label: 'Tax',           desc: 'Marketing, LP & burn fees on buy/sell' },
  { type: 'deflationary', icon: '🔥', label: 'Deflationary', desc: 'Auto-burn reduces supply over time' },
  { type: 'reflection',   icon: '♻', label: 'Reflection',    desc: 'Holders auto-earn rewards each tx' },
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
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (address && !cfg.fundAddress) setCfg({ fundAddress: address, receiveAddress: address })
  }, [address])

  function handleTypeSelect(type: TokenType) {
    setCfg({ ...TOKEN_TYPE_PRESETS[type] })
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCfg({ logoUrl: reader.result as string })
    reader.readAsDataURL(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Token type selector ── */}
      <div>
        <div style={{
          fontSize: 11, fontFamily: 'var(--fd-font-mono)', color: 'var(--fd-ghost)',
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10,
        }}>
          Token type — sets default tax configuration
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }} className="grid-4-type">
          {TOKEN_TYPES.map(({ type, icon, label, desc }) => {
            const active = cfg.tokenType === type
            return (
              <button
                key={type}
                onClick={() => handleTypeSelect(type)}
                style={{
                  background: active ? 'var(--fd-cyan-ghost)' : 'var(--fd-slate)',
                  border: `1px solid ${active ? 'var(--fd-border-cyan)' : 'var(--fd-border)'}`,
                  borderRadius: 'var(--fd-radius-lg)',
                  padding: '14px 10px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 150ms ease',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                }}
              >
                <span style={{ fontSize: 22 }}>{icon}</span>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: active ? 'var(--fd-cyan)' : 'var(--fd-white)',
                  fontFamily: 'var(--fd-font-display)',
                }}>{label}</span>
                <span style={{
                  fontSize: 11, color: 'var(--fd-ghost)',
                  fontFamily: 'var(--fd-font-display)', lineHeight: 1.4,
                }}>{desc}</span>
                {active && (
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--fd-font-mono)',
                    color: 'var(--fd-cyan)', letterSpacing: '0.06em',
                  }}>SELECTED ✓</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--fd-border)' }} />

      {/* ── Basic info ── */}
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

      {/* ── Addresses ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FieldGroup label="Fund address — fee receiver (EOA only, not a contract)">
          <input style={monoInputStyle} placeholder="0x..."
            value={cfg.fundAddress} onChange={e => setCfg({ fundAddress: e.target.value })} />
        </FieldGroup>
        <FieldGroup label="Receive address — gets 100% of supply at deploy">
          <input style={monoInputStyle} placeholder="0x..."
            value={cfg.receiveAddress} onChange={e => setCfg({ receiveAddress: e.target.value })} />
        </FieldGroup>
        {cfg.tokenType === 'reflection' && (
          <FieldGroup label="Reward token — token LP holders earn (leave blank for WBNB/WETH)">
            <input style={monoInputStyle} placeholder="0x... (optional — defaults to WBNB/WETH)"
              value={cfg.rewardToken} onChange={e => setCfg({ rewardToken: e.target.value })} />
          </FieldGroup>
        )}
      </div>

      <div style={{ height: 1, background: 'var(--fd-border)' }} />

      {/* ── Token logo ── */}
      <FieldGroup label="Token logo (optional — PNG/JPG/SVG, shown in review)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {cfg.logoUrl ? (
            <img src={cfg.logoUrl} alt="logo" style={{
              width: 48, height: 48, borderRadius: 8,
              border: '1px solid var(--fd-border)', objectFit: 'cover',
            }} />
          ) : (
            <div style={{
              width: 48, height: 48, borderRadius: 8,
              border: '1px dashed var(--fd-border)',
              background: 'var(--fd-slate)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--fd-hint)', fontSize: 20,
            }}>⬡</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={() => logoInputRef.current?.click()}
              style={{
                background: 'var(--fd-slate)', border: '1px solid var(--fd-border)',
                borderRadius: 'var(--fd-radius)', padding: '7px 14px',
                color: 'var(--fd-white)', cursor: 'pointer',
                fontFamily: 'var(--fd-font-display)', fontSize: 13,
              }}
            >
              {cfg.logoUrl ? 'Change logo' : 'Upload logo'}
            </button>
            {cfg.logoUrl && (
              <button
                onClick={() => setCfg({ logoUrl: '' })}
                style={{
                  background: 'transparent', border: 'none',
                  color: 'var(--fd-hint)', cursor: 'pointer',
                  fontFamily: 'var(--fd-font-display)', fontSize: 12,
                  textAlign: 'left', padding: 0,
                }}
              >Remove</button>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleLogoUpload}
          />
        </div>
      </FieldGroup>

      {/* ── Metadata ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="grid-2-id">
        <FieldGroup label="Description (optional)">
          <input style={inputStyle} placeholder="What is this token for?"
            value={cfg.description} onChange={e => setCfg({ description: e.target.value })} />
        </FieldGroup>
        <FieldGroup label="Website (optional)">
          <input style={inputStyle} placeholder="https://yourproject.com"
            value={cfg.website} onChange={e => setCfg({ website: e.target.value })} />
        </FieldGroup>
      </div>

      <div style={{ height: 1, background: 'var(--fd-border)' }} />

      {/* ── Chain selector ── */}
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

      {/* ── Live preview ── */}
      {cfg.name && cfg.symbol && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {cfg.logoUrl && (
            <img src={cfg.logoUrl} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
          )}
          <Badge variant="cyan">{cfg.symbol}</Badge>
          <span style={{ fontSize: 13, color: 'var(--fd-ghost)' }}>
            {cfg.name} · {cfg.decimals} decimals · {Number(cfg.totalSupply).toLocaleString()} supply
          </span>
          <Badge variant={
            cfg.tokenType === 'standard' ? 'default' :
            cfg.tokenType === 'tax' ? 'cyan' :
            cfg.tokenType === 'deflationary' ? 'purple' : 'green'
          }>
            {cfg.tokenType}
          </Badge>
        </div>
      )}

      <style>{`
        @media (max-width: 500px) {
          .grid-2-id { grid-template-columns: 1fr !important; }
          .grid-4-type { grid-template-columns: 1fr 1fr !important; }
        }
        input:focus { border-color: var(--fd-cyan) !important; }
      `}</style>
    </div>
  )
}
