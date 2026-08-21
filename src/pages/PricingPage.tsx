import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { Badge, Btn } from '../components/ui-kit'
import { useAppConfig } from '../hooks/useAppConfig'
import Icon from '../components/ui-kit/Icon'
import { SERVICES, feeHeadline, feeSubline } from '../lib/services'

const TIERS = {
  starter: {
    label: 'Starter', deploys: 1,
    badge: 'cyan' as const,
    accent: 'var(--fd-cyan)',
    features: ['1 token deploy', 'All config options', 'Param export', 'Email support'],
  },
  pro: {
    label: 'Pro', deploys: 3, popular: true,
    badge: 'purple' as const,
    accent: 'var(--fd-cyan)',
    features: ['3 token deploys', 'Full tax config', 'Anti-bot suite', 'One-click deploy', 'Priority support'],
  },
  elite: {
    label: 'Elite', deploys: 999,
    badge: 'green' as const,
    accent: 'var(--fd-green)',
    features: ['Unlimited deploys', 'All chains', 'Custom tokenomics', 'Telegram bot access', 'Dedicated support'],
  },
}

const FALLBACK_PRICES: Record<string, { blin: string; native: string; label: string }> = {
  starter: { blin: '50000', native: '0.02', label: '0.02 ETH' },
  pro:     { blin: '150000', native: '0.05', label: '0.05 ETH' },
  elite:   { blin: '400000', native: '0.1',  label: '0.1 ETH'  },
}

function TierCard({
  tier, price, popular,
}: {
  tier: typeof TIERS['pro']
  price: string
  popular?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: 'var(--fd-surface)',
        border: `1px solid ${hovered ? 'var(--fd-border-cyan)' : 'var(--fd-border)'}`,
        borderRadius: 'var(--fd-radius-lg)',
        padding: '20px 18px 22px',
        transition: 'border-color 150ms ease',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>

      {/* Popular banner */}
      {popular && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          background: 'var(--fd-cyan)', color: 'var(--fd-void)',
          fontFamily: 'var(--fd-font-mono)', fontSize: 11,
          fontWeight: 700, letterSpacing: '0.08em',
          textAlign: 'center', padding: '4px 0',
        }}>
          MOST POPULAR
        </div>
      )}

      {/* Badge */}
      <div style={{
        position: 'absolute',
        top: popular ? 36 : 12,
        right: 12,
      }}>
        <Badge variant={tier.badge}>{tier.label}</Badge>
      </div>

      {popular && <div style={{ height: 22 }} />}

      {/* Name */}
      <div style={{
        fontSize: 18, fontWeight: 600,
        color: 'var(--fd-white)',
        fontFamily: 'var(--fd-font-display)',
        marginBottom: 8, marginTop: 4,
      }}>{tier.label}</div>

      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 16 }}>
        <span style={{
          fontSize: 32, fontWeight: 700,
          color: 'var(--fd-cyan)', fontFamily: 'var(--fd-font-display)', lineHeight: 1,
        }}>{price}</span>
        <span style={{ fontSize: 14, color: 'var(--fd-ghost)' }}>/deploy</span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--fd-border)', marginBottom: 14 }} />

      {/* Features */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {tier.features.map(f => (
          <div key={f} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            fontSize: 13, color: 'var(--fd-ghost)', lineHeight: 1.4,
          }}>
            <span style={{ color: 'var(--fd-green)', flexShrink: 0, marginTop: 1 }}>✓</span>
            {f}
          </div>
        ))}
      </div>

      {/* CTA */}
      <Link to="/app" style={{ textDecoration: 'none', marginTop: 20 }}>
        <Btn variant={popular ? 'primary' : 'secondary'} style={{ width: '100%', justifyContent: 'center' }}>
          Get started →
        </Btn>
      </Link>
    </div>
  )
}

export function PricingPage() {
  const { prices, features } = useAppConfig()

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
            One price, all the tools
          </h1>
          <p style={{
            fontSize: 16, color: 'var(--fd-ghost)', maxWidth: 480,
            margin: '0 auto', lineHeight: 1.7,
          }}>
            Pay once per tier. Deploy as many tokens as your plan allows.
            All features included — no subscriptions, no hidden fees.
          </p>
        </div>

        {/* Tier cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
          marginBottom: 60,
        }} className="pricing-grid">
          {(Object.entries(TIERS) as [keyof typeof TIERS, typeof TIERS['pro']][]).map(([key, tier]) => (
            <TierCard
              key={key}
              tier={tier}
              price={prices?.[key]?.label ?? FALLBACK_PRICES[key].label}
              popular={'popular' in tier}
            />
          ))}
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
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--fd-border)',
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
