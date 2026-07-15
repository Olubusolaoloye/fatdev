import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

// ── Intersection observer for scroll-reveal ───────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.12 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const { ref, visible } = useReveal()
  useEffect(() => {
    if (!visible) return
    let start = 0
    const step = Math.ceil(to / 40)
    const t = setInterval(() => {
      start = Math.min(start + step, to)
      setVal(start)
      if (start >= to) clearInterval(t)
    }, 30)
    return () => clearInterval(t)
  }, [visible, to])
  return <span ref={ref}>{val}{suffix}</span>
}

// ── Section reveal wrapper ────────────────────────────────────────────────────
function Reveal({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const { ref, visible } = useReveal()
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(32px)',
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Spinning rings decoration ─────────────────────────────────────────────────
function HeroRings() {
  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none', zIndex: 0,
      width: 700, height: 700,
    }}>
      {/* Ring 1 - slow spin */}
      <div style={{
        position: 'absolute', inset: '10%',
        borderRadius: '50%',
        border: '0.5px solid rgba(255,215,0,0.08)',
        animation: 'spin-slow 25s linear infinite',
      }}>
        {/* Bright dot on ring */}
        <div style={{
          position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)',
          width: 6, height: 6, borderRadius: '50%', background: 'var(--fd-cyan)',
          boxShadow: '0 0 12px var(--fd-cyan), 0 0 24px rgba(255,215,0,0.4)',
        }} />
      </div>
      {/* Ring 2 - counter spin */}
      <div style={{
        position: 'absolute', inset: '22%',
        borderRadius: '50%',
        border: '0.5px solid rgba(74,144,226,0.12)',
        animation: 'spin-slow 18s linear infinite reverse',
      }}>
        <div style={{
          position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)',
          width: 5, height: 5, borderRadius: '50%', background: 'var(--blue)',
          boxShadow: '0 0 10px var(--blue)',
        }} />
      </div>
      {/* Ring 3 - fastest */}
      <div style={{
        position: 'absolute', inset: '35%',
        borderRadius: '50%',
        border: '0.5px solid rgba(0,230,118,0.08)',
        animation: 'spin-slow 12s linear infinite',
      }}>
        <div style={{
          position: 'absolute', right: -3, top: '50%', transform: 'translateY(-50%)',
          width: 4, height: 4, borderRadius: '50%', background: 'var(--green)',
          boxShadow: '0 0 8px var(--green)',
        }} />
      </div>
      {/* Center glow */}
      <div style={{
        position: 'absolute', inset: '43%',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,215,0,0.08) 0%, transparent 70%)',
        animation: 'glow-pulse 3s ease-in-out infinite',
      }} />
    </div>
  )
}


