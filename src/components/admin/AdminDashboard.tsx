import { useState, useEffect, useCallback } from 'react'
import { supabaseReady } from '../../lib/supabase'
import type { DbUser, DbDeploy, DbPayment } from '../../lib/supabase'
import {
  adminGetStats, adminGetDeploysByWallet, adminGetPaymentsByWallet,
  adminSetMaintenanceMode, adminUpdateUserTier,
  adminGetAllConfig, adminSetConfig,
} from '../../lib/admin'
import { invalidateAppConfig } from '../../hooks/useAppConfig'
import {
  FEATURE_REGISTRY, DEFAULT_FEATURE_FLAGS, normalizeFlags,
  type FeatureFlags,
} from '../../lib/tools'
import { CHAIN_EXPLORERS, CHAIN_NAME } from '../../lib/wagmi'
import { Spinner } from '../ui-kit'
import Icon, { type IconName } from '../ui-kit/Icon'
import { AdsTab } from './AdsTab'

const ADMIN_PASSWORD = 'fatadmin2025'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function shortAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}` }
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: 'var(--navy-card)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent ?? 'var(--fd-cyan)', fontFamily: "'Space Mono',monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ── Bar chart ─────────────────────────────────────────────────────────────────
function BarChart({ data }: { data: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 80, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right', flexShrink: 0 }}>{d.label}</div>
          <div style={{ flex: 1, background: 'var(--fd-fill)', borderRadius: 4, height: 22, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4, width: `${(d.value / max) * 100}%`,
              background: d.color ?? 'var(--fd-cyan)', transition: 'width 0.5s ease',
              display: 'flex', alignItems: 'center', paddingLeft: 8,
            }}>
              {d.value > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fd-void)' }}>{d.value}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Password gate ─────────────────────────────────────────────────────────────
function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw]       = useState('')
  const [wrong, setWrong] = useState(false)
  function attempt() {
    if (pw === ADMIN_PASSWORD) onUnlock()
    else { setWrong(true); setPw('') }
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--fd-void)' }}>
      <div style={{ background: 'var(--navy-card)', border: '0.5px solid var(--border-strong)', borderRadius: 16, padding: '2.5rem', width: 340, textAlign: 'center' }}>
        <img src="/logo.png" alt="FatDev" width={48} height={48}
          style={{ display: 'block', margin: '0 auto 16px', objectFit: 'contain' }} />
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Admin Access</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Enter the admin password to continue</p>
        <input type="password" className="field-input" placeholder="Password" value={pw} autoFocus
          onChange={e => { setPw(e.target.value); setWrong(false) }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          style={{ textAlign: 'center', marginBottom: 12 }} />
        {wrong && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>Incorrect password</div>}
        <button className="btn-primary" style={{ width: '100%' }} onClick={attempt}>Unlock →</button>
      </div>
    </div>
  )
}

// ── Tab type ──────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'users' | 'deploys' | 'payments' | 'features' | 'ads' | 'settings'

// ── Main export ───────────────────────────────────────────────────────────────
export function AdminDashboard() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('fat_admin') === '1')
  function unlock() { sessionStorage.setItem('fat_admin', '1'); setUnlocked(true) }
  if (!unlocked) return <PasswordGate onUnlock={unlock} />
  return <DashboardContent />
}

// ── Dashboard content ─────────────────────────────────────────────────────────
function DashboardContent() {
  const [tab, setTab] = useState<Tab>('overview')

  // ── Data state ──────────────────────────────────────────────────────────────
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState('')
  const [users,   setUsers]     = useState<DbUser[]>([])
  const [deploys, setDeploys]   = useState<DbDeploy[]>([])
  const [payments,setPayments]  = useState<DbPayment[]>([])

  const [chainCounts,  setChainCounts]  = useState<Record<number, number>>({})
  const [totalRevenue, setTotalRevenue] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      if (!supabaseReady) {
        setError('Supabase not configured. Add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_SUPABASE_SERVICE_KEY to your .env file.')
        return
      }
      const stats = await adminGetStats()
      setUsers(stats.users)
      setDeploys(stats.deploys)
      setPayments(stats.payments)
      setChainCounts(stats.chainCounts)
      setTotalRevenue(stats.totalRevenue)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load data')
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const paidUsers   = users.filter(u => u.tier !== 'free').length
  const activeUsers = users.filter(u => u.deploys_used > 0).length

  // ── Nav tabs ─────────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: IconName; count?: number }[] = [
    { id: 'overview',  label: 'Overview',  icon: 'chart'    },
    { id: 'users',     label: 'Users',     icon: 'wallet',   count: users.length    },
    { id: 'deploys',   label: 'Deploys',   icon: 'rocket',   count: deploys.length  },
    { id: 'payments',  label: 'Payments',  icon: 'coins',    count: payments.length },
    { id: 'features',  label: 'Features',  icon: 'sliders'  },
    { id: 'ads',       label: 'Ads',       icon: 'megaphone' },
    { id: 'settings',  label: 'Settings',  icon: 'settings' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fd-void)', color: 'var(--fd-white)', fontFamily: 'Syne, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '0.5px solid var(--border)', padding: '0 2rem', position: 'sticky', top: 0, background: 'var(--fd-void)', zIndex: 10 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--fd-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'var(--fd-void)', fontSize: 14, fontWeight: 800 }}>F</span>
              </div>
              <span style={{ fontWeight: 800, fontSize: 16 }}>FatDev</span>
              <span className="pill" style={{ background: 'rgba(255,82,82,0.15)', color: 'var(--red)', border: '0.5px solid rgba(255,82,82,0.3)', fontSize: 10 }}>ADMIN</span>
            </div>
            {/* Tabs in header */}
            <div style={{ display: 'flex', gap: 4 }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? 'page' : undefined}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background:  tab === t.id ? 'var(--fd-cyan-ghost)' : 'transparent',
                    border:     `0.5px solid ${tab === t.id ? 'var(--fd-cyan)' : 'transparent'}`,
                    color:       tab === t.id ? 'var(--fd-cyan)' : 'var(--text-secondary)',
                    transition: 'background 180ms ease, color 180ms ease, border-color 180ms ease',
                  }}>
                  <Icon name={t.icon} size={15} />
                  {t.label}
                  {t.count !== undefined && (
                    <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--fd-track)', padding: '1px 5px', borderRadius: 4 }}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={loadData} disabled={loading}>
              {loading ? <Spinner /> : '↻ Refresh'}
            </button>
            <button className="btn-ghost" style={{ fontSize: 12 }}
              onClick={() => { sessionStorage.removeItem('fat_admin'); location.reload() }}>Lock</button>
            <a href="/" className="btn-primary" style={{ fontSize: 12, padding: '5px 14px', textDecoration: 'none' }}>← App</a>
          </div>
        </div>
      </div>

      {/* Supabase status banner */}
      {!supabaseReady && (
        <div style={{ background: 'rgba(255,82,82,0.1)', borderBottom: '0.5px solid rgba(255,82,82,0.3)', padding: '10px 2rem', fontSize: 12, color: 'var(--red)' }}>
          <Icon name="alert" size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} /><strong>Supabase not connected.</strong> Add <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>, <code>VITE_SUPABASE_SERVICE_KEY</code> to your <code>.env</code> file and restart the dev server.
        </div>
      )}

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem' }}>
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,82,82,0.1)', border: '0.5px solid rgba(255,82,82,0.3)', color: 'var(--red)', fontSize: 13, marginBottom: 20 }}>
            ✗ {error}
          </div>
        )}

        {/* ── Overview tab ── */}
        {tab === 'overview' && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Overview</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              Live data from Supabase — all users across all devices.
            </p>

            {loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div> : (
              <>
                {/* KPIs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
                  <Stat label="Total Wallets"  value={users.length}       sub={`${paidUsers} paid`}           />
                  <Stat label="Est. Revenue"   value={fmt(totalRevenue)}   sub="confirmed payments"            accent="var(--green)" />
                  <Stat label="Total Deploys"  value={deploys.length}      sub={`across ${Object.keys(chainCounts).length} chains`} accent="var(--blue)" />
                  <Stat label="Paid Users"     value={paidUsers}           sub={`${users.length - paidUsers} free`} />
                  <Stat label="Active Users"   value={activeUsers}         sub="≥1 deploy"                    accent="var(--green)" />
                </div>

                {/* Charts */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                  <div style={{ background: 'var(--navy-card)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 20 }}>
                    <div style={{ fontWeight: 700, marginBottom: 16 }}>Users by deploys purchased</div>
                    <BarChart data={[
                      { label: '5+',   value: users.filter(u => (u.deploys_limit ?? 0) >= 5).length, color: 'var(--fd-green)' },
                      { label: '2-4',  value: users.filter(u => (u.deploys_limit ?? 0) >= 2 && (u.deploys_limit ?? 0) < 5).length, color: 'var(--fd-cyan)' },
                      { label: '1',    value: users.filter(u => (u.deploys_limit ?? 0) === 1).length, color: 'var(--blue)' },
                      { label: 'None', value: users.filter(u => !(u.deploys_limit ?? 0)).length, color: 'rgba(255,255,255,0.2)' },
                    ]} />
                  </div>
                  <div style={{ background: 'var(--navy-card)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 20 }}>
                    <div style={{ fontWeight: 700, marginBottom: 16 }}>Deploys by chain</div>
                    {Object.keys(chainCounts).length === 0
                      ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No deploys yet.</p>
                      : <BarChart data={Object.entries(chainCounts).map(([id, count]) => ({
                          label: CHAIN_NAME[Number(id)] ?? `Chain ${id}`, value: count,
                        }))} />
                    }
                  </div>
                </div>

                {/* Recent deploys summary */}
                <DeployTable deploys={deploys.slice(0, 10)} title="Recent deploys" />
              </>
            )}
          </div>
        )}

        {/* ── Users tab ── */}
        {tab === 'users' && (
          <UsersTab users={users} loading={loading} onRefresh={loadData} />
        )}

        {/* ── Deploys tab ── */}
        {tab === 'deploys' && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>All Deploys ({deploys.length})</h1>
            {loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div>
              : <DeployTable deploys={deploys} title="" showWallet />}
          </div>
        )}

        {/* ── Payments tab ── */}
        {tab === 'payments' && (
          <PaymentsTab payments={payments} loading={loading} totalRevenue={totalRevenue} />
        )}

        {/* ── Settings tab ── */}
        {tab === 'ads' && <AdsTab />}

        {tab === 'features' && (
          <FeaturesTab />
        )}

        {tab === 'settings' && (
          <SettingsTab />
        )}
      </div>
    </div>
  )
}

// ── Features tab — per-tool visibility toggles ────────────────────────────────
function FeaturesTab() {
  const [flags,   setFlags]   = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS)
  const [saved,   setSaved]   = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState('')

  useEffect(() => {
    (async () => {
      try {
        const cfg = await adminGetAllConfig()
        const next = normalizeFlags(cfg.feature_flags)
        setFlags(next); setSaved(next)
      } catch {
        // Supabase unreachable — leave defaults on screen
      }
      setLoading(false)
    })()
  }, [])

  const dirty = FEATURE_REGISTRY.some(f => flags[f.key] !== saved[f.key])

  async function save() {
    setSaving(true); setMsg('')
    try {
      await adminSetConfig('feature_flags', flags)
      invalidateAppConfig()
      setSaved(flags)
      setMsg('Saved. Changes are live — visitors see them on their next page load.')
    } catch (e: any) {
      setMsg(`Failed: ${e.message ?? 'could not save'}`)
    }
    setSaving(false)
  }

  const tools    = FEATURE_REGISTRY.filter(f => f.kind === 'tool')
  const sections = FEATURE_REGISTRY.filter(f => f.kind === 'section')

  function Row({ f }: { f: typeof FEATURE_REGISTRY[0] }) {
    const on = flags[f.key]
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        borderBottom: '0.5px solid var(--fd-fill)',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: on ? 'rgba(0,229,122,0.08)' : 'var(--fd-fill)',
          border: `0.5px solid ${on ? 'rgba(0,229,122,0.25)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: on ? 'var(--fd-green)' : 'var(--text-muted)',
          transition: 'background 180ms ease, border-color 180ms ease, color 180ms ease',
        }}><Icon name={f.icon} size={20} /></div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, opacity: on ? 1 : 0.55 }}>{f.title}</span>
            <span className="pill" style={{
              fontSize: 9, padding: '2px 8px',
              background: on ? 'rgba(0,229,122,0.12)' : 'rgba(255,82,82,0.12)',
              color:      on ? 'var(--fd-green)' : 'var(--fd-red)',
              border: `0.5px solid ${on ? 'rgba(0,229,122,0.35)' : 'rgba(255,82,82,0.35)'}`,
            }}>{on ? 'LIVE' : 'HIDDEN'}</span>
            {!on && f.comingSoon && (
              <span className="pill" style={{
                fontSize: 9, padding: '2px 8px', background: 'var(--fd-accent-ghost)',
                color: 'var(--fd-cyan)', border: '0.5px solid var(--fd-border-accent)',
              }}>COMING SOON PAGE</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{f.desc}</div>
        </div>

        <button
          onClick={() => setFlags(p => ({ ...p, [f.key]: !p[f.key] }))}
          aria-label={`Toggle ${f.title}`}
          style={{
            width: 46, height: 26, borderRadius: 13, flexShrink: 0, cursor: 'pointer',
            border: 'none', padding: 0, position: 'relative',
            background: on ? 'var(--fd-green)' : 'var(--fd-hint)',
            transition: 'background 0.2s',
          }}>
          <span style={{
            position: 'absolute', top: 3, left: on ? 23 : 3,
            width: 20, height: 20, borderRadius: 10, background: '#fff',
            transition: 'left 0.2s',
          }} />
        </button>
      </div>
    )
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Features</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Switch anything off and it disappears from the site entirely — the card, the nav link,
        and the route. Sections marked <em>coming soon</em> show a branded placeholder page
        instead of 404-ing.
      </p>

      <div style={{ background: 'var(--navy-card)', border: '0.5px solid var(--border)', borderRadius: 12, marginBottom: 16 }}>
        <div style={{
          padding: '12px 16px', borderBottom: '0.5px solid var(--border)',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace",
        }}>Tools — shown on /tools</div>
        {tools.map(f => <Row key={f.key} f={f} />)}
      </div>

      <div style={{ background: 'var(--navy-card)', border: '0.5px solid var(--border)', borderRadius: 12, marginBottom: 20 }}>
        <div style={{
          padding: '12px 16px', borderBottom: '0.5px solid var(--border)',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace",
        }}>Sections — full routes and nav links</div>
        {sections.map(f => <Row key={f.key} f={f} />)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn-primary" onClick={save} disabled={!dirty || saving}
          style={{ opacity: dirty && !saving ? 1 : 0.5 }}>
          {saving ? <Spinner /> : dirty ? 'Save changes' : 'No changes'}
        </button>
        {dirty && !saving && (
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setFlags(saved)}>
            Discard
          </button>
        )}
        {msg && (
          <span style={{ fontSize: 12, color: msg.startsWith('Failed') ? 'var(--fd-red)' : 'var(--fd-green)' }}>
            {msg}
          </span>
        )}
      </div>

      {!supabaseReady && (
        <div style={{
          marginTop: 16, padding: '10px 14px', borderRadius: 8, fontSize: 12,
          background: 'rgba(255,82,82,0.08)', border: '0.5px solid rgba(255,82,82,0.25)',
          color: 'var(--fd-red)', lineHeight: 1.6,
        }}>
          Supabase is not connected, so toggles cannot be saved. The site is currently running on
          the built-in defaults (Holder Analytics and Migrate hidden).
        </div>
      )}
    </div>
  )
}

