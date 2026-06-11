import { useEffect, useMemo } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useStore } from './lib/store'
import { useAppConfig } from './hooks/useAppConfig'
import { Step0Connect } from './components/steps/Step0Connect'
import { Step1Plan }    from './components/steps/Step1Plan'
import { Step2Identity } from './components/steps/Step2Identity'
import { Step3Taxes }   from './components/steps/Step3Taxes'
import { Step4Features } from './components/steps/Step4Features'
import { Step5Review }  from './components/steps/Step5Review'
import { Step6Deploy }  from './components/steps/Step6Deploy'
import { Step7Dashboard } from './components/steps/Step7Dashboard'
import { ToolsHub }       from './components/tools/ToolsHub'
import { AdminDashboard } from './components/admin/AdminDashboard'
import './index.css'

const STEPS = ['Connect', 'Plan', 'Identity', 'Taxes', 'Features', 'Review', 'Deploy', 'Dashboard', 'Tools']

const STEP_TITLES = [
  'Connect Wallet',
  'Choose Your Plan',
  'Token Identity',
  'Tax Configuration',
  'Features & Anti-Bot',
  'Review & Export',
  'Deploy On-Chain',
  'My Deploys',
  'Tools',
]

const taxTotal = (cfg: any, side: 'buy' | 'sell') =>
  side === 'buy'
    ? cfg.buyFund + cfg.buyLP + cfg.buyReward + cfg.buyBurn
    : cfg.sellFund + cfg.sellLP + cfg.sellReward + cfg.sellBurn

export default function App() {
  const isAdmin = useMemo(() => new URLSearchParams(window.location.search).get('admin') === '1', [])
  if (isAdmin) return <AdminDashboard />

  const { maintenanceMode, maintenanceMessage, loading: configLoading } = useAppConfig()

  // Maintenance mode — admins can bypass with ?bypass=fatadmin
  const isBypass = useMemo(() => new URLSearchParams(window.location.search).get('bypass') === 'fatadmin', [])
  if (!configLoading && maintenanceMode && !isBypass) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--navy)', color: '#fff', flexDirection: 'column', gap: 20, padding: '2rem', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: 'var(--navy)' }}>⚙</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Under Maintenance</h1>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 460, lineHeight: 1.7, margin: 0 }}>{maintenanceMessage}</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontFamily: "'Space Mono',monospace" }}>FatDev · fatdev.io</p>
      </div>
    )
  }

  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { step, setStep, cfg, getUserData } = useStore()

  // Auto-advance past connect step when wallet connects
  useEffect(() => {
    if (isConnected && step === 0) setStep(1)
  }, [isConnected])

  // Fall back to step 0 if disconnected
  useEffect(() => {
    if (!isConnected && step > 0) setStep(0)
  }, [isConnected])

  const user = address ? getUserData(address) : null
  const deploysLeft = user
    ? (user.deploysLimit >= 999 ? '∞' : user.deploysLimit - user.deploysUsed)
    : 0

  const buyOk  = taxTotal(cfg, 'buy')  < 2500
  const sellOk = taxTotal(cfg, 'sell') < 2500

  const canNext =
    step === 1 ? (user?.tier !== 'free' && (user?.deploysLimit ?? 0) > 0)
    : step === 2 ? (cfg.name.length > 0 && cfg.symbol.length > 0 && cfg.fundAddress.length > 10 && cfg.receiveAddress.length > 10)
    : step === 3 ? (buyOk && sellOk)
    : true

  const chainName = { 56: 'BNB Chain', 1: 'Ethereum', 42161: 'Arbitrum One', 97: 'BSC Testnet' }[chainId] ?? `Chain ${chainId}`

  return (
    <div className="app">
      {/* ── Header ── */}
      <header style={{ borderBottom: '0.5px solid var(--border)', padding: '0 2rem' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--navy)', fontSize: 14, fontWeight: 800 }}>F</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 16 }}>FatDev</span>
            <span className="pill pill-gold" style={{ marginLeft: 4 }}>BETA</span>
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isConnected && (
              <span className="pill pill-gold" style={{ fontFamily: "'Space Mono',monospace", fontSize: 10 }}>
                {chainName}
              </span>
            )}
            {isConnected && user?.tier !== 'free' && (
              <span className="pill pill-ok" style={{ fontSize: 10 }}>
                {user?.tier.toUpperCase()} · {deploysLeft} left
              </span>
            )}
            {isConnected && (
              <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}
                onClick={() => setStep(7)}>
                Dashboard
              </button>
            )}
            {isConnected && (
              <button className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}
                onClick={() => setStep(8)}>
                🛠 Tools
              </button>
            )}
            <ConnectButton
              accountStatus="avatar"
              chainStatus="icon"
              showBalance={false}
            />
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, maxWidth: 920, margin: '0 auto', width: '100%', padding: '2rem' }}>
        {/* Step nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '2.5rem', justifyContent: 'center' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                className={`step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`}
                onClick={() => i < step && setStep(i)}
                title={s}
              />
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 16, height: 0.5,
                  background: i < step ? 'var(--green)' : 'var(--border)',
                  transition: 'background 0.3s'
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Step title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace", letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>
            Step {step + 1} / {STEPS.length}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>{STEP_TITLES[step]}</h1>
        </div>

        {/* Step panels */}
        {step === 0 && <Step0Connect />}
        {step === 1 && <Step1Plan onNext={() => setStep(2)} />}
        {step === 2 && <Step2Identity />}
        {step === 3 && <Step3Taxes />}
        {step === 4 && <Step4Features />}
        {step === 5 && <Step5Review />}
        {step === 6 && <Step6Deploy onSuccess={() => setStep(7)} />}
        {step === 7 && <Step7Dashboard />}
        {step === 8 && <ToolsHub />}

        {/* Nav buttons */}
        {step > 0 && step < 7 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
            <button className="btn-ghost" onClick={() => setStep(step - 1)}>← Back</button>
            {step < 6 && (
              <button className="btn-primary" onClick={() => setStep(step + 1)} disabled={!canNext}>
                {step === 5 ? 'Go to deploy →' : 'Continue →'}
              </button>
            )}
          </div>
        )}
      </main>

      <footer style={{ borderTop: '0.5px solid var(--border)', padding: '1rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace" }}>
          FatDev · No-code FatTokenV5 deployer · wagmi v3 + viem + RainbowKit · Not financial advice
        </div>
      </footer>
    </div>
  )
}