// ── Scan demo card ────────────────────────────────────────────────────────────
function ScanCard() {
  const flags = [
    { ok: true,  label: 'Not a Honeypot'       },
    { ok: true,  label: 'Not Mintable'          },
    { ok: true,  label: 'Ownership Renounced'   },
    { ok: true,  label: 'LP Locked 100%'        },
    { ok: false, label: 'Tax Modifiable'        },
  ]
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(10,25,41,0.95) 0%, rgba(7,21,37,0.95) 100%)',
      border: '0.5px solid rgba(255,215,0,0.18)',
      borderRadius: 18, padding: 24,
      backdropFilter: 'blur(20px)',
      boxShadow: '0 32px 64px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,215,0,0.08)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Score ring */}
          <div style={{ position: 'relative', width: 52, height: 52 }}>
            <svg width={52} height={52} viewBox="0 0 52 52">
              <circle cx={26} cy={26} r={20} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
              <circle cx={26} cy={26} r={20} fill="none" stroke="var(--green)" strokeWidth={5}
                strokeDasharray="110 126" strokeDashoffset="31" strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 6px rgba(0,230,118,0.6))' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 13,
                fontWeight: 700, color: 'var(--green)', lineHeight: 1 }}>87</span>
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              Blin
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9,
                color: 'var(--fd-cyan)', padding: '1px 6px', background: 'rgba(255,215,0,0.12)',
                borderRadius: 4, border: '0.5px solid rgba(255,215,0,0.2)' }}>BLIN</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              Ethereum · 3,812 holders
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 2 }}>TRUST SCORE</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18,
            fontWeight: 800, color: 'var(--green)',
            textShadow: '0 0 16px rgba(0,230,118,0.5)' }}>SAFE</div>
        </div>
      </div>

      {/* Flags */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
        {flags.map((f, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
            borderRadius: 7,
            background: f.ok ? 'rgba(0,230,118,0.04)' : 'rgba(255,82,82,0.06)',
            border: `0.5px solid ${f.ok ? 'rgba(0,230,118,0.15)' : 'rgba(255,82,82,0.2)'}`,
          }}>
            <span style={{
              width: 15, height: 15, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: f.ok ? 'rgba(0,230,118,0.18)' : 'rgba(255,82,82,0.18)',
              color: f.ok ? 'var(--green)' : 'var(--red)', fontSize: 8, fontWeight: 800,
            }}>{f.ok ? '✓' : '✗'}</span>
            <span style={{ fontSize: 11 }}>{f.label}</span>
          </div>
        ))}
      </div>

      {/* Tax bars */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[{ l: 'Buy', pct: 5, color: 'var(--green)' }, { l: 'Sell', pct: 7, color: 'var(--fd-cyan)' }].map(t => (
          <div key={t.l} style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{t.l} Tax</span>
              <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10,
                color: t.color, fontWeight: 700 }}>{t.pct}%</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
              <div style={{ width: `${t.pct * 4}%`, height: '100%', borderRadius: 2,
                background: t.color, boxShadow: `0 0 6px ${t.color}` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Scan line sweep */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.4), transparent)',
        animation: 'scanline 3s ease-in-out infinite',
        borderRadius: 18,
      }} />
    </div>
  )
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FCard({ icon, title, desc, tag, to }: {
  icon: string; title: string; desc: string; tag?: string; to: string
}) {
  return (
    <Reveal>
      <Link to={to} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
        <div style={{
          padding: '28px 24px', borderRadius: 16, height: '100%', position: 'relative',
          background: 'linear-gradient(135deg, rgba(10,25,41,0.9) 0%, rgba(7,21,37,0.9) 100%)',
          border: '0.5px solid rgba(255,215,0,0.1)',
          transition: 'border-color 0.25s, transform 0.25s, box-shadow 0.25s',
          cursor: 'pointer',
        }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLDivElement
            el.style.borderColor = 'rgba(255,215,0,0.3)'
            el.style.transform = 'translateY(-4px)'
            el.style.boxShadow = '0 20px 48px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(255,215,0,0.1)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLDivElement
            el.style.borderColor = 'rgba(255,215,0,0.1)'
            el.style.transform = 'translateY(0)'
            el.style.boxShadow = 'none'
          }}
        >
          {tag && (
            <span style={{
              position: 'absolute', top: 16, right: 16,
              fontSize: 8, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
              background: tag === 'Free' ? 'rgba(0,230,118,0.15)' : 'rgba(255,215,0,0.12)',
              color: tag === 'Free' ? 'var(--green)' : 'var(--fd-cyan)',
              border: `0.5px solid ${tag === 'Free' ? 'rgba(0,230,118,0.3)' : 'rgba(255,215,0,0.2)'}`,
              textTransform: 'uppercase', letterSpacing: '.08em',
            }}>{tag}</span>
          )}
          <div style={{ fontSize: 32, marginBottom: 16 }}>{icon}</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16,
            marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>{desc}</div>
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--fd-cyan)', fontWeight: 600 }}>Explore</span>
            <span style={{ fontSize: 11, color: 'var(--fd-cyan)', transition: 'transform 0.2s' }}>→</span>
          </div>
        </div>
      </Link>
    </Reveal>
  )
}

