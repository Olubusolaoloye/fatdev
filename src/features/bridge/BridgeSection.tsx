import { useMemo } from 'react'
import { LiFiWidget } from '@lifi/widget'
import type { WidgetConfig } from '@lifi/widget'
import { useAccount } from 'wagmi'
import { Link } from 'react-router-dom'
import { WagmiLiFiAdapter } from './WagmiLiFiAdapter'

export function BridgeSection() {
  const { isConnected } = useAccount()

  // General-purpose bridge — any chain to any chain, wallet inherited from wagmi
  const config: WidgetConfig = useMemo(() => ({
    integrator: 'fatdev',
    fee: Number(import.meta.env.VITE_LIFI_FEE ?? 0),
    appearance: 'dark',
    theme: {
      palette: {
        primary:   { main: '#00CFFF' },
        secondary: { main: '#00E57A' },
        background: {
          default: '#080C18',
          paper:   '#0D1526',
        },
      },
      typography: { fontFamily: "'Space Grotesk', sans-serif" },
      shape: { borderRadius: 12, borderRadiusSecondary: 8 },
    },
  }), [])

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px 56px' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(0,207,255,0.08)',
          border: '1px solid rgba(0,207,255,0.2)',
          borderRadius: 20, padding: '4px 14px',
          fontSize: 12, fontWeight: 600,
          color: 'var(--fd-cyan)', letterSpacing: '0.06em',
          marginBottom: 16,
        }}>
          ⬡ POWERED BY LI.FI
        </div>
        <h1 style={{
          fontSize: 28, fontWeight: 700,
          fontFamily: "'Space Grotesk', sans-serif",
          color: 'var(--fd-white)',
          margin: '0 0 10px', lineHeight: 1.2,
        }}>
          Cross-Chain Bridge
        </h1>
        <p style={{ fontSize: 14, color: 'var(--fd-ghost)', margin: 0, lineHeight: 1.6 }}>
          Bridge any token between any supported chain. Pick your source, destination, and amount.
        </p>

        {!isConnected && (
          <div style={{
            marginTop: 16, padding: '10px 16px', borderRadius: 10,
            background: 'rgba(255,215,0,0.07)', border: '1px solid rgba(255,215,0,0.2)',
            fontSize: 13, color: 'rgba(255,215,0,0.9)',
          }}>
            Connect your wallet above to start bridging.
          </div>
        )}
      </div>

      {/* ── LI.FI Widget — wrapped with wagmi adapter so wallet is inherited ── */}
      <WagmiLiFiAdapter>
        <LiFiWidget config={config} integrator="fatdev" />
      </WagmiLiFiAdapter>

      {/* ── Bridge to Robinhood Chain ───────────────────────────────────────── */}
      <RobinhoodBridgeCard />

      {/* Fee disclosure */}
      {Number(import.meta.env.VITE_LIFI_FEE ?? 0) > 0 && (
        <p style={{
          marginTop: 18, fontSize: 11,
          color: 'var(--fd-hint)', textAlign: 'center',
        }}>
          A {(Number(import.meta.env.VITE_LIFI_FEE) * 100).toFixed(2)}% FatDev integrator fee
          applies to bridge transactions.
        </p>
      )}
    </div>
  )
}

// ── Robinhood Chain bridge card ───────────────────────────────────────────────
function RobinhoodBridgeCard() {
  const config: WidgetConfig = useMemo(() => ({
    integrator: 'fatdev',
    toChain: 4663,
    toToken: '0x0000000000000000000000000000000000000000',
    fee: Number(import.meta.env.VITE_LIFI_FEE ?? 0),
    appearance: 'dark',
    theme: {
      palette: {
        primary:   { main: '#00CFFF' },
        secondary: { main: '#00E57A' },
        background: { default: '#080C18', paper: '#0D1526' },
      },
      typography: { fontFamily: "'Space Grotesk', sans-serif" },
      shape: { borderRadius: 12, borderRadiusSecondary: 8 },
    },
  }), [])

  return (
    <div style={{
      marginTop: 28,
      borderRadius: 14,
      border: '1px solid rgba(0,207,255,0.18)',
      background: 'rgba(13,21,38,0.7)',
      overflow: 'hidden',
    }}>
      {/* Title row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'rgba(0,207,255,0.1)',
            border: '1px solid rgba(0,207,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>🔗</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fd-white)', lineHeight: 1.2 }}>
              Bridge to Robinhood Chain
            </div>
            <div style={{ fontSize: 11, color: 'var(--fd-ghost)', marginTop: 2 }}>
              Any chain → Robinhood Chain (chain 4663) · ETH
            </div>
          </div>
        </div>

        {/* Available badge */}
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          padding: '4px 10px', borderRadius: 20,
          background: 'rgba(0,229,122,0.12)',
          border: '1px solid rgba(0,229,122,0.3)',
          color: 'var(--fd-green)',
          whiteSpace: 'nowrap',
        }}>
          AVAILABLE
        </span>
      </div>

      {/* Widget pre-targeted to Robinhood Chain */}
      <div style={{ padding: '20px' }}>
        <p style={{ fontSize: 13, color: 'var(--fd-ghost)', margin: '0 0 16px', lineHeight: 1.6 }}>
          Destination is pre-set to native ETH on Robinhood Chain — just pick your source chain and amount.
          ETH is needed on-chain to pay deployment gas.
        </p>

        <WagmiLiFiAdapter>
          <LiFiWidget config={config} integrator="fatdev" />
        </WagmiLiFiAdapter>

        <div style={{ marginTop: 14 }}>
          <Link
            to="/app"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: 'rgba(0,229,122,0.08)', border: '1px solid rgba(0,229,122,0.2)',
              fontSize: 12, fontWeight: 600, color: 'var(--fd-green)',
              textDecoration: 'none',
            }}>
            Deploy on Robinhood Chain →
          </Link>
        </div>
      </div>
    </div>
  )
}
