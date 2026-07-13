import { useMemo } from 'react'
import { LiFiWidget } from '@lifi/widget'
import type { WidgetConfig } from '@lifi/widget'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { Link } from 'react-router-dom'

export function BridgeSection() {
  const { openConnectModal } = useConnectModal()
  const { isConnected } = useAccount()

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
        background: {
          default: '#080C18',
          paper:   '#0D1526',
        },
      },
      typography: { fontFamily: "'Space Grotesk', sans-serif" },
      shape: { borderRadius: 12, borderRadiusSecondary: 8 },
    },
    walletConfig: {
      // Reuse the app's existing RainbowKit connection — no second connect prompt
      onConnect() {
        if (!isConnected && openConnectModal) {
          openConnectModal()
        }
      },
    },
  }), [isConnected, openConnectModal])

  return (
    <div style={{
      maxWidth: 520,
      margin: '0 auto',
      padding: '0 16px 48px',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
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
          margin: '0 0 10px',
          lineHeight: 1.2,
        }}>
          Bridge to Robinhood Chain
        </h1>
        <p style={{
          fontSize: 14, color: 'var(--fd-ghost)',
          margin: 0, lineHeight: 1.6,
        }}>
          Move ETH from any chain to Robinhood Chain to pay for token deployment gas.
          Destination is pre-set — just pick your source chain and amount.
        </p>

        {!isConnected && (
          <div style={{
            marginTop: 16,
            padding: '10px 16px',
            borderRadius: 10,
            background: 'rgba(255,215,0,0.07)',
            border: '1px solid rgba(255,215,0,0.2)',
            fontSize: 13, color: 'rgba(255,215,0,0.9)',
          }}>
            Connect your wallet above to start bridging.
          </div>
        )}
      </div>

      {/* Widget */}
      <LiFiWidget config={config} integrator="fatdev" />

      {/* Deploy hint */}
      <div style={{
        marginTop: 24,
        padding: '14px 18px',
        borderRadius: 12,
        background: 'rgba(0,229,122,0.06)',
        border: '1px solid rgba(0,229,122,0.18)',
        fontSize: 13,
        color: 'var(--fd-ghost)',
        lineHeight: 1.6,
      }}>
        <span style={{ color: 'var(--fd-green)', fontWeight: 600 }}>Ready to deploy?</span>{' '}
        Once ETH arrives on Robinhood Chain,{' '}
        <Link to="/app" style={{ color: 'var(--fd-cyan)', textDecoration: 'none', fontWeight: 600 }}>
          open the token deployer →
        </Link>
      </div>

      {/* Fee disclosure */}
      {Number(import.meta.env.VITE_LIFI_FEE ?? 0) > 0 && (
        <p style={{
          marginTop: 14, fontSize: 11,
          color: 'var(--fd-hint)', textAlign: 'center',
        }}>
          A {(Number(import.meta.env.VITE_LIFI_FEE) * 100).toFixed(2)}% FatDev integrator fee
          applies to bridge transactions.
        </p>
      )}
    </div>
  )
}
