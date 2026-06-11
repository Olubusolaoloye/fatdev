import { ConnectButton } from '@rainbow-me/rainbowkit'

export function Step0Connect() {
  return (
    <div className="step-panel" style={{ maxWidth: 480, margin: '0 auto' }}>
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🔐</div>
        <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Sign in with your wallet</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28, lineHeight: 1.7 }}>
          Connect via RainbowKit — MetaMask, Coinbase, WalletConnect, and more.
          Your session and deploy history are stored locally in your browser.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ConnectButton />
        </div>
        <div className="divider" />
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          MetaMask · Coinbase · Rabby · WalletConnect · Brave · any EIP-1193 wallet
        </div>
      </div>
    </div>
  )
}
