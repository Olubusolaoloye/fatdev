import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWalletClient, usePublicClient } from 'wagmi'
import { useStore } from '../../lib/store'
import { deployVault } from '../../lib/migrate/contracts'
import { StatusBox, Spinner } from '../../components/ui-kit'
import type { MigrationConfig } from '../../lib/store'

const WIZARD_STEPS = ['Token Setup', 'Vault Config', 'Fund Vault', 'Deploy']

type FormData = {
  v1Token: string
  v2Token: string
  title: string
  description: string
  ratio: number
  windowDays: number
  cap: string
  oracleMode: boolean
  postWindowEnabled: boolean
  fundAmount: string
}

const DEFAULTS: FormData = {
  v1Token: '', v2Token: '', title: '', description: '',
  ratio: 1, windowDays: 30, cap: '', oracleMode: true, postWindowEnabled: false,
  fundAmount: '',
}

export function MigrateCreate() {
  const navigate = useNavigate()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { addMigration } = useStore()
  const [wStep, setWStep] = useState(0)
  const [form, setForm] = useState<FormData>(DEFAULTS)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ msg: string; type: 'info' | 'ok' | 'err' } | null>(null)

  function patch(p: Partial<FormData>) {
    setForm(f => ({ ...f, ...p }))
  }

  async function handleDeploy() {
    if (!walletClient || !publicClient) {
      setStatus({ msg: 'Connect your wallet first', type: 'err' })
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      setStatus({ msg: 'Deploying vault…', type: 'info' })
      const { contractAddress, txHash } = await deployVault(
        {
          v1Token: form.v1Token,
          v2Token: form.v2Token,
          ratioNumerator: BigInt(Math.round(form.ratio * 1000)),
          ratioDenominator: 1000n,
          windowSeconds: BigInt(form.windowDays * 86400),
          supplyCap: form.cap ? BigInt(form.cap) : 0n,
        },
        walletClient as any,
        publicClient as any,
        msg => setStatus({ msg, type: 'info' })
      )

      const id = `mig_${Date.now().toString(36)}`
      const [account] = await walletClient.getAddresses()
      const m: MigrationConfig = {
        id,
        title: form.title || 'My Migration',
        description: form.description,
        v1Token: form.v1Token,
        v2Token: form.v2Token,
        ratio: form.ratio,
        windowSeconds: form.windowDays * 86400,
        cap: form.cap,
        oracleMode: form.oracleMode,
        postWindowEnabled: form.postWindowEnabled,
        vaultAddress: contractAddress,
        status: 'active',
        createdAt: new Date().toISOString(),
        owner: account,
      }
      addMigration(m)
      setStatus({ msg: `Vault deployed at ${contractAddress} (tx: ${txHash})`, type: 'ok' })
      setTimeout(() => navigate('/migrate/dashboard'), 2000)
    } catch (e: unknown) {
      setStatus({ msg: e instanceof Error ? e.message : String(e), type: 'err' })
    } finally {
      setLoading(false)
    }
  }

  const progressPct = ((wStep + 1) / WIZARD_STEPS.length) * 100

  return (
    <div className="migrate-page step-panel">
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 2rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>Create Migration</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>
            Step {wStep + 1} of {WIZARD_STEPS.length} — {WIZARD_STEPS[wStep]}
          </p>
        </div>

        {/* Progress bar */}
        <div className="migrate-step-bar" style={{ marginBottom: 32 }}>
          <div className="migrate-step-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Step labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
          {WIZARD_STEPS.map((s, i) => (
            <div key={s} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', margin: '0 auto 6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: i <= wStep ? 'var(--gold)' : 'var(--border)',
                color: i <= wStep ? 'var(--navy)' : 'var(--text-muted)',
                transition: 'background 0.3s',
              }}>
                {i < wStep ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 10, color: i === wStep ? 'var(--gold)' : 'var(--text-muted)' }}>
                {s}
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: Token Setup */}
        {wStep === 0 && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Token Setup</div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Old Token Address (V1)</label>
              <input className="field-input" style={{ width: '100%' }} placeholder="0x…" value={form.v1Token} onChange={e => patch({ v1Token: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>New Token Address (V2)</label>
              <input className="field-input" style={{ width: '100%' }} placeholder="0x…" value={form.v2Token} onChange={e => patch({ v2Token: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Migration Title</label>
              <input className="field-input" style={{ width: '100%' }} placeholder="e.g. FatToken V1 → V2" value={form.title} onChange={e => patch({ title: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Description (optional)</label>
              <textarea
                className="field-input"
                style={{ width: '100%', height: 80, resize: 'vertical' }}
                placeholder="Tell your community about this migration…"
                value={form.description}
                onChange={e => patch({ description: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Step 2: Vault Config */}
        {wStep === 1 && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Vault Configuration</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>V2 per V1 Ratio</label>
                <input className="field-input" style={{ width: '100%' }} type="number" step="0.01" min="0.01" value={form.ratio} onChange={e => patch({ ratio: Number(e.target.value) })} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Window (days)</label>
                <input className="field-input" style={{ width: '100%' }} type="number" min="1" value={form.windowDays} onChange={e => patch({ windowDays: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>V2 Vault Cap (leave blank for no cap)</label>
              <input className="field-input" style={{ width: '100%' }} placeholder="e.g. 500000000" value={form.cap} onChange={e => patch({ cap: e.target.value })} />
            </div>

            {/* Oracle mode toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '0.5px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Oracle Mode</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Automatically disburse V2 on each swap (recommended)</div>
              </div>
              <button
                className="btn-ghost"
                style={{
                  padding: '4px 14px', fontSize: 12,
                  borderColor: form.oracleMode ? 'var(--green)' : undefined,
                  color: form.oracleMode ? 'var(--green)' : undefined,
                }}
                onClick={() => patch({ oracleMode: !form.oracleMode })}
              >
                {form.oracleMode ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Post-window toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '0.5px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Post-Window Airdrop</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Airdrop V2 to holders who missed the window</div>
              </div>
              <button
                className="btn-ghost"
                style={{
                  padding: '4px 14px', fontSize: 12,
                  borderColor: form.postWindowEnabled ? 'var(--green)' : undefined,
                  color: form.postWindowEnabled ? 'var(--green)' : undefined,
                }}
                onClick={() => patch({ postWindowEnabled: !form.postWindowEnabled })}
              >
                {form.postWindowEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Fund Vault */}
        {wStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary card */}
            <div className="card" style={{ background: 'rgba(255,215,0,0.04)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Migration Summary</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Title</span>
                  <span>{form.title || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ratio</span>
                  <span style={{ fontFamily: "'Space Mono',monospace" }}>1 V1 → {form.ratio} V2</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Window</span>
                  <span>{form.windowDays} days</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Oracle</span>
                  <span style={{ color: form.oracleMode ? 'var(--green)' : 'var(--text-muted)' }}>
                    {form.oracleMode ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Deposit V2 Tokens</div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Amount of V2 to deposit</label>
                <input
                  className="field-input"
                  style={{ width: '100%' }}
                  placeholder="e.g. 600000000"
                  value={form.fundAmount}
                  onChange={e => patch({ fundAmount: e.target.value })}
                />
              </div>
              <div style={{
                marginTop: 14, padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,215,0,0.05)', border: '0.5px solid var(--border)',
                fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
              }}>
                ⚠️ <strong style={{ color: '#fff' }}>Two transactions required:</strong> First approve V2 token spend, then deposit into the vault.
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Deploy */}
        {wStep === 3 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Ready to Deploy</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28, maxWidth: 400, margin: '0 auto 28px', lineHeight: 1.6 }}>
              This will deploy your MigrationVault contract on-chain and register it with the Migration Registry.
            </p>

            {loading && <Spinner />}
            {status && <StatusBox msg={status.msg} type={status.type} />}

            {!loading && (
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn-primary"
                  style={{ padding: '12px 28px', fontSize: 15 }}
                  onClick={handleDeploy}
                >
                  Deploy Vault →
                </button>
                <button
                  className="btn-ghost"
                  style={{ padding: '12px 28px', fontSize: 15 }}
                  onClick={() => navigate('/migrate/dashboard')}
                >
                  View Dashboard
                </button>
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button
            className="btn-ghost"
            onClick={() => wStep > 0 ? setWStep(wStep - 1) : navigate('/migrate')}
          >
            ← {wStep > 0 ? 'Back' : 'Overview'}
          </button>
          {wStep < WIZARD_STEPS.length - 1 && (
            <button className="btn-primary" onClick={() => setWStep(wStep + 1)}>
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
