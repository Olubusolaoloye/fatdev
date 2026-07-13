import { useMemo } from 'react'
import { LiFiWidget } from '@lifi/widget'
import type { WidgetConfig } from '@lifi/widget'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { Link } from 'react-router-dom'

export function BridgeSection() {
  const { openConnectModal } = useConnectModal()
  const { isConnected } = useAccount()

  // General-purpose bridge — any chain to any chain
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
    walletConfig: {
      onConnect() {
        if (!isConnected && openConnectModal) openConnectModal()
      },
    },
  }), [isConnected, openConnectModal])

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

      {/* ── LI.FI Widget ───────────────────────────────────────────────────── */}
      <LiFiWidget config={config} integrator="fatdev" />

      {/* ── Bridge to Robinhood Chain — coming soon ─────────────────────────── */}
      <div style={{
        marginTop: 28,
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.07)',
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
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>🔗</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fd-white)', lineHeight: 1.2 }}>
                Bridge to Robinhood Chain
              </div>
              <div style={{ fontSize: 11, color: 'var(--fd-ghost)', marginTop: 2 }}>
                ETH → Robinhood Chain (chain 4663)
              </div>
            </div>
          </div>

          {/* Not available badge */}
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            padding: '4px 10px', borderRadius: 20,
            background: 'rgba(255,82,82,0.12)',
            border: '1px solid rgba(255,82,82,0.25)',
            color: '#FF6B6B',
            whiteSpace: 'nowrap',
          }}>
            NOT AVAILABLE
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--fd-ghost)', margin: '0 0 14px', lineHeight: 1.6 }}>
            Direct bridging into Robinhood Chain is not yet supported via LI.FI routes.
            Once LI.FI adds Robinhood Chain liquidity, this will activate automatically.
          </p>

          {/* Steps */}
          {[
            { n: '1', text: 'Bridge ETH to Arbitrum using the widget above' },
            { n: '2', text: 'Use the official Robinhood Chain bridge to move ETH from Arbitrum → chain 4663' },
            { n: '3', text: 'Deploy your token on Robinhood Chain once ETH is in your wallet' },
          ].map(({ n, text }) => (
            <div key={n} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '8px 0',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(0,207,255,0.1)', border: '1px solid rgba(0,207,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: 'var(--fd-cyan)',
                marginTop: 1,
              }}>{n}</span>
              <span style={{ fontSize: 13, color: 'var(--fd-ghost)', lineHeight: 1.5 }}>{text}</span>
            </div>
          ))}

          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              href="https://bridge.robinhood.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                background: 'rgba(0,207,255,0.08)', border: '1px solid rgba(0,207,255,0.2)',
                fontSize: 12, fontWeight: 600, color: 'var(--fd-cyan)',
                textDecoration: 'none',
              }}>
              Official RH Bridge ↗
            </a>
            <Link
              to="/app"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                background: 'rgba(0,229,122,0.08)', border: '1px solid rgba(0,229,122,0.2)',
                fontSize: 12, fontWeight: 600, color: 'var(--fd-green)',
                textDecoration: 'none',
              }}>
              Deploy on RH Chain →
            </Link>
          </div>
        </div>
      </div>

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
