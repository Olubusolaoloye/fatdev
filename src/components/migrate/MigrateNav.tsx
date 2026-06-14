import { NavLink } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'

export function MigrateNav() {
  const linkStyle = (isActive: boolean): React.CSSProperties => ({
    fontSize: 13,
    fontWeight: 600,
    color: isActive ? 'var(--gold)' : 'var(--text-secondary)',
    textDecoration: 'none',
    paddingBottom: 4,
    borderBottom: isActive ? '2px solid var(--gold)' : '2px solid transparent',
    transition: 'color 0.2s, border-color 0.2s',
  })

  return (
    <header style={{
      borderBottom: '0.5px solid var(--border)',
      padding: '0 2rem',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'var(--navy)',
    }}>
      <div style={{
        maxWidth: 1100,
        margin: '0 auto',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, background: 'var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'var(--navy)', fontSize: 14, fontWeight: 800 }}>F</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 15 }}>FatDeploy</span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: 'var(--navy)',
            background: 'var(--gold)', padding: '1px 7px', borderRadius: 10,
            marginLeft: 4, letterSpacing: '0.06em',
          }}>migrate</span>
        </div>

        {/* Nav links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <NavLink to="/migrate" end style={({ isActive }) => linkStyle(isActive)}>
            Overview
          </NavLink>
          <NavLink to="/migrate/calculator" style={({ isActive }) => linkStyle(isActive)}>
            Calculator
          </NavLink>
          <NavLink to="/migrate/dashboard" style={({ isActive }) => linkStyle(isActive)}>
            Dashboard
          </NavLink>
        </nav>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <NavLink
            to="/"
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              textDecoration: 'none',
              padding: '5px 10px',
              borderRadius: 6,
              border: '0.5px solid var(--border)',
            }}
          >
            ← Deployer
          </NavLink>
          <ConnectButton accountStatus="avatar" chainStatus="icon" showBalance={false} />
        </div>
      </div>
    </header>
  )
}
