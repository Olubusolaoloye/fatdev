import { useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { AirdropTool }     from '../components/tools/AirdropTool'
import { HolderAnalytics } from '../components/tools/HolderAnalytics'
import { AuditScore }      from '../components/tools/AuditScore'
import { PresaleTool }     from '../components/tools/PresaleTool'
import { SocialTools }     from '../components/tools/SocialTools'
import { SecurityScanner } from '../components/tools/SecurityScanner'

type Tool = 'scanner' | 'audit' | 'presale' | 'social' | 'airdrop' | 'analytics'

const TOOLS: {
  key: Tool; icon: string; title: string; desc: string
  badge?: string; free?: boolean
}[] = [
  {
    key: 'scanner', icon: '🔍', title: 'Security Scanner', free: true,
    desc: 'Full on-chain audit — honeypot, blacklist, tax sim, LP lock, and a live 0–100 trust score.',
    badge: 'Free',
  },
  {
    key: 'social', icon: '📢', title: 'Social & Community', free: true,
    desc: 'Announcement templates for Telegram, X, and Discord. Pre-filled with your tokenomics.',
    badge: 'Free',
  },
  {
    key: 'analytics', icon: '📊', title: 'Holder Analytics', free: true,
    desc: 'Top holders, large buys/sells, bot detection by wallet age, LP reward history.',
    badge: 'Free',
  },
  {
    key: 'audit', icon: '🛡️', title: 'Audit Score',
    desc: 'Auto-score your token config: taxes, security flags, verification, ownership. Shareable scorecard.',
    badge: 'Trust Signal',
  },
  {
    key: 'presale', icon: '🎯', title: 'Presale / Fairlaunch',
    desc: 'Deploy a presale contract with hard cap, soft cap, whitelist, and auto-liquidity on finalise.',
  },
  {
    key: 'airdrop', icon: '🪂', title: 'Airdrop Tool',
    desc: 'Batch-send tokens to hundreds of wallets from a CSV. One approve + one disperse transaction.',
  },
]

export function ToolsPage() {
  const [active, setActive] = useState<Tool | null>(null)
  const tool = active ? TOOLS.find(t => t.key === active)! : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fd-void)', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{
        flex: 1,
        maxWidth: 1100, margin: '0 auto', width: '100%',
        padding: 'clamp(80px,10vw,100px) clamp(16px,4vw,2rem) 64px',
        boxSizing: 'border-box',
      }}>

        {/* ── Tool view ── */}
        {active && tool && (
          <div>
            <button onClick={() => setActive(null)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'var(--fd-surface)', border: '1px solid var(--fd-border)',
                borderRadius: 'var(--fd-radius-sm)', padding: '7px 14px',
                color: 'var(--fd-ghost)', fontSize: 13, cursor: 'pointer',
                fontFamily: "'Space Grotesk', sans-serif",
                marginBottom: 28, transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.color = 'var(--fd-white)'
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--fd-border-cyan)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.color = 'var(--fd-ghost)'
                ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--fd-border)'
              }}>
              ← All Tools
            </button>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36,
              flexWrap: 'wrap',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                background: 'var(--fd-surface)', border: '1px solid var(--fd-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
              }}>{tool.icon}</div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <h1 style={{
                    fontSize: 'clamp(18px,3vw,24px)', fontWeight: 700, margin: 0,
                    fontFamily: 'var(--fd-font-display)', color: 'var(--fd-white)',
                  }}>{tool.title}</h1>
                  {tool.badge && (
                    <span style={{
                      fontSize: 10, padding: '3px 10px', borderRadius: 20, fontWeight: 700,
                      background: tool.free ? 'rgba(0,230,118,0.12)' : 'rgba(0,207,255,0.12)',
                      color: tool.free ? 'var(--fd-green)' : 'var(--fd-cyan)',
                      border: `1px solid ${tool.free ? 'rgba(0,230,118,0.25)' : 'rgba(0,207,255,0.25)'}`,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>{tool.badge}</span>
                  )}
                </div>
                <p style={{ fontSize: 14, color: 'var(--fd-ghost)', margin: 0, lineHeight: 1.6 }}>{tool.desc}</p>
              </div>
            </div>

            {active === 'scanner'   && <SecurityScanner />}
            {active === 'airdrop'   && <AirdropTool />}
            {active === 'analytics' && <HolderAnalytics />}
            {active === 'audit'     && <AuditScore />}
            {active === 'presale'   && <PresaleTool />}
            {active === 'social'    && <SocialTools />}
          </div>
        )}

        {/* ── Tools grid ── */}
        {!active && (
          <>
            {/* Hero */}
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '4px 16px', borderRadius: 20, marginBottom: 18,
                background: 'var(--fd-cyan-ghost)', border: '1px solid var(--fd-border-cyan)',
              }}>
                <span style={{
                  fontSize: 11, color: 'var(--fd-cyan)',
                  fontFamily: 'var(--fd-font-mono)',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>Token Launch Toolkit</span>
              </div>
              <h1 style={{
                fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900,
                margin: '0 0 14px', lineHeight: 1.1,
                fontFamily: 'var(--fd-font-display)', color: 'var(--fd-white)',
              }}>
                All the tools.<br />
                <span style={{ color: 'var(--fd-cyan)' }}>Zero complexity.</span>
              </h1>
              <p style={{
                fontSize: 15, color: 'var(--fd-ghost)', maxWidth: 520,
                margin: '0 auto', lineHeight: 1.7,
              }}>
                From security scanning to community launches — everything you need to deploy, grow,
                and protect your token in one place.
              </p>
            </div>

            {/* Free tools */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.12em', color: 'var(--fd-green)',
                  fontFamily: 'var(--fd-font-mono)',
                }}>Free Tools — No wallet required</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(0,230,118,0.15)' }} />
              </div>
              <div className="tools-grid">
                {TOOLS.filter(t => t.free).map(t => (
                  <ToolCard key={t.key} tool={t} onOpen={() => setActive(t.key)} />
                ))}
              </div>
            </div>

            {/* Wallet tools */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 32 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.12em', color: 'var(--fd-ghost)',
                  fontFamily: 'var(--fd-font-mono)',
                }}>Deploy Tools — Wallet required</span>
                <div style={{ flex: 1, height: 1, background: 'var(--fd-border)' }} />
              </div>
              <div className="tools-grid">
                {TOOLS.filter(t => !t.free).map(t => (
                  <ToolCard key={t.key} tool={t} onOpen={() => setActive(t.key)} />
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />

      <style>{`
        .tools-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
          margin-bottom: 8px;
        }
        @media (max-width: 480px) {
          .tools-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}

// ── Tool card ─────────────────────────────────────────────────────────────────
function ToolCard({ tool, onOpen }: { tool: typeof TOOLS[0]; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textAlign: 'left', cursor: 'pointer',
        background: 'var(--fd-surface)',
        border: `1px solid ${hovered ? 'var(--fd-border-cyan)' : 'var(--fd-border)'}`,
        borderRadius: 'var(--fd-radius-lg)',
        padding: '24px', position: 'relative', width: '100%',
        transition: 'border-color 0.15s, transform 0.15s',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxSizing: 'border-box',
      }}>

      {tool.badge && (
        <span style={{
          position: 'absolute', top: 14, right: 14,
          fontSize: 9, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
          background: tool.free ? 'rgba(0,230,118,0.12)' : 'rgba(0,207,255,0.12)',
          color: tool.free ? 'var(--fd-green)' : 'var(--fd-cyan)',
          border: `1px solid ${tool.free ? 'rgba(0,230,118,0.25)' : 'rgba(0,207,255,0.25)'}`,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>{tool.badge}</span>
      )}

      <div style={{ fontSize: 34, marginBottom: 14, lineHeight: 1 }}>{tool.icon}</div>
      <div style={{
        fontWeight: 700, fontSize: 16, marginBottom: 8,
        fontFamily: 'var(--fd-font-display)', color: 'var(--fd-white)',
      }}>{tool.title}</div>
      <div style={{ fontSize: 13, color: 'var(--fd-ghost)', lineHeight: 1.6 }}>{tool.desc}</div>
      <div style={{ marginTop: 20 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 12, fontWeight: 600,
          color: hovered ? 'var(--fd-cyan)' : 'var(--fd-ghost)',
          transition: 'color 0.15s',
          fontFamily: "'Space Grotesk', sans-serif",
        }}>Open tool →</span>
      </div>
    </button>
  )
}
