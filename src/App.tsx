import { useEffect, useMemo, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useStore } from './lib/store'
import { fetchUserFromSupabase } from './lib/db'
import Navbar from './components/Navbar'
import { Btn } from './components/ui-kit'
import { Step0Connect } from './components/steps/Step0Connect'
import { Step1Plan }    from './components/steps/Step1Plan'
import { Step2Identity } from './components/steps/Step2Identity'
import { Step3Taxes }   from './components/steps/Step3Taxes'
import { Step4Features } from './components/steps/Step4Features'
import { Step5Review }  from './components/steps/Step5Review'
import { Step6Deploy }  from './components/steps/Step6Deploy'
import { Step7Dashboard } from './components/steps/Step7Dashboard'
import { AdminDashboard } from './components/admin/AdminDashboard'
import './index.css'

const STEPS = ['Connect', 'Plan', 'Identity', 'Taxes', 'Features', 'Review', 'Deploy', 'Dashboard']

const STEP_TITLES = [
  'Connect Wallet',
  'Choose Your Plan',
  'Token Identity',
  'Tax Configuration',
  'Features & Anti-Bot',
  'Review & Export',
  'Deploy On-Chain',
  'My Deploys',
]

const STEP_SUBTITLES = [
  'Link your wallet to get started',
  'Select a deployment tier',
  'Name, symbol, supply and addresses',
  'Buy and sell tax percentages',
  'Anti-bot, swap limits and wallet caps',
  'Confirm all parameters before deploying',
  'Send the contract to the blockchain',
  'View and manage your deployed tokens',
]

const taxTotal = (cfg: any, side: 'buy' | 'sell') =>
  side === 'buy'
    ? cfg.buyFund + cfg.buyLP + cfg.buyReward + cfg.buyBurn
    : cfg.sellFund + cfg.sellLP + cfg.sellReward + cfg.sellBurn

