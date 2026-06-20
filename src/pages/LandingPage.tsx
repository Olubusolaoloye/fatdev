import { Link } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'

// ── Animated grid background ──────────────────────────────────────────────────
function GridBg() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden',
    }}>
      {/* Grid lines */}
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none"
              stroke="rgba(255,215,0,0.04)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {/* Radial gold glow top-center */}
      <div style={{
        position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)',
        width: 800, height: 500,
        background: 'radial-gradient(ellipse at center, rgba(255,215,0,0.07) 0%, transparent 70%)',
      }} />
      {/* Bottom-right accent */}
      <div style={{
        position: 'absolute', bottom: -100, right: -100,
        width: 500, height: 500,
        background: 'radial-gradient(ellipse at center, rgba(74,144,226,0.05) 0%, transparent 70%)',
      }} />
    </div>
  )
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function Stat({ val, label }: { val: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: "'Space Mono',monospace", fontSize: 28, fontWeight: 700,
        color: 'var(--gold)', lineHeight: 1,
        textShadow: '0 0 20px rgba(255,215,0,0.4)',
      }}>{val}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4,
        textTransform: 'uppercase', letterSpacing: '.1em' }}>{label}</div>
    </div>
  )
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({
  icon, title, desc, tag, to, external,
}: {
  icon: string; title: string; desc: string; tag?: string
  to: string; external?: boolean
}) {
  const inner = (
    <div className="card card-hover" style={{
      padding: 28, height: '100%', position: 'relative', cursor: 'pointer',
      background: 'linear-gradient(135deg, #0a1929 0%, #071525 100%)',
      transition: 'transform 0.2s, border-color 0.2s',
    }}>
      {tag && (
        <span style={{
          position: 'absolute', top: 16, right: 16,
          fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
          background: tag === 'Live' ? 'rgba(0,230,118,0.2)' : 'rgba(255,215,0,0.15)',
          color: tag === 'Live' ? 'var(--green)' : 'var(--gold)',
          textTransform: 'uppercase', letterSpacing: '.06em', border: `0.5px solid ${tag === 'Live' ? 'rgba(0,230,118,0.3)' : 'rgba(255,215,0,0.3)'}`,
        }}>{tag}</span>
      )}
      <div style={{ fontSize: 36, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{desc}</div>
      <div style={{ marginTop: 20 }}>
        <span className="pill pill-gold" style={{ fontSize: 11 }}>Explore →</span>
      </div>
    </div>
  )

  if (external) return (
    <a href={to} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>{inner}</a>
  )
  return <Link to={to} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>{inner}</Link>
}

// ── Scan demo chip ────────────────────────────────────────────────────────────
function DemoChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', borderRadius: 8,
      background: ok ? 'rgba(0,230,118,0.05)' : 'rgba(255,82,82,0.07)',
      border: `0.5px solid ${ok ? 'rgba(0,230,118,0.2)' : 'rgba(255,82,82,0.25)'}`,
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: '50%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800,
        background: ok ? 'rgba(0,230,118,0.2)' : 'rgba(255,82,82,0.2)',
        color: ok ? 'var(--green)' : 'var(--red)', flexShrink: 0,
      }}>{ok ? '✓' : '✗'}</span>
      <span style={{ fontSize: 12 }}>{label}</span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function LandingPage() {
  const { isConnected } = useAccount()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--navy)', color: '#fff', position: 'relative' }}>
      <GridBg />

      {/* ── Nav ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '0.5px solid var(--border)',
        background: 'rgba(4,13,24,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: '0 2rem',
          height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7, background: 'var(--gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(255,215,0,0.3)',
            }}>
              <span style={{ color: 'var(--navy)', fontSize: 15, fontWeight: 800 }}>F</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 17 }}>FatDev</span>
            <span className="pill pill-gold" style={{ fontSize: 9 }}>BETA</span>
          </div>

          {/* Nav links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link to="/tools" style={{
              fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none',
              padding: '5px 14px', borderRadius: 6, fontWeight: 500,
            }}>Tools</Link>
            <Link to="/migrate" style={{
              fontSize: 13, color: 'var(--text-secondary)', textDecoration: 'none',
              padding: '5px 14px', borderRadius: 6, fontWeight: 500,
            }}>Migrate</Link>
            <Link to="/app" style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: 'rgba(255,215,0,0.1)', color: 'var(--gold)',
              border: '0.5px solid rgba(255,215,0,0.3)', textDecoration: 'none',
              marginLeft: 4,
            }}>Launch App</Link>
            <div style={{ marginLeft: 4 }}>
              <ConnectButton accountStatus="avatar" chainStatus="none" showBalance={false} />
            </div>
          </nav>
        </div>
      </header>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Hero ── */}
        <section style={{
          maxWidth: 1100, margin: '0 auto', padding: '7rem 2rem 5rem',
          textAlign: 'center',
        }}>
          {/* Pre-label */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 14px', borderRadius: 20, marginBottom: 28,
            background: 'rgba(255,215,0,0.07)',
            border: '0.5px solid rgba(255,215,0,0.2)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)',
              boxShadow: '0 0 6px var(--green)', display: 'inline-block',
              animation: 'pulse 1.8s ease-in-out infinite' }} />
            <span style={{ fontSize: 11, color: 'var(--gold)', fontFamily: "'Space Mono',monospace",
              letterSpacing: '.1em', textTransform: 'uppercase' }}>
              No-Code Token Deployment Platform
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(38px, 7vw, 72px)', fontWeight: 900, lineHeight: 1.08,
            margin: '0 0 20px', letterSpacing: '-0.02em',
          }}>
            Deploy Tokens.<br />
            <span style={{
              background: 'linear-gradient(90deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              backgroundSize: '200% 100%',
              animation: 'shimmer 3s linear infinite',
            }}>
              Without Writing Code.
            </span>
          </h1>

          <p style={{
            fontSize: 'clamp(15px, 2vw, 18px)', color: 'var(--text-secondary)',
            maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.7,
          }}>
            Configure, deploy, and manage BEP-20 / ERC-20 tokens from your browser.
            No Solidity. No Remix. No dev needed. Scan, launch, and grow — all in one place.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/app" style={{
              padding: '14px 32px', borderRadius: 10, fontSize: 15, fontWeight: 800,
              background: 'var(--gold)', color: 'var(--navy)', textDecoration: 'none',
              boxShadow: '0 0 24px rgba(255,215,0,0.35)',
              transition: 'box-shadow 0.2s',
            }}>
              ⚡ Launch App
            </Link>
            <Link to="/tools" style={{
              padding: '14px 32px', borderRadius: 10, fontSize: 15, fontWeight: 700,
              background: 'rgba(255,215,0,0.08)', color: 'var(--gold)',
              border: '0.5px solid rgba(255,215,0,0.3)', textDecoration: 'none',
            }}>
              🔍 Security Scanner
            </Link>
          </div>

          {/* Stats */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 48, marginTop: 64,
            flexWrap: 'wrap', padding: '32px 0',
            borderTop: '0.5px solid var(--border)',
          }}>
            <Stat val="4" label="Chains supported" />
            <Stat val="8-step" label="Deploy wizard" />
            <Stat val="12+" label="Security checks" />
            <Stat val="Free" label="Security scanner" />
          </div>
        </section>

        {/* ── Scanner preview ── */}
        <section style={{
          maxWidth: 1100, margin: '0 auto', padding: '0 2rem 6rem',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 32, alignItems: 'center',
          }}>
            {/* Left: copy */}
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em',
                color: 'var(--gold)', marginBottom: 12 }}>Security Scanner</div>
              <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 800,
                lineHeight: 1.2, margin: '0 0 16px' }}>
                Know before<br />you ape in.
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24 }}>
                Paste any contract address. Get a full security audit powered by GoPlus + Honeypot.is — honeypot detection, tax simulation, LP lock status, blacklist, mint risk, and a live 0–100 trust score.
              </p>
              <Link to="/tools" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: 'rgba(255,215,0,0.1)', color: 'var(--gold)',
                border: '0.5px solid rgba(255,215,0,0.3)', textDecoration: 'none',
              }}>
                Try it free — no wallet needed →
              </Link>
            </div>

            {/* Right: mock scanner card */}
            <div className="card" style={{
              background: 'linear-gradient(135deg, #0a1929 0%, #071525 100%)',
              padding: 24,
            }}>
              {/* Score ring mock */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                  <svg width={80} height={80} viewBox="0 0 80 80">
                    <circle cx={40} cy={40} r={30} fill="none"
                      stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
                    <circle cx={40} cy={40} r={30} fill="none"
                      stroke="var(--green)" strokeWidth={7}
                      strokeDasharray="169 188" strokeDashoffset="47"
                      strokeLinecap="round"
                      style={{ filter: 'drop-shadow(0 0 6px var(--green))' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex',
                    flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 18,
                      fontWeight: 700, color: 'var(--green)', lineHeight: 1 }}>87</span>
                    <span style={{ fontSize: 7, color: 'var(--green)', fontWeight: 800,
                      letterSpacing: '.1em' }}>SAFE</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>FatToken <span style={{
                    fontFamily: "'Space Mono',monospace", fontSize: 11, color: 'var(--gold)',
                    padding: '1px 6px', background: 'rgba(255,215,0,0.1)', borderRadius: 4,
                  }}>FAT</span></div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    BNB Chain · 1,247 holders
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <DemoChip ok={true}  label="Not a Honeypot" />
                <DemoChip ok={true}  label="Not Mintable" />
                <DemoChip ok={true}  label="Ownership Renounced" />
                <DemoChip ok={true}  label="LP Locked 100%" />
                <DemoChip ok={false} label="Tax Modifiable" />
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Buy Tax</div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                    <div style={{ width: '20%', height: '100%', background: 'var(--green)',
                      borderRadius: 3, boxShadow: '0 0 6px var(--green)' }} />
                  </div>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11,
                    color: 'var(--green)', marginTop: 3 }}>5%</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Sell Tax</div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                    <div style={{ width: '28%', height: '100%', background: 'var(--gold)',
                      borderRadius: 3, boxShadow: '0 0 6px var(--gold)' }} />
                  </div>
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11,
                    color: 'var(--gold)', marginTop: 3 }}>7%</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Platform features grid ── */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 6rem' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em',
              color: 'var(--text-muted)', marginBottom: 8 }}>Everything you need</div>
            <h2 style={{ fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 800, margin: 0 }}>
              One platform. Full stack.
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
          }}>
            <FeatureCard
              to="/app"
              icon="⚡"
              title="Token Deploy Wizard"
              desc="8-step no-code wizard. Configure name, supply, taxes, anti-bot, and deploy directly on-chain. BSC, ETH, Arbitrum supported."
              tag="Live"
            />
            <FeatureCard
              to="/tools"
              icon="🔍"
              title="Security Scanner"
              desc="Full on-chain audit — honeypot, blacklist, tax sim, LP lock, owner analysis. Powered by GoPlus + Honeypot.is. Free, no wallet."
              tag="Free"
            />
            <FeatureCard
              to="/migrate"
              icon="🔄"
              title="Migration Protocol"
              desc="Move holders from V1 to V2 tokens with snapshot-based vaults. Automatic oracle, airdrop batching, and on-chain verification."
            />
            <FeatureCard
              to="/tools"
              icon="🎯"
              title="Presale & Fairlaunch"
              desc="Deploy a presale contract with hard cap, soft cap, whitelist, and price. Auto-adds liquidity on finalise. No PinkSale needed."
            />
            <FeatureCard
              to="/tools"
              icon="🪂"
              title="Airdrop Tool"
              desc="Batch-send tokens to hundreds of wallets from a CSV. One approve + one disperse transaction. Fast and gas-efficient."
            />
            <FeatureCard
              to="/tools"
              icon="📢"
              title="Social & Community"
              desc="One-click announcement templates for Telegram, X, and Discord pre-filled with your tokenomics. Shareable scorecard included."
            />
          </div>
        </section>

        {/* ── Deploy CTA strip ── */}
        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 7rem' }}>
          <div style={{
            borderRadius: 20, padding: '4rem 3rem', textAlign: 'center', position: 'relative',
            background: 'linear-gradient(135deg, #0a1929 0%, #071525 100%)',
            border: '0.5px solid rgba(255,215,0,0.2)',
            overflow: 'hidden',
          }}>
            {/* Background glow */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 600, height: 300,
              background: 'radial-gradient(ellipse, rgba(255,215,0,0.06) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em',
                color: 'var(--text-muted)', marginBottom: 12 }}>Get started in minutes</div>
              <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 44px)', fontWeight: 900, margin: '0 0 16px' }}>
                Ready to launch your token?
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 480,
                margin: '0 auto 32px', lineHeight: 1.7 }}>
                Connect your wallet, pick a plan, and deploy your configured token directly on-chain — no code, no Remix, no waiting.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/app" style={{
                  padding: '14px 36px', borderRadius: 10, fontSize: 15, fontWeight: 800,
                  background: 'var(--gold)', color: 'var(--navy)', textDecoration: 'none',
                  boxShadow: '0 0 24px rgba(255,215,0,0.3)',
                }}>
                  {isConnected ? '⚡ Go to Wizard' : '⚡ Start Deploying'}
                </Link>
                <Link to="/tools" style={{
                  padding: '14px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
                  background: 'transparent', color: '#fff',
                  border: '0.5px solid rgba(255,255,255,0.15)', textDecoration: 'none',
                }}>
                  Explore Tools
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{
          borderTop: '0.5px solid var(--border)', padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
            justifyContent: 'center', marginBottom: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--navy)', fontSize: 11, fontWeight: 800 }}>F</span>
            </div>
            <span style={{ fontWeight: 700 }}>FatDev</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)',
            fontFamily: "'Space Mono',monospace" }}>
            No-code BEP-20 / ERC-20 token deployer · wagmi v3 + viem + RainbowKit · Not financial advice
          </div>
        </footer>
      </div>

      {/* ── Keyframe animations ── */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 0% 50% }
          100% { background-position: 200% 50% }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50%       { opacity: 0.4 }
        }
      `}</style>
    </div>
  )
}
