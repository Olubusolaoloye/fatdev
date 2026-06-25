import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
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
    <div style={{ minHeight: '100vh', background: 'var(--fd-void)', color: '#fff' }}>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '0.5px solid var(--border)',
        background: 'rgba(4,13,24,0.9)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: '0 2rem',
          height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, background: 'var(--fd-cyan)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: 'var(--fd-void)', fontSize: 14, fontWeight: 800 }}>F</span>
              </div>
              <span style={{ fontWeight: 800, fontSize: 16 }}>FatDev</span>
            </Link>
            {active && (
              <>
                <span style={{ color: 'var(--border)', fontSize: 18 }}>/</span>
                <button onClick={() => setActive(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)',
                    fontSize: 13, cursor: 'pointer', padding: 0 }}>
                  Tools
                </button>
                <span style={{ color: 'var(--border)', fontSize: 18 }}>/</span>
                <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{tool?.title}</span>
              </>
            )}
            {!active && (
              <>
                <span style={{ color: 'var(--border)', fontSize: 18 }}>/</span>
                <span style={{ fontSize: 13, color: 'var(--fd-cyan)', fontWeight: 600 }}>Tools</span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/app" style={{
              fontSize: 12, color: 'var(--fd-cyan)', textDecoration: 'none',
              padding: '5px 14px', borderRadius: 6, fontWeight: 700,
              border: '0.5px solid rgba(255,215,0,0.3)',
              background: 'rgba(255,215,0,0.06)',
            }}>⚡ Launch App</Link>
            <ConnectButton accountStatus="avatar" chainStatus="none" showBalance={false} />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '3rem 2rem', boxSizing: 'border-box' }}>

        {/* ── Tool view ── */}
        {active && tool && (
          <div>
            <button onClick={() => setActive(null)}
              className="btn-ghost"
              style={{ fontSize: 12, marginBottom: 24 }}>
              ← All Tools
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: 'rgba(255,215,0,0.1)', border: '0.5px solid rgba(255,215,0,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              }}>{tool.icon}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{tool.title}</h1>
                  {tool.badge && (
                    <span style={{
                      fontSize: 9, padding: '2px 8px', borderRadius: 20, fontWeight: 800,
                      background: tool.free ? 'rgba(0,230,118,0.15)' : tool.badge === 'Trust Signal' ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.08)',
                      color: tool.free ? 'var(--green)' : tool.badge === 'Trust Signal' ? 'var(--fd-cyan)' : 'var(--text-muted)',
                      border: `0.5px solid ${tool.free ? 'rgba(0,230,118,0.3)' : 'rgba(255,215,0,0.2)'}`,
                      textTransform: 'uppercase', letterSpacing: '.06em',
                    }}>{tool.badge}</span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{tool.desc}</p>
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
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '4px 14px', borderRadius: 20, marginBottom: 16,
                background: 'rgba(255,215,0,0.07)', border: '0.5px solid rgba(255,215,0,0.2)',
              }}>
                <span style={{ fontSize: 11, color: 'var(--fd-cyan)', fontFamily: "'Space Mono',monospace",
                  letterSpacing: '.1em', textTransform: 'uppercase' }}>Token Launch Toolkit</span>
              </div>
              <h1 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, margin: '0 0 14px', lineHeight: 1.1 }}>
                All the tools.<br />
                <span style={{ color: 'var(--fd-cyan)' }}>Zero complexity.</span>
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 520,
                margin: '0 auto', lineHeight: 1.7 }}>
                From security scanning to community launches — everything you need to deploy, grow, and protect your token in one place.
              </p>
            </div>

            {/* Free tools section */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                  letterSpacing: '.12em', color: 'var(--green)' }}>Free Tools — No wallet required</span>
                <div style={{ flex: 1, height: '0.5px', background: 'rgba(0,230,118,0.15)' }} />
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 14, marginBottom: 32,
              }}>
                {TOOLS.filter(t => t.free).map(t => (
                  <ToolCard key={t.key} tool={t} onOpen={() => setActive(t.key)} />
                ))}
              </div>
            </div>

            {/* Wallet tools section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                  letterSpacing: '.12em', color: 'var(--text-muted)' }}>Deploy Tools — Wallet required</span>
                <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 14,
              }}>
                {TOOLS.filter(t => !t.free).map(t => (
                  <ToolCard key={t.key} tool={t} onOpen={() => setActive(t.key)} />
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// ── Tool card ─────────────────────────────────────────────────────────────────
function ToolCard({ tool, onOpen }: { tool: typeof TOOLS[0]; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="card card-hover"
      style={{
        textAlign: 'left', cursor: 'pointer', border: 'none', width: '100%',
        background: 'linear-gradient(135deg, #0a1929 0%, #071525 100%)',
        padding: '24px', borderRadius: 14, position: 'relative',
      }}>
      {tool.badge && (
        <span style={{
          position: 'absolute', top: 14, right: 14,
          fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
          background: tool.free
            ? 'rgba(0,230,118,0.15)'
            : tool.badge === 'Trust Signal'
              ? 'rgba(255,215,0,0.15)'
              : 'rgba(255,255,255,0.06)',
          color: tool.free ? 'var(--green)' : tool.badge === 'Trust Signal' ? 'var(--fd-cyan)' : 'var(--text-muted)',
          border: `0.5px solid ${tool.free ? 'rgba(0,230,118,0.3)' : tool.badge === 'Trust Signal' ? 'rgba(255,215,0,0.25)' : 'var(--border)'}`,
          textTransform: 'uppercase', letterSpacing: '.06em',
        }}>{tool.badge}</span>
      )}
      <div style={{ fontSize: 34, marginBottom: 14 }}>{tool.icon}</div>
      <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{tool.title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>{tool.desc}</div>
      <div style={{ marginTop: 18 }}>
        <span className="pill pill-gold" style={{ fontSize: 11 }}>Open →</span>
      </div>
    </button>
  )
}