// ── Horizontal step progress indicator ───────────────────────────────────────
function StepProgress({ step, onBack }: { step: number; onBack: (i: number) => void }) {
  return (
    <>
      {/* Desktop stepper */}
      <div className="stepper-desktop">
        {STEPS.map((label, i) => {
          const done    = i < step
          const current = i === step
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
              {/* Circle + label */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => done && onBack(i)}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600, fontFamily: 'var(--fd-font-mono)',
                    cursor: done ? 'pointer' : 'default',
                    border: current ? '2px solid var(--fd-cyan)' : 'none',
                    background: done ? 'var(--fd-cyan)' : current ? 'transparent' : 'var(--fd-slate)',
                    color: done ? 'var(--fd-void)' : current ? 'var(--fd-cyan)' : 'var(--fd-ghost)',
                    transition: 'all 200ms ease',
                    outline: 'none',
                  }}
                  aria-label={label}>
                  {done ? '✓' : i + 1}
                </button>
                <span style={{
                  fontSize: 10, fontFamily: 'var(--fd-font-mono)', whiteSpace: 'nowrap',
                  color: current ? 'var(--fd-white)' : 'var(--fd-ghost)',
                  letterSpacing: '0.04em',
                }}>{label}</span>
              </div>
              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div style={{
                  flex: 1, height: 1, margin: '0 4px', marginBottom: 22,
                  background: done ? 'var(--fd-cyan)' : 'var(--fd-border)',
                  transition: 'background 250ms ease',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile: compact "Step N of 8" */}
      <div className="stepper-mobile">
        <span style={{ fontFamily: 'var(--fd-font-mono)', fontSize: 11, color: 'var(--fd-ghost)', letterSpacing: '0.06em' }}>
          STEP {step + 1} OF {STEPS.length}
        </span>
        <span style={{ fontFamily: 'var(--fd-font-display)', fontSize: 14, fontWeight: 600, color: 'var(--fd-white)' }}>
          {STEPS[step]}
        </span>
        {/* Mini progress bar */}
        <div style={{ width: '100%', height: 3, background: 'var(--fd-slate)', borderRadius: 2, marginTop: 8 }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${((step + 1) / STEPS.length) * 100}%`,
            background: 'var(--fd-cyan)',
            transition: 'width 250ms ease',
          }} />
        </div>
      </div>

      <style>{`
        .stepper-desktop { display: flex; align-items: flex-start; width: 100%; margin-bottom: 40px; }
        .stepper-mobile  { display: none; flex-direction: column; align-items: flex-start; gap: 4px; margin-bottom: 28px; width: 100%; }
        @media (max-width: 600px) {
          .stepper-desktop { display: none !important; }
          .stepper-mobile  { display: flex !important; }
        }
      `}</style>
    </>
  )
}

// ── Step heading ──────────────────────────────────────────────────────────────
function StepHeading({ step }: { step: number }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{
        fontFamily: 'var(--fd-font-display)', fontWeight: 700, fontSize: 24,
        color: 'var(--fd-white)', margin: 0, lineHeight: 1.2,
      }}>{STEP_TITLES[step]}</h1>
      <p style={{
        fontSize: 14, color: 'var(--fd-ghost)', marginTop: 6, marginBottom: 0,
      }}>{STEP_SUBTITLES[step]}</p>
    </div>
  )
}

export default function App() {
  // ── ALL HOOKS MUST BE CALLED UNCONDITIONALLY (Rules of Hooks) ────────────────
  const isAdmin  = useMemo(() => new URLSearchParams(window.location.search).get('admin') === '1', [])
  const { address, isConnected } = useAccount()
  const { step, setStep, cfg, getUserData, mergeUserData } = useStore()

  const syncedWallets = useRef<Set<string>>(new Set())

  // Auto-advance past connect step when wallet connects
  useEffect(() => {
    if (isConnected && step === 0) setStep(1)
  }, [isConnected])

  // Fall back to step 0 if disconnected
  useEffect(() => {
    if (!isConnected && step > 0) setStep(0)
  }, [isConnected])

  // Sync Supabase → Zustand on wallet connect (picks up admin tier/credit changes)
  useEffect(() => {
    if (!isConnected || !address) return
    const key = address.toLowerCase()
    if (syncedWallets.current.has(key)) return
    syncedWallets.current.add(key)
    fetchUserFromSupabase(key).then(remote => {
      if (remote) mergeUserData(key, remote)
    })
  }, [isConnected, address])

  // ── Conditional renders (after ALL hooks) ────────────────────────────────────
  if (isAdmin) return <AdminDashboard />

  const user = address ? getUserData(address) : null

  const buyOk  = taxTotal(cfg, 'buy')  < 2500
  const sellOk = taxTotal(cfg, 'sell') < 2500

  const canNext =
    step === 1 ? (user?.tier !== 'free' && (user?.deploysLimit ?? 0) > 0)
    : step === 2 ? (cfg.name.length > 0 && cfg.symbol.length > 0 && cfg.fundAddress.length > 10 && cfg.receiveAddress.length > 10)
    : step === 3 ? (buyOk && sellOk)
    : true

  // Steps with no bottom nav (terminal or self-advancing)
  const hideNav = step === 0 || step >= 6

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fd-void)', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* ── Content area ── */}
      <main style={{
        flex: 1,
        maxWidth: 680, margin: '0 auto', width: '100%',
        padding: '80px 24px 96px',   /* 96px bottom = clears fixed nav bar */
        boxSizing: 'border-box',
      }}>
        <StepProgress step={step} onBack={i => setStep(i)} />
        <StepHeading step={step} />

        {/* Step panels */}
        {step === 0 && <Step0Connect />}
        {step === 1 && <Step1Plan onNext={() => setStep(2)} />}
        {step === 2 && <Step2Identity />}
        {step === 3 && <Step3Taxes />}
        {step === 4 && <Step4Features />}
        {step === 5 && <Step5Review />}
        {step === 6 && <Step6Deploy onSuccess={() => setStep(7)} />}
        {step === 7 && <Step7Dashboard />}
      </main>

      {/* ── Fixed bottom nav bar ── */}
      {!hideNav && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--fd-surface)',
          borderTop: '1px solid var(--fd-border)',
          padding: '14px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          zIndex: 40,
        }}>
          <Btn variant="ghost" onClick={() => setStep(step - 1)}>← Back</Btn>
          {step < 6 && (
            <Btn variant="primary" onClick={() => setStep(step + 1)} disabled={!canNext}>
              {step === 5 ? 'Deploy →' : 'Continue →'}
            </Btn>
          )}
        </div>
      )}
    </div>
  )
}
