import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Logo from './ui-kit/Logo'

const NAV_LINKS = [
  { label: 'Deploy',  to: '/app'      },
  { label: 'History', to: '/app'      },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Docs',    to: '/docs'     },
]

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ transition: 'transform 0.2s' }}>
      {open ? (
        <>
          <line x1="4" y1="4" x2="18" y2="18" stroke="#EEF2FF" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="18" y1="4" x2="4" y2="18" stroke="#EEF2FF" strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : (
        <>
          <line x1="3" y1="6"  x2="19" y2="6"  stroke="#EEF2FF" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="3" y1="11" x2="19" y2="11" stroke="#EEF2FF" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="3" y1="16" x2="14" y2="16" stroke="#EEF2FF" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 49,
      pointerEvents: open ? 'all' : 'none',
    }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(8,12,24,0.8)',
        backdropFilter: 'blur(6px)',
        opacity: open ? 1 : 0,
        transition: 'opacity 0.25s ease',
      }} />

      {/* Slide-down panel */}
      <div style={{
        position: 'absolute', top: 60, left: 0, right: 0,
        background: 'var(--fd-deep)',
        borderBottom: '1px solid var(--fd-border)',
        transform: open ? 'translateY(0)' : 'translateY(-12px)',
        opacity: open ? 1 : 0,
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease',
        padding: '16px 20px 24px',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {NAV_LINKS.map((l, i) => (
          <Link key={l.label} to={l.to} onClick={onClose} style={{
            display: 'block',
            padding: '13px 16px',
            borderRadius: 'var(--fd-radius)',
            textDecoration: 'none',
            fontSize: 15,
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 500,
            color: 'var(--fd-white)',
            background: 'transparent',
            border: '1px solid transparent',
            opacity: open ? 1 : 0,
            transform: open ? 'translateY(0)' : 'translateY(-8px)',
            transition: `opacity 0.25s ease ${80 + i * 50}ms, transform 0.25s ease ${80 + i * 50}ms`,
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(0,207,255,0.06)'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--fd-cyan)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--fd-white)'
          }}>
            {l.label}
          </Link>
        ))}

        <div style={{ borderTop: '1px solid var(--fd-border)', paddingTop: 16, marginTop: 8 }}>
          <ConnectButton accountStatus="full" chainStatus="none" showBalance={false} />
        </div>
      </div>
    </div>
  )
}

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(to + '/')

  return (
    <>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 60, zIndex: 50,
        background: 'var(--fd-surface)',
        borderBottom: '1px solid var(--fd-border)',
        display: 'flex', alignItems: 'center',
        padding: '0 24px',
      }}>
        <div style={{
          width: '100%', maxWidth: 1120, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16,
        }}>
          {/* Left — Logo */}
          <Link to="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <Logo size={32} variant="full" />
          </Link>

          {/* Center — desktop nav */}
          <nav style={{
            display: 'flex', alignItems: 'center', gap: 4,
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          }} className="navbar-desktop-nav">
            {NAV_LINKS.map(l => {
              const active = l.to !== '/#pricing' && l.to !== '/docs' && isActive(l.to)
              return (
                <Link key={l.label} to={l.to} style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--fd-radius-sm)',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 400,
                  color: active ? 'var(--fd-cyan)' : 'var(--fd-ghost)',
                  transition: 'color 0.15s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--fd-white)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--fd-ghost)' }}>
                  {l.label}
                </Link>
              )
            })}
          </nav>

          {/* Right — wallet + hamburger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span className="navbar-desktop-connect">
              <ConnectButton accountStatus="avatar" chainStatus="icon" showBalance={false} />
            </span>

            {/* Hamburger — mobile only */}
            <button
              className="navbar-hamburger"
              onClick={() => setDrawerOpen(v => !v)}
              style={{
                background: 'transparent',
                border: '1px solid var(--fd-border)',
                borderRadius: 'var(--fd-radius-sm)',
                width: 38, height: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
              aria-label="Toggle menu">
              <HamburgerIcon open={drawerOpen} />
            </button>
          </div>
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Responsive rules */}
      <style>{`
        .navbar-desktop-nav    { display: flex; }
        .navbar-desktop-connect{ display: flex; }
        .navbar-hamburger      { display: none; }

        @media (max-width: 720px) {
          .navbar-desktop-nav     { display: none !important; }
          .navbar-desktop-connect { display: none !important; }
          .navbar-hamburger       { display: flex !important; }
        }
      `}</style>
    </>
  )
}
