import { ConnectButton } from '@rainbow-me/rainbowkit'
import Logo from '../ui-kit/Logo'

export function Step0Connect() {
  return (
    <div style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center', paddingTop: 16 }}>
      {/* Logo */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <Logo size={64} variant="full-stacked" />
      </div>

      {/* Tagline */}
      <p style={{
        fontSize: 16, color: 'var(--fd-ghost)',
        marginBottom: 32, lineHeight: 1.6,
        fontFamily: 'var(--fd-font-display)',
      }}>
        Launch your token on any EVM chain
      </p>

      {/* Connect card */}
      <div style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        borderRadius: 'var(--fd-radius-lg)',
        padding: '32px 28px',
      }}>
        <h2 style={{
          fontFamily: 'var(--fd-font-display)', fontWeight: 700,
          fontSize: 18, color: 'var(--fd-white)', marginBottom: 10,
        }}>
          Sign in with your wallet
        </h2>
        <p style={{
          fontSize: 13, color: 'var(--fd-ghost)', marginBottom: 28, lineHeight: 1.7,
        }}>
          Connect via RainbowKit — MetaMask, Coinbase, WalletConnect, and more.
          Your session and deploy history are stored locally in your browser.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <ConnectButton />
        </div>

        <div style={{
          height: 1, background: 'var(--fd-border)', margin: '0 0 16px',
        }} />

        <div style={{
          fontSize: 11, color: 'var(--fd-hint)',
          fontFamily: 'var(--fd-font-mono)', lineHeight: 1.8,
        }}>
          MetaMask · Coinbase · Rabby · WalletConnect · Brave · any EIP-1193 wallet
        </div>
      </div>
    </div>
  )
}
