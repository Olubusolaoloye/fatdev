import { useState } from 'react'
import { AirdropTool }     from './AirdropTool'
import { HolderAnalytics } from './HolderAnalytics'
import { AuditScore }      from './AuditScore'
import { PresaleTool }     from './PresaleTool'
import { SocialTools }     from './SocialTools'
import { SecurityScanner } from './SecurityScanner'

type Tool = 'airdrop' | 'analytics' | 'audit' | 'presale' | 'social' | 'scanner'

const TOOLS: { key: Tool; icon: string; title: string; desc: string; badge?: string }[] = [
  {
    key:   'scanner',
    icon:  '🔍',
    title: 'Security Scanner',
    desc:  'Full on-chain security audit — honeypot detection, blacklist, mint risk, tax simulation, LP lock %, and a live 0–100 trust score. Powered by GoPlus + Honeypot.is.',
    badge: 'New',
  },
  {
    key:   'audit',
    icon:  '🛡️',
    title: 'Audit Score',
    desc:  'Auto-score your token config: taxes, security flags, on-chain verification, ownership. Generates a shareable scorecard for Telegram & Discord.',
    badge: 'Trust Signal',
  },
  {
    key:   'presale',
    icon:  '🎯',
    title: 'Presale / Fairlaunch',
    desc:  'Deploy a presale contract with hard cap, soft cap, whitelist, and price. Auto-adds liquidity on finalise. No PinkSale needed.',
  },
  {
    key:   'social',
    icon:  '📢',
    title: 'Social & Community',
    desc:  'One-click announcement templates for Telegram, X, and Discord pre-filled with your tokenomics. Plus an embeddable website widget.',
  },
  {
    key:   'airdrop',
    icon:  '🪂',
    title: 'Airdrop Tool',
    desc:  'Batch-send tokens to hundreds of wallets from a CSV — only 2 transactions: one approve + one batch disperse.',
  },
  {
    key:   'analytics',
    icon:  '📊',
    title: 'Holder Analytics',
    desc:  'Top holders, large buys/sells, bot detection by wallet age, LP reward history.',
  },
]

export function ToolsHub() {
  const [active, setActive] = useState<Tool | null>(null)

  if (active) {
    const tool = TOOLS.find(t => t.key === active)!
    return (
      <div className="step-panel">
        <button className="btn-ghost" style={{ fontSize: 12, marginBottom: 20 }}
          onClick={() => setActive(null)}>
          ← Back to Tools
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <span style={{ fontSize: 28 }}>{tool.icon}</span>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{tool.title}</h2>
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
    )
  }

  return (
    <div className="step-panel">
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em',
          color: 'var(--text-muted)', marginBottom: 6 }}>Token Launch Toolkit</div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto' }}>
          Everything you need after deployment — from presale to community growth.
        </p>
      </div>

      <div className="grid-2" style={{ gap: 16 }}>
        {TOOLS.map(tool => (
          <button key={tool.key} onClick={() => setActive(tool.key)}
            className="card card-hover"
            style={{ textAlign: 'left', cursor: 'pointer', border: 'none', background: 'var(--navy-card)',
              padding: 24, borderRadius: 14, transition: 'border-color 0.2s', width: '100%', position: 'relative' }}>
            {tool.badge && (
              <span style={{
                position: 'absolute', top: 14, right: 14,
                fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                background: tool.badge === 'New' ? 'var(--green)' : 'rgba(255,215,0,0.2)',
                color: tool.badge === 'New' ? '#040D18' : 'var(--gold)',
                textTransform: 'uppercase', letterSpacing: '.06em',
              }}>
                {tool.badge}
              </span>
            )}
            <div style={{ fontSize: 36, marginBottom: 12 }}>{tool.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{tool.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{tool.desc}</div>
            <div style={{ marginTop: 16 }}>
              <span className="pill pill-gold" style={{ fontSize: 11 }}>Open →</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
