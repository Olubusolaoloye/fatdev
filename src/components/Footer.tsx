import { Link } from 'react-router-dom'
import Logo from './ui-kit/Logo'

const FOOTER_LINKS = [
  { label: 'Deploy',    to: '/app'       },
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Bridge',    to: '/bridge'    },
  { label: 'Tools',     to: '/tools'     },
  { label: 'Migrate',   to: '/migrate'   },
  { label: 'Pricing',   to: '/pricing'   },
]

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--fd-border)',
      background: 'var(--fd-surface)',
      padding: '40px 24px 28px',
      marginTop: 'auto',
    }}>
      <div style={{
        maxWidth: 1120, margin: '0 auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
      }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none' }}>
          <Logo size={30} variant="full" />
        </Link>

        {/* Nav links */}
        <nav style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {FOOTER_LINKS.map(l => (
            <Link key={l.label} to={l.to} style={{
              fontSize: 13, color: 'var(--fd-ghost)', textDecoration: 'none',
              padding: '5px 12px', borderRadius: 'var(--fd-radius-sm)',
              fontFamily: "'Space Grotesk', sans-serif",
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--fd-cyan)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--fd-ghost)' }}>
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Tagline + copyright */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{
            fontSize: 12, color: 'var(--fd-hint)',
            fontFamily: "'Space Mono', monospace",
            margin: 0, letterSpacing: '0.04em',
          }}>
            No-code BEP-20 / ERC-20 token deployer · Not financial advice
          </p>
          <p style={{
            fontSize: 11, color: 'var(--fd-hint)',
            fontFamily: "'Space Grotesk', sans-serif",
            margin: 0, opacity: 0.6,
          }}>
            © {new Date().getFullYear()} FatDev. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
