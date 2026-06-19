import { useNavigate } from 'react-router-dom'

const PLATFORM_STATS = [
  { val: '312', label: 'Migrations' },
  { val: '$6.1M', label: 'Token Value Migrated' },
  { val: '91%', label: 'Avg Participation' },
  { val: '4s', label: 'Oracle Finality' },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Deploy Vault',
    desc: 'Configure your migration parameters and deploy a MigrationVault smart contract in one click.',
  },
  {
    step: '02',
    title: 'Fund with V2',
    desc: 'Deposit your new V2 tokens into the vault at your chosen exchange ratio.',
  },
  {
    step: '03',
    title: 'Holders Swap',
    desc: 'Token holders visit your public swap page and exchange V1 for V2 during the migration window.',
  },
  {
    step: '04',
    title: 'Oracle Disburses',
    desc: 'The on-chain oracle automatically distributes V2 tokens to swappers and handles post-window cleanup.',
  },
]

const VS_TABLE = [
  ['Feature', 'FatDeploy Migrate', 'migrate.fun'],
  ['Oracle disbursal', '✓', '✗'],
  ['Post-window airdrop', '✓', '✗'],
  ['Snapshot tool', '✓', '✗'],
  ['Custom ratio', '✓', '✓'],
  ['Migration window', '✓', '✓'],
  ['No-code deploy', '✓', '✗'],
  ['CSV export', '✓', '✗'],
]

export function MigrateLanding() {
  const navigate = useNavigate()

  return (
    <div className="migrate-page step-panel">
      {/* Hero */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 2rem 0', boxSizing: 'border-box' }}>
        <div className="migrate-hero" style={{ padding: '4rem 3rem', textAlign: 'center', position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
          {/* Glow orbs */}
          <div style={{
            position: 'absolute', top: -80, left: '20%', width: 320, height: 320,
            borderRadius: '50%', background: 'rgba(255,215,0,0.06)', filter: 'blur(60px)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -60, right: '15%', width: 240, height: 240,
            borderRadius: '50%', background: 'rgba(0,230,118,0.05)', filter: 'blur(50px)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative' }}>
            <span className="pill pill-gold" style={{ marginBottom: 16, display: 'inline-block' }}>
              Migration Protocol
            </span>
            <h1 style={{ fontSize: 'clamp(26px, 5vw, 46px)', fontWeight: 800, lineHeight: 1.15, marginBottom: 16, maxWidth: 640, margin: '0 auto 16px' }}>
              Token Migration,{' '}
              <span style={{ color: 'var(--gold)' }}>Done Right</span>
            </h1>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto 32px', lineHeight: 1.7 }}>
              Deploy a MigrationVault, fund it with V2 tokens, and give holders a seamless self-serve swap experience — all without writing a single line of Solidity.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn-primary"
                style={{ padding: '12px 28px', fontSize: 15 }}
                onClick={() => navigate('/migrate/create')}
              >
                Start Migration →
              </button>
              <button
                className="btn-ghost"
                style={{ padding: '12px 28px', fontSize: 15 }}
                onClick={() => navigate('/migrate/calculator')}
              >
                Calculate Vault Size
              </button>
            </div>
          </div>
        </div>

        {/* Platform stats */}
        <div className="grid-4" style={{ marginTop: 24 }}>
          {PLATFORM_STATS.map(s => (
            <div key={s.label} className="sum-tile">
              <div className="sum-val">{s.val}</div>
              <div className="sum-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div style={{ marginTop: 60 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>How It Works</h2>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, marginBottom: 32 }}>
            Four steps from old token to fully migrated community
          </p>
          <div className="grid-2" style={{ gap: 16 }}>
            {HOW_IT_WORKS.map(s => (
              <div key={s.step} className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(255,215,0,0.1)', border: '0.5px solid var(--border-strong)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Space Mono',monospace", fontSize: 12, fontWeight: 700,
                  color: 'var(--gold)', flexShrink: 0,
                }}>
                  {s.step}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* vs migrate.fun */}
        <div style={{ marginTop: 60, marginBottom: 60 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 24 }}>
            Why FatDeploy Migrate?
          </h2>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {VS_TABLE.map((row, i) => (
                  <tr key={i} style={{ borderBottom: i < VS_TABLE.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        style={{
                          padding: '11px 16px',
                          fontWeight: i === 0 ? 700 : j === 0 ? 500 : 400,
                          color: i === 0 ? 'var(--text-muted)' : j === 1 ? (cell === '✓' ? 'var(--green)' : cell === '✗' ? 'var(--red)' : '#fff') : (cell === '✓' ? 'var(--text-secondary)' : cell === '✗' ? 'var(--text-muted)' : 'var(--text-muted)'),
                          textAlign: j === 0 ? 'left' : 'center',
                          fontSize: (j > 0 && i > 0) ? 16 : 13,
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button
              className="btn-primary"
              style={{ padding: '12px 36px', fontSize: 15 }}
              onClick={() => navigate('/migrate/create')}
            >
              Launch Your Migration →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