// ── Tool chip ─────────────────────────────────────────────────────────────────
function ToolChip({ icon, label, to, color, free, hot, delay }: {
  icon: string; label: string; to: string; color: string
  free?: boolean; hot?: boolean; delay?: number
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      to={to}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '9px 16px', borderRadius: 10, textDecoration: 'none',
        background: hovered ? `${color}14` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hovered ? `${color}50` : 'rgba(255,255,255,0.1)'}`,
        transition: 'background 0.18s, border-color 0.18s, transform 0.18s',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        cursor: 'pointer',
        animation: delay ? `hero-in 0.5s ease ${delay}ms both` : undefined,
        position: 'relative',
      }}>
      {hot && (
        <span style={{
          position: 'absolute', top: -7, right: -7,
          fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 8,
          background: color, color: 'var(--fd-void)',
          fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em',
        }}>NEW</span>
      )}
      <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
      <span style={{
        fontSize: 13, fontWeight: 600, color: hovered ? color : 'rgba(255,255,255,0.75)',
        fontFamily: "'Space Grotesk', sans-serif",
        transition: 'color 0.18s',
      }}>{label}</span>
      {free && (
        <span style={{
          fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 5,
          background: 'rgba(0,230,118,0.12)', color: '#00E676',
          border: '0.5px solid rgba(0,230,118,0.25)',
          fontFamily: "'Space Mono', monospace", letterSpacing: '0.05em',
        }}>FREE</span>
      )}
    </Link>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function LandingPage() {
  const { isConnected } = useAccount()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fd-void)', color: '#fff',
      overflowX: 'hidden', fontFamily: "'Inter',sans-serif" }}>

      {/* ── Global keyframes ── */}
      <style>{`
        @keyframes spin-slow   { to { transform: rotate(360deg) } }
        @keyframes float       { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes glow-pulse  { 0%,100% { opacity:0.6; transform:scale(1) } 50% { opacity:1; transform:scale(1.15) } }
        @keyframes pulse-dot   { 0%,100% { opacity:1 } 50% { opacity:0.35 } }
        @keyframes shimmer-txt { 0% { background-position:0% 50% } 100% { background-position:200% 50% } }
        @keyframes scanline    { 0% { top:-2px } 100% { top:calc(100% + 2px) } }
        @keyframes blink-bar   { 0%,100% { opacity:1 } 50% { opacity:0 } }
        @keyframes ticker-glow { 0%,100% { box-shadow:0 0 12px rgba(255,215,0,0.2) }
                                  50%     { box-shadow:0 0 24px rgba(255,215,0,0.45) } }
        @keyframes hero-in     { from { opacity:0; transform:translateY(24px) }
                                  to   { opacity:1; transform:translateY(0) } }
        @keyframes border-glow { 0%,100% { border-color:rgba(255,215,0,0.12) }
                                  50%     { border-color:rgba(255,215,0,0.3) } }
        @keyframes ripple      { 0%   { transform:scale(0.9); opacity:0.6 }
                                  100% { transform:scale(1.5); opacity:0 } }

        .hero-cta-primary:hover {
          box-shadow: 0 0 32px rgba(255,215,0,0.5) !important;
          transform: translateY(-2px) !important;
        }
        .hero-cta-ghost:hover {
          background: rgba(255,255,255,0.06) !important;
          border-color: rgba(255,255,255,0.3) !important;
          transform: translateY(-2px) !important;
        }
        .nav-link:hover { color: #fff !important; }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .landing-hero-headline { font-size: clamp(32px, 9vw, 56px) !important; }
          .landing-hero-sub      { font-size: 14px !important; }
          .landing-rings         { width: 340px !important; height: 340px !important; }
          .desktop-nav           { display: none !important; }
          .hamburger-btn         { display: flex !important; }
          .stats-grid            { gap: 24px !important; }
          .features-grid         { grid-template-columns: 1fr !important; }
          .scanner-grid          { grid-template-columns: 1fr !important; }
          .cta-strip             { padding: 2.5rem 1.5rem !important; }
        }
        @media (min-width: 769px) {
          .hamburger-btn { display: none !important; }
        }
      `}</style>

      <Navbar />

      {/* ── HERO ── */}
      <section style={{
        minHeight: '100svh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(100px,14vw,140px) clamp(16px,4vw,2rem) 80px',
        position: 'relative', textAlign: 'center', overflow: 'hidden',
      }}>
        {/* Background radial glow */}
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: 'min(900px, 120vw)', height: 500, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 40%, rgba(0,207,255,0.06) 0%, transparent 65%)',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, right: '-10%',
          width: 400, height: 400, pointerEvents: 'none',
          background: 'radial-gradient(ellipse, rgba(74,144,226,0.04) 0%, transparent 70%)',
        }} />

        {/* Rings */}
        <div className="landing-rings" style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 640, height: 640, pointerEvents: 'none',
        }}>
          <HeroRings />
        </div>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 820, width: '100%' }}>

          {/* Live badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '5px 14px', borderRadius: 24, marginBottom: 32,
            background: 'rgba(4,13,24,0.7)',
            border: '0.5px solid rgba(255,215,0,0.2)',
            backdropFilter: 'blur(12px)',
            animation: 'hero-in 0.5s ease 0.1s both',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)',
              boxShadow: '0 0 8px var(--green)', display: 'inline-block',
              animation: 'pulse-dot 1.6s ease-in-out infinite' }} />
            <span style={{ fontSize: 10, fontFamily: "'Space Mono',monospace",
              color: 'rgba(255,255,255,0.65)', letterSpacing: '.1em' }}>
              LIVE ON BSC · ETH · ARBITRUM · ROBINHOOD CHAIN
            </span>
          </div>

          {/* Eyebrow label */}
          <div style={{
            fontSize: 11, fontFamily: "'Space Mono',monospace",
            letterSpacing: '0.18em', color: 'var(--fd-cyan)',
            textTransform: 'uppercase', marginBottom: 14,
            animation: 'hero-in 0.6s ease 0.2s both',
          }}>
            Your On-Chain
          </div>

          {/* Main headline */}
          <h1 style={{
            fontFamily: "'Orbitron',sans-serif",
            fontSize: 'clamp(42px, 7vw, 80px)',
            fontWeight: 900, lineHeight: 1.0,
            letterSpacing: '-0.02em', margin: '0 0 24px',
            background: 'linear-gradient(135deg, #EEF2FF 0%, #00CFFF 50%, #00E57A 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'hero-in 0.7s ease 0.3s both',
          }}>
            GENESIS STACK
          </h1>

          {/* Tagline */}
          <p style={{
            fontSize: 'clamp(14px, 1.6vw, 16px)',
            color: 'rgba(255,255,255,0.55)', lineHeight: 1.7,
            maxWidth: 480, margin: '0 auto 44px',
            fontFamily: "'Space Grotesk', sans-serif",
            animation: 'hero-in 0.7s ease 0.4s both',
          }}>
            Every tool you need to deploy, secure, bridge, and grow EVM tokens —
            all from your browser. No Solidity. No dev team.
          </p>

          {/* ── Tool chips ── */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 10,
            justifyContent: 'center', marginBottom: 48,
            animation: 'hero-in 0.7s ease 0.5s both',
          }}>
            {[
              { icon: '⚡', label: 'Deploy',    to: '/app',     color: '#00CFFF', free: false, hot: true  },
              { icon: '🔍', label: 'Scan',       to: '/tools',   color: '#00E676', free: true             },
              { icon: '🌉', label: 'Bridge',     to: '/bridge',  color: '#4A90E2', free: true             },
              { icon: '🔄', label: 'Migrate',    to: '/migrate', color: '#00CFFF', free: false            },
              { icon: '🎯', label: 'Presale',    to: '/tools',   color: '#FFD700', free: false            },
              { icon: '🪂', label: 'Airdrop',    to: '/tools',   color: '#00E676', free: false            },
              { icon: '📊', label: 'Analytics',  to: '/tools',   color: '#00E676', free: true             },
            ].map((chip, i) => (
              <ToolChip key={chip.label} {...chip} delay={520 + i * 55} />
            ))}
          </div>

          {/* Primary CTA */}
          <div style={{
            display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
            animation: 'hero-in 0.7s ease 0.9s both',
          }}>
            <Link to="/app" className="hero-cta-primary" style={{
              padding: '13px 32px',
              borderRadius: 12, fontSize: 15, fontWeight: 700,
              background: 'var(--fd-cyan)', color: 'var(--fd-void)', textDecoration: 'none',
              boxShadow: '0 0 28px rgba(0,207,255,0.3)',
              transition: 'box-shadow 0.25s, transform 0.25s',
              fontFamily: "'Space Grotesk', sans-serif",
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              ⚡ {isConnected ? 'Go to Wizard' : 'Start Building'}
            </Link>
            <Link to="/tools" className="hero-cta-ghost" style={{
              padding: '13px 28px',
              borderRadius: 12, fontSize: 15, fontWeight: 600,
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(255,255,255,0.12)', textDecoration: 'none',
              transition: 'background 0.25s, border-color 0.25s, transform 0.25s',
              fontFamily: "'Space Grotesk', sans-serif",
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              Explore Tools →
            </Link>
          </div>

        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          opacity: 0.35, animation: 'hero-in 0.7s ease 1.1s both',
        }}>
          <span style={{ fontSize: 9, fontFamily: "'Space Mono',monospace",
            letterSpacing: '.12em', color: 'var(--text-muted)' }}>SCROLL</span>
          <div style={{ width: 1, height: 28, background: 'linear-gradient(to bottom, var(--fd-cyan), transparent)' }} />
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section style={{ position: 'relative', zIndex: 1 }}>
        <Reveal>
          <div style={{
            maxWidth: 1140, margin: '0 auto',
            padding: 'clamp(32px,5vw,56px) clamp(16px,4vw,2rem)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 'clamp(20px,3vw,40px)',
            borderTop: '0.5px solid rgba(255,215,0,0.07)',
            borderBottom: '0.5px solid rgba(255,215,0,0.07)',
            background: 'rgba(10,25,41,0.4)',
            backdropFilter: 'blur(8px)',
          }}>
            {[
              { val: 5,   suffix: '',     label: 'Chains Supported'    },
              { val: 8,   suffix: '-Step', label: 'Deploy Wizard'      },
              { val: 12,  suffix: '+',     label: 'Security Checks'    },
              { val: 100, suffix: '%',     label: 'On-Chain, No Proxy' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontSize: 'clamp(26px,3vw,38px)',
                  fontWeight: 800, color: 'var(--fd-cyan)', lineHeight: 1,
                  textShadow: '0 0 24px rgba(255,215,0,0.35)',
                }}>
                  <Counter to={s.val} suffix={s.suffix} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6,
                  textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: "'Space Mono',monospace" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Scanner feature ── */}
      <section style={{ maxWidth: 1140, margin: '0 auto',
        padding: 'clamp(64px,8vw,100px) clamp(16px,4vw,2rem)', position: 'relative', zIndex: 1 }}>
        <div className="scanner-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'clamp(40px,5vw,72px)', alignItems: 'center',
        }}>
          {/* Left */}
          <Reveal>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.15em',
              color: 'var(--fd-cyan)', marginBottom: 16, fontFamily: "'Space Mono',monospace",
              display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 24, height: 0.5, background: 'var(--fd-cyan)', display: 'inline-block' }} />
              Security Scanner
            </div>
            <h2 style={{
              fontFamily: "'Orbitron',sans-serif",
              fontSize: 'clamp(26px,3.5vw,44px)', fontWeight: 800,
              lineHeight: 1.15, margin: '0 0 18px',
            }}>
              Know before<br />you ape in.
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.75,
              marginBottom: 28, maxWidth: 440 }}>
              Paste any contract address. GoPlus + Honeypot.is run a full security simulation —
              honeypot detection, tax rates, LP lock status, blacklist, mint risk, and a live
              0–100 trust score. Free, no wallet needed.
            </p>
            <Link to="/tools" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 24px',
              borderRadius: 10, fontSize: 14, fontWeight: 700,
              background: 'rgba(255,215,0,0.08)', color: 'var(--fd-cyan)',
              border: '0.5px solid rgba(255,215,0,0.25)', textDecoration: 'none',
              transition: 'background 0.2s',
              fontFamily: "'Syne',sans-serif",
            }}>
              Try it free — no wallet needed
              <span>→</span>
            </Link>
          </Reveal>

          {/* Right: scan card */}
          <Reveal delay={150} style={{ position: 'relative' }}>
            <div style={{ animation: 'float 5s ease-in-out infinite' }}>
              <ScanCard />
            </div>
            {/* Glow behind card */}
            <div style={{
              position: 'absolute', inset: '-20%', zIndex: -1, pointerEvents: 'none',
              background: 'radial-gradient(ellipse, rgba(255,215,0,0.05) 0%, transparent 70%)',
            }} />
          </Reveal>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section style={{ maxWidth: 1140, margin: '0 auto',
        padding: '0 clamp(16px,4vw,2rem) clamp(64px,8vw,100px)', position: 'relative', zIndex: 1 }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.15em',
            color: 'var(--text-muted)', marginBottom: 14,
            fontFamily: "'Space Mono',monospace", display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 12 }}>
            <span style={{ display: 'inline-block', width: 32, height: 0.5, background: 'var(--border)' }} />
            Everything you need
            <span style={{ display: 'inline-block', width: 32, height: 0.5, background: 'var(--border)' }} />
          </div>
          <h2 style={{ fontFamily: "'Orbitron',sans-serif",
            fontSize: 'clamp(24px,3vw,40px)', fontWeight: 800, margin: 0 }}>
            One platform. Full stack.
          </h2>
        </Reveal>

        <div className="features-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
        }}>
          <FCard to="/app"    icon="⚡" title="Token Deploy Wizard"
            desc="8-step no-code wizard. Configure name, supply, taxes, anti-bot, and deploy directly on-chain. BSC, ETH, Arbitrum." tag="Live" />
          <FCard to="/tools"  icon="🔍" title="Security Scanner"
            desc="Full on-chain audit — honeypot, blacklist, tax sim, LP lock, owner analysis. Free, no wallet needed." tag="Free" />
          <FCard to="/migrate" icon="🔄" title="Migration Protocol"
            desc="Move holders from V1 to V2 with snapshot-based vaults. Automatic oracle, airdrop batching, on-chain verification." />
          <FCard to="/tools"  icon="🎯" title="Presale & Fairlaunch"
            desc="Deploy presale contracts with hard cap, soft cap, whitelist, and price. Auto-adds liquidity on finalise." />
          <FCard to="/tools"  icon="🪂" title="Airdrop Tool"
            desc="Batch-send tokens to hundreds of wallets from a CSV. One approve + one disperse. Fast and gas-efficient." />
          <FCard to="/tools"  icon="📢" title="Social & Community"
            desc="One-click announcement templates for Telegram, X, and Discord pre-filled with your tokenomics." />
        </div>
      </section>

      {/* ── CTA strip ── */}
      <section style={{ maxWidth: 1140, margin: '0 auto',
        padding: '0 clamp(16px,4vw,2rem) clamp(80px,10vw,120px)', position: 'relative', zIndex: 1 }}>
        <Reveal>
          <div className="cta-strip" style={{
            borderRadius: 24, padding: 'clamp(40px,5vw,72px) clamp(24px,5vw,64px)',
            textAlign: 'center', position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(135deg, #0c1f35 0%, #071525 50%, #0a1929 100%)',
            border: '0.5px solid rgba(255,215,0,0.15)',
            animation: 'border-glow 4s ease-in-out infinite',
          }}>
            {/* Decorative rings inside CTA */}
            <div style={{ position: 'absolute', top: '-60%', left: '-10%',
              width: 500, height: 500, borderRadius: '50%',
              border: '0.5px solid rgba(255,215,0,0.05)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-50%', right: '-5%',
              width: 400, height: 400, borderRadius: '50%',
              border: '0.5px solid rgba(74,144,226,0.06)', pointerEvents: 'none' }} />
            {/* Center glow */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(ellipse at 50% 50%, rgba(255,215,0,0.05) 0%, transparent 65%)' }} />

            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.15em',
                color: 'var(--text-muted)', marginBottom: 14,
                fontFamily: "'Space Mono',monospace" }}>Get started in minutes</div>
              <h2 style={{
                fontFamily: "'Orbitron',sans-serif",
                fontSize: 'clamp(22px,3.5vw,46px)', fontWeight: 900,
                margin: '0 0 16px', lineHeight: 1.15,
              }}>
                Ready to launch<br />your token?
              </h2>
              <p style={{ fontSize: 'clamp(13px,1.5vw,15px)', color: 'var(--text-muted)',
                maxWidth: 480, margin: '0 auto 36px', lineHeight: 1.75 }}>
                Connect your wallet, pick a plan, and deploy your configured token directly
                on-chain — no code, no Remix, no waiting.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/app" style={{
                  padding: 'clamp(12px,1.5vw,15px) clamp(28px,3vw,40px)',
                  borderRadius: 12, fontSize: 'clamp(14px,1.3vw,16px)', fontWeight: 800,
                  background: 'var(--fd-cyan)', color: 'var(--fd-void)', textDecoration: 'none',
                  boxShadow: '0 0 28px rgba(255,215,0,0.3)',
                  fontFamily: "'Syne',sans-serif",
                }}>
                  {isConnected ? '⚡ Go to Wizard' : '⚡ Start Deploying'}
                </Link>
                <Link to="/tools" style={{
                  padding: 'clamp(12px,1.5vw,15px) clamp(28px,3vw,32px)',
                  borderRadius: 12, fontSize: 'clamp(14px,1.3vw,16px)', fontWeight: 700,
                  background: 'transparent', color: '#fff',
                  border: '0.5px solid rgba(255,255,255,0.2)', textDecoration: 'none',
                  fontFamily: "'Syne',sans-serif",
                }}>
                  Explore Tools
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  )
}
