import { Link } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import Icon, { type IconName } from './ui-kit/Icon'

type Props = {
  icon?: IconName
  title: string
  blurb?: string
  /** Bullet list of what the section will do when it ships */
  bullets?: string[]
}

export default function ComingSoon({
  icon = 'construction',
  title,
  blurb = 'This section is being finalised and will be available shortly.',
  bullets = [],
}: Props) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--fd-void)', color: 'var(--fd-white)', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(80px,10vw,120px) clamp(16px,4vw,2rem) 64px',
      }}>
        <div style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>

          <div style={{
            width: 88, height: 88, borderRadius: 24, margin: '0 auto 28px',
            background: 'var(--fd-surface)', border: '1px solid var(--fd-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--fd-cyan)',
          }}><Icon name={icon} size={40} /></div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 16px', borderRadius: 20, marginBottom: 18,
            background: 'var(--fd-cyan-ghost)', border: '1px solid var(--fd-border-cyan)',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--fd-cyan)',
              animation: 'cs-pulse 2s ease-in-out infinite',
            }} />
            <span style={{
              fontSize: 11, color: 'var(--fd-cyan)', fontFamily: 'var(--fd-font-mono)',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>Coming Soon</span>
          </div>

          <h1 style={{
            fontSize: 'clamp(30px, 6vw, 48px)', fontWeight: 900, margin: '0 0 16px',
            lineHeight: 1.1, fontFamily: 'var(--fd-font-display)', color: 'var(--fd-white)',
          }}>{title}</h1>

          <p style={{
            fontSize: 15, color: 'var(--fd-ghost)', lineHeight: 1.7,
            margin: '0 auto 32px', maxWidth: 440,
          }}>{blurb}</p>

          {bullets.length > 0 && (
            <div style={{
              textAlign: 'left', background: 'var(--fd-surface)',
              border: '1px solid var(--fd-border)', borderRadius: 'var(--fd-radius-lg)',
              padding: '20px 24px', marginBottom: 32,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.12em', color: 'var(--fd-ghost)',
                fontFamily: 'var(--fd-font-mono)', marginBottom: 14,
              }}>What's shipping</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {bullets.map(b => (
                  <li key={b} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: 'var(--fd-ghost)', lineHeight: 1.6 }}>
                    <span style={{ color: 'var(--fd-cyan)', flexShrink: 0, marginTop: 1 }}>▸</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/app" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--fd-cyan)', color: 'var(--fd-void)',
              border: 'none', borderRadius: 'var(--fd-radius-sm)',
              padding: '11px 24px', fontSize: 14, fontWeight: 700,
              textDecoration: 'none', fontFamily: "'Space Grotesk', sans-serif",
            }}>Deploy a Token →</Link>
            <Link to="/tools" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--fd-surface)', color: 'var(--fd-ghost)',
              border: '1px solid var(--fd-border)', borderRadius: 'var(--fd-radius-sm)',
              padding: '11px 24px', fontSize: 14, fontWeight: 600,
              textDecoration: 'none', fontFamily: "'Space Grotesk', sans-serif",
            }}>Explore Tools</Link>
          </div>
        </div>
      </main>

      <Footer />

      <style>{`
        @keyframes cs-pulse {
          0%, 100% { opacity: 1;   transform: scale(1);   }
          50%      { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  )
}
