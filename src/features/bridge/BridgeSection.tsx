import { useMemo } from 'react'
import { LiFiWidget } from '@lifi/widget'
import type { WidgetConfig } from '@lifi/widget'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { WagmiLiFiAdapter } from './WagmiLiFiAdapter'


const BASE_THEME = {
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
} as const

export function BridgeSection() {
  const { openConnectModal } = useConnectModal()

  const config: WidgetConfig = useMemo(() => ({
    integrator: 'fatdev',
    fee: Number(import.meta.env.VITE_LIFI_FEE ?? 0),
    appearance: 'dark',
    theme: BASE_THEME,
    walletConfig: {
      onConnect() { openConnectModal?.() },
    },
  }), [openConnectModal])

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
          Bridge any token between any supported chain. Connect your wallet using the button in the widget.
        </p>
      </div>

      {/* ── LI.FI Widget — wallet via RainbowKit ───────────────────────────── */}
      <WagmiLiFiAdapter>
        <LiFiWidget config={config} integrator="fatdev" />
      </WagmiLiFiAdapter>

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