// ── Deploy table (reused in overview + deploys tab) ───────────────────────────
function DeployTable({ deploys, title, showWallet }: { deploys: DbDeploy[]; title: string; showWallet?: boolean }) {
  if (deploys.length === 0) return <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No deploys yet.</p>
  return (
    <div style={{ background: 'var(--navy-card)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 20 }}>
      {title && <div style={{ fontWeight: 700, marginBottom: 16 }}>{title}</div>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
              {['Token', 'Contract', 'Chain', showWallet && 'Wallet', 'When', 'Verified', 'Tx'].filter(Boolean).map(h => (
                <th key={h as string} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deploys.map(d => (
              <tr key={d.id} style={{ borderBottom: '0.5px solid var(--fd-fill)' }}>
                <td style={{ padding: '9px 10px', fontWeight: 700 }}>
                  {d.token_name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{d.token_symbol}</span>
                </td>
                <td style={{ padding: '9px 10px', fontFamily: "'Space Mono',monospace" }}>
                  {d.contract_address
                    ? <a href={`${CHAIN_EXPLORERS[d.chain_id]}/address/${d.contract_address}`} target="_blank" rel="noopener"
                        style={{ color: 'var(--blue)' }}>{shortAddr(d.contract_address)}</a>
                    : '—'}
                </td>
                <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{CHAIN_NAME[d.chain_id] ?? d.chain_id}</td>
                {showWallet && (
                  <td style={{ padding: '9px 10px', fontFamily: "'Space Mono',monospace", color: 'var(--text-muted)' }}>
                    {shortAddr(d.wallet)}
                  </td>
                )}
                <td style={{ padding: '9px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{relTime(d.deployed_at)}</td>
                <td style={{ padding: '9px 10px' }}>
                  <span className={`pill ${d.verified ? 'pill-ok' : ''}`} style={!d.verified ? { color: 'var(--text-muted)' } : {}}>
                    {d.verified ? '✓' : '—'}
                  </span>
                </td>
                <td style={{ padding: '9px 10px' }}>
                  {d.tx_hash
                    ? <a href={`${CHAIN_EXPLORERS[d.chain_id]}/tx/${d.tx_hash}`} target="_blank" rel="noopener"
                        style={{ color: 'var(--blue)', fontFamily: "'Space Mono',monospace" }}>{shortAddr(d.tx_hash)}</a>
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Users tab ─────────────────────────────────────────────────────────────────
function UsersTab({ users, loading, onRefresh }: { users: DbUser[]; loading: boolean; onRefresh: () => void }) {
  const [search,        setSearch]        = useState('')
  const [tierFilter,    setTierFilter]    = useState('all')
  const [expandedWallet, setExpanded]     = useState<string | null>(null)
  const [drillDeploys,  setDrillDeploys]  = useState<DbDeploy[]>([])
  const [drillPayments, setDrillPayments] = useState<DbPayment[]>([])
  const [drillLoading,  setDrillLoading]  = useState(false)
  const [editTier,      setEditTier]      = useState<{ wallet: string; tier: string; limit: number } | null>(null)
  const [saving,        setSaving]        = useState(false)

  const filtered = users.filter(u => {
    const matchTier   = tierFilter === 'all'
      || (tierFilter === 'paid' ? (u.deploys_limit ?? 0) > 0 : !(u.deploys_limit ?? 0))
    const matchSearch = u.wallet.toLowerCase().includes(search.toLowerCase())
    return matchTier && matchSearch
  })

  async function expand(wallet: string) {
    if (expandedWallet === wallet) { setExpanded(null); return }
    setExpanded(wallet); setDrillLoading(true)
    const [d, p] = await Promise.all([
      adminGetDeploysByWallet(wallet),
      adminGetPaymentsByWallet(wallet),
    ])
    setDrillDeploys(d); setDrillPayments(p); setDrillLoading(false)
  }

  async function saveUserTier() {
    if (!editTier) return
    setSaving(true)
    try {
      await adminUpdateUserTier(editTier.wallet, editTier.tier as any, editTier.limit)
      setEditTier(null)
      onRefresh()
    } catch (e: any) { alert(e.message) }
    setSaving(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Users ({filtered.length})</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field-input" placeholder="Search wallet…" value={search}
            onChange={e => setSearch(e.target.value)} style={{ width: 220, fontSize: 12, padding: '6px 12px' }} />
          <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}
            style={{ background: 'var(--fd-void)', border: '0.5px solid var(--border)', color: 'var(--fd-white)', borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
            <option value="all">All wallets</option>
            <option value="paid">Has paid deploys</option>
            <option value="none">No deploys purchased</option>
          </select>
        </div>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div> : (
        <div style={{ background: 'var(--navy-card)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--fd-fill)' }}>
                {['Wallet', 'Deploys used', 'Purchased', 'Payment TX', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <>
                  <tr key={u.wallet}
                    style={{ borderBottom: '0.5px solid var(--border)', cursor: 'pointer',
                      background: expandedWallet === u.wallet ? 'rgba(255,215,0,0.04)' : 'transparent' }}
                    onClick={() => expand(u.wallet)}>
                    <td style={{ padding: '10px 12px', fontFamily: "'Space Mono',monospace" }}>
                      <span style={{ color: 'var(--text-secondary)', marginRight: 6 }}>{expandedWallet === u.wallet ? '▾' : '▸'}</span>
                      <span title={u.wallet}>{shortAddr(u.wallet)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{u.deploys_used}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{u.deploys_limit >= 999 ? '∞' : u.deploys_limit}</td>
                    <td style={{ padding: '10px 12px', fontFamily: "'Space Mono',monospace", fontSize: 10, color: 'var(--text-muted)' }}>
                      {u.payment_tx_hash ? shortAddr(u.payment_tx_hash) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{relTime(u.created_at)}</td>
                    <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                      <button className="btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }}
                        onClick={() => setEditTier({ wallet: u.wallet, tier: u.tier, limit: u.deploys_limit })}>
                        Edit credits
                      </button>
                    </td>
                  </tr>

                  {/* Expanded drilldown row */}
                  {expandedWallet === u.wallet && (
                    <tr key={`${u.wallet}-drill`} style={{ borderBottom: '0.5px solid var(--border)' }}>
                      <td colSpan={7} style={{ padding: '0 12px 16px', background: 'rgba(255,215,0,0.03)' }}>
                        {drillLoading ? <div style={{ padding: 20, textAlign: 'center' }}><Spinner /></div> : (
                          <div style={{ paddingTop: 14 }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace", marginBottom: 10 }}>{u.wallet}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                              {/* Deploys */}
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Deploys ({drillDeploys.length})</div>
                                {drillDeploys.length === 0
                                  ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No deploys.</p>
                                  : drillDeploys.map(d => (
                                    <div key={d.id} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--fd-fill)', marginBottom: 6, fontSize: 11 }}>
                                      <div style={{ fontWeight: 700 }}>{d.token_name} <span style={{ color: 'var(--text-muted)' }}>{d.token_symbol}</span>
                                        {d.verified && <span className="pill pill-ok" style={{ marginLeft: 6, fontSize: 9 }}>verified</span>}
                                      </div>
                                      <div style={{ color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace", fontSize: 10, marginTop: 2 }}>
                                        {CHAIN_NAME[d.chain_id] ?? d.chain_id} · {d.contract_address
                                          ? <a href={`${CHAIN_EXPLORERS[d.chain_id]}/address/${d.contract_address}`}
                                              target="_blank" rel="noopener" style={{ color: 'var(--blue)' }}>{shortAddr(d.contract_address)}</a>
                                          : 'pending'} · {relTime(d.deployed_at)}
                                      </div>
                                      {d.tx_hash && (
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace", marginTop: 2 }}>
                                          Tx: <a href={`${CHAIN_EXPLORERS[d.chain_id]}/tx/${d.tx_hash}`} target="_blank" rel="noopener"
                                            style={{ color: 'var(--blue)' }}>{shortAddr(d.tx_hash)}</a>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                              </div>
                              {/* Payments */}
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>Payment transactions ({drillPayments.length})</div>
                                {drillPayments.length === 0
                                  ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No payments recorded.</p>
                                  : drillPayments.map(p => (
                                    <div key={p.id} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--fd-fill)', marginBottom: 6, fontSize: 11 }}>
                                      <div style={{ fontWeight: 700, textTransform: 'uppercase', color: 'var(--fd-cyan)' }}>
                                        {p.tier} — {p.amount_usd ? fmt(p.amount_usd) : '—'}
                                      </div>
                                      <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                                        {p.payment_token ?? 'unknown'} · {CHAIN_NAME[p.chain_id ?? 0] ?? p.chain_id ?? 'unknown chain'} · {relTime(p.created_at)}
                                      </div>
                                      {p.tx_hash && (
                                        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                          Tx: <span title={p.tx_hash}>{shortAddr(p.tx_hash)}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit deploy credits modal */}
      {editTier && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEditTier(null)}>
          <div style={{ background: 'var(--navy-card)', border: '1px solid var(--border-strong)', borderRadius: 16, padding: '2rem', width: 360 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Edit deploy credits</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace", marginBottom: 16 }}>{editTier.wallet}</div>
            <div className="field-label" style={{ marginBottom: 6 }}>Deploys purchased (999 = unlimited)</div>
            <input type="number" className="field-input" style={{ width: '100%', marginBottom: 16 }}
              value={editTier.limit} onChange={e => setEditTier(t => t ? { ...t, limit: parseInt(e.target.value) || 0 } : null)} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setEditTier(null)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={saveUserTier} disabled={saving}>
                {saving ? <Spinner /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Payments tab ──────────────────────────────────────────────────────────────
function PaymentsTab({ payments, loading, totalRevenue }: { payments: DbPayment[]; loading: boolean; totalRevenue: number }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Payments ({payments.length})</h1>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>{fmt(totalRevenue)} total</div>
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div> : (
        <div style={{ background: 'var(--navy-card)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--fd-fill)' }}>
                {['Wallet', 'Product', 'Amount', 'Method', 'Chain', 'Tx Hash', 'When'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} style={{ borderBottom: '0.5px solid var(--fd-fill)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: "'Space Mono',monospace" }}>{shortAddr(p.wallet)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--fd-cyan)', textTransform: 'uppercase', fontSize: 11 }}>{p.tier}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--green)', fontWeight: 600 }}>
                    {p.amount_usd ? fmt(p.amount_usd) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{p.payment_token ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{CHAIN_NAME[p.chain_id ?? 0] ?? p.chain_id ?? '—'}</td>
                  <td style={{ padding: '10px 12px', fontFamily: "'Space Mono',monospace", fontSize: 10 }}>
                    {p.tx_hash
                      ? <a href={p.chain_id ? `${CHAIN_EXPLORERS[p.chain_id]}/tx/${p.tx_hash}` : '#'}
                          target="_blank" rel="noopener" style={{ color: 'var(--blue)' }}>{shortAddr(p.tx_hash)}</a>
                      : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{relTime(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Settings tab ──────────────────────────────────────────────────────────────
function SettingsTab() {
  const [maintenance,   setMaintenance]   = useState(false)
  const [maintMsg,      setMaintMsg]      = useState('Scheduled maintenance in progress. We\'ll be back shortly.')
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState('')

  useEffect(() => {
    (async () => {
      if (!supabaseReady) { setLoadingConfig(false); return }
      const config = await adminGetAllConfig()
      if (config.maintenance_mode    !== undefined) setMaintenance(config.maintenance_mode)
      if (config.maintenance_message !== undefined) setMaintMsg(config.maintenance_message)
      setLoadingConfig(false)
    })()
  }, [])

  async function saveMaintenance() {
    setSaving(true)
    try {
      await adminSetMaintenanceMode(maintenance, maintMsg)
      invalidateAppConfig()
      setSaved('maintenance')
      setTimeout(() => setSaved(''), 2000)
    } catch (e: any) { alert(e.message) }
    setSaving(false)
  }

  if (loadingConfig) return <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div>

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Settings</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28 }}>
        Changes are saved to Supabase and take effect for all users immediately.
      </p>

      {/* ── Maintenance mode ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="wrench" size={16} />Maintenance Mode</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          When enabled, all users see a maintenance page instead of the app.
          Admins can still access the app via <code style={{ color: 'var(--fd-cyan)' }}>/?bypass=fatadmin</code>.
        </div>

        {/* Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 28, borderRadius: 14, flexShrink: 0, cursor: 'pointer',
            background: maintenance ? 'var(--red)' : 'var(--fd-track)', position: 'relative', transition: 'background 0.2s' }}
            onClick={() => setMaintenance(m => !m)}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: '#fff',
              position: 'absolute', top: 3, left: maintenance ? 27 : 3, transition: 'left 0.2s' }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%',
                      background: maintenance ? 'var(--fd-red)' : 'var(--fd-green)' }} />
                    {maintenance ? 'Maintenance ON' : 'Maintenance OFF'}
                  </span></div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {maintenance ? 'App is currently down for all users' : 'App is live and accessible'}
            </div>
          </div>
        </div>

        <div className="field-label" style={{ marginBottom: 6 }}>Maintenance message shown to users</div>
        <textarea className="field-input" rows={3} style={{ width: '100%', resize: 'vertical', marginBottom: 14 }}
          value={maintMsg} onChange={e => setMaintMsg(e.target.value)} />

        <button className="btn-primary" onClick={saveMaintenance} disabled={saving || !supabaseReady}>
          {saving ? <Spinner /> : saved === 'maintenance' ? '✓ Saved!' : 'Save maintenance settings'}
        </button>
      </div>
    </div>
  )
}
