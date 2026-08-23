import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { Badge, Btn } from '../components/ui-kit'
import { useAppConfig } from '../hooks/useAppConfig'
import Icon from '../components/ui-kit/Icon'
import { SERVICES, feeHeadline, feeSubline } from '../lib/services'

export function PricingPage() {
  const { features } = useAppConfig()

  // A tool switched off in admin stops being advertised and billed for
  const visibleServices = SERVICES.filter(s => !s.feature || features[s.feature])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fd-void)', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{
        maxWidth: 900, margin: '0 auto',
        padding: '100px 24px 80px',
        boxSizing: 'border-box',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 14px', borderRadius: 20, marginBottom: 16,
            background: 'var(--fd-cyan-ghost)', border: '1px solid var(--fd-border-cyan)',
            fontFamily: 'var(--fd-font-mono)', fontSize: 11,
            color: 'var(--fd-cyan)', letterSpacing: '0.08em',
          }}>
            SIMPLE PRICING
          </div>
          <h1 style={{
            fontFamily: 'var(--fd-font-display)', fontWeight: 700,
            fontSize: 'clamp(28px, 5vw, 44px)',
            color: 'var(--fd-white)', margin: '0 0 14px',
          }}>
            Pay per deploy. Nothing else.
          </h1>
          <p style={{
            fontSize: 16, color: 'var(--fd-ghost)', maxWidth: 480,
            margin: '0 auto', lineHeight: 1.7,
          }}>
            No plans, no subscriptions, no monthly anything. You pay once when
            you deploy a token — every other tool below is free to use.
          </p>
        </div>

        {/* What's included */}
        <div style={{
          background: 'var(--fd-surface)',
          border: '1px solid var(--fd-border)',
          borderRadius: 'var(--fd-radius-lg)',
          padding: '32px',
          marginBottom: 40,
        }}>
          <h2 style={{
            fontFamily: 'var(--fd-font-display)', fontWeight: 700,
            fontSize: 20, color: 'var(--fd-white)', marginBottom: 6,
          }}>
            Services &amp; fees
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--fd-ghost)', margin: '0 0 22px', lineHeight: 1.6 }}>
            Every tool with its fee shown up front — no subscriptions, no hidden charges.
            USD prices are converted to the connected chain's native coin at the live rate,
            so a fee costs the same wherever you deploy.
          </p>

          <div className="svc-grid">
            {visibleServices.map(s => {
              const free = s.fee.kind === 'free'
              const sub  = feeSubline(s.fee)
              return (
                <div key={s.key} className="svc">
                  <div className="svc__head">
                    <span className="svc__icon"><Icon name={s.icon} size={18} /></span>
                    <h3 className="svc__title">{s.title}</h3>
                  </div>

                  <div className="svc__price" style={{ color: free ? 'var(--fd-green)' : 'var(--fd-white)' }}>
                    {feeHeadline(s.fee)}
                  </div>
                  {sub && <div className="svc__sub">{sub}</div>}

                  <p className="svc__desc">{s.desc}</p>

                  <Link to={s.href} className="svc__cta">
                    {s.cta}
                    <Icon name="arrowRight" size={13} />
                  </Link>
                </div>
              )
            })}
          </div>

          <div style={{
            marginTop: 18, padding: '12px 16px', borderRadius: 'var(--fd-radius)',
            background: 'var(--fd-fill)', border: '1px solid var(--fd-border)',
            fontSize: 12, color: 'var(--fd-ghost)', lineHeight: 1.7,
          }}>
            <strong style={{ color: 'var(--fd-white)' }}>How fees work.</strong>{' '}
            Prices are set in USD and converted to the native coin of whichever chain you are
            connected to, using a live rate fetched at the moment you pay — so $30 is $30 on
            every network. Free tools charge no service fee; you still pay that chain's gas.
          </div>
        </div>

        {/* Payment methods */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            display: 'inline-flex', gap: 8, alignItems: 'center',
            padding: '10px 20px',
            background: 'var(--fd-surface)', border: '1px solid var(--fd-border)',
            borderRadius: 'var(--fd-radius-lg)',
            fontSize: 13, color: 'var(--fd-ghost)',
            fontFamily: 'var(--fd-font-display)',
          }}>
            <span>Pay with</span>
            <Badge variant="cyan">$BLIN</Badge>
            <span style={{ color: 'var(--fd-hint)' }}>or</span>
            <Badge variant="green">ETH / BNB</Badge>
            <span>on any connected chain</span>
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center' }}>
          <Link to="/app" style={{ textDecoration: 'none' }}>
            <Btn variant="primary" style={{ fontSize: 15, padding: '12px 36px' }}>
              Launch App →
            </Btn>
          </Link>
          <p style={{
            marginTop: 12, fontSize: 12, color: 'var(--fd-hint)',
            fontFamily: 'var(--fd-font-mono)',
          }}>
            Connect wallet · choose plan · deploy in minutes
          </p>
        </div>
      </main>

      <Footer />

      <style>{`
        @media (max-width: 640px) {
          .pricing-grid { grid-template-columns: 1fr !important; }
          .pricing-features-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
