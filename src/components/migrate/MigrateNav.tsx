import { NavLink, Link } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Logo from '../ui-kit/Logo'

export function MigrateNav() {
  const linkStyle = (isActive: boolean): React.CSSProperties => ({
    fontSize: 13,
    fontWeight: 600,
    color: isActive ? 'var(--fd-cyan)' : 'var(--text-secondary)',
    textDecoration: 'none',
    paddingBottom: 4,
    borderBottom: isActive ? '2px solid var(--fd-cyan)' : '2px solid transparent',
    transition: 'color 0.2s, border-color 0.2s',
  })

  return (
    <header style={{
      borderBottom: '0.5px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'var(--fd-void)',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem' }}>

        {/* Top row: brand + actions */}
        <div style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          {/* Brand */}
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Logo size={28} variant="full" />
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'var(--fd-void)',
              background: 'var(--fd-cyan)', padding: '1px 7px', borderRadius: 10,
              letterSpacing: '0.06em',
            }}>migrate</span>
          </Link>

          {/* Right: deployer link + connect */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <NavLink
              to="/"
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                textDecoration: 'none',
                padding: '4px 8px',
                borderRadius: 6,
                border: '0.5px solid var(--border)',
                whiteSpace: 'nowrap',
              }}
            >
              ← Deployer
            </NavLink>
            <ConnectButton accountStatus="avatar" chainStatus="icon" showBalance={false} />
          </div>
        </div>

        {/* Bottom row: nav tabs */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          overflowX: 'auto',
          paddingBottom: 1,
          scrollbarWidth: 'none',
        }}>
          <NavLink to="/migrate" end style={({ isActive }) => linkStyle(isActive)}>Overview</NavLink>
          <NavLink to="/migrate/calculator" style={({ isActive }) => linkStyle(isActive)}>Calculator</NavLink>
          <NavLink to="/migrate/dashboard" style={({ isActive }) => linkStyle(isActive)}>Dashboard</NavLink>
        </nav>

      </div>
    </header>
  )
}
