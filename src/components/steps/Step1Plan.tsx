import { useState } from 'react'
import { useWalletClient, usePublicClient, useAccount, useChainId } from 'wagmi'
import { mainnet } from 'viem/chains'
import { formatUnits, parseEther, parseUnits } from 'viem'
import { useStore } from '../../lib/store'
import { payWithBLIN, payWithNative, BLIN_ADDRESS } from '../../lib/contracts'
import { useAppConfig } from '../../hooks/useAppConfig'
import { StatusBox, Spinner, Badge, Btn } from '../ui-kit'

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

const TIER_PRICES: Record<string, string> = {
  starter: '0.02 ETH',
  pro:     '0.05 ETH',
  elite:   '0.1 ETH',
}

export function Step1Plan({ onNext }: { onNext: () => void }) {
  const { address } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { selectedTier, setSelectedTier, payMethod, setPayMethod, getUserData, upgradeTier } = useStore()
  const { prices } = useAppConfig()

  const [paying, setPaying]   = useState(false)
  const [paid, setPaid]       = useState(false)
  const [status, setStatus]   = useState('')
  const [error, setError]     = useState('')

  const user        = address ? getUserData(address) : null
  const deploysLeft = user ? (user.deploysLimit >= 999 ? '∞' : user.deploysLimit - user.deploysUsed) : 0
  const alreadyTier = user && user.tier !== 'free'
  const onMainnet   = chainId === mainnet.id
  const selTier     = TIERS[selectedTier]
  const tierCfg     = prices[selectedTier]
  const price       = {
    blin:   parseUnits(String(tierCfg.blin),   18),
    native: parseEther(String(tierCfg.native)),
    label:  tierCfg.label,
  }

  async function doPay() {
    if (!walletClient || !publicClient || !address) return
    setPaying(true); setError(''); setStatus('')
    try {
      let txHash: string
      if (payMethod === 'blin') {
        txHash = await payWithBLIN(selectedTier, walletClient as any, publicClient as any, setStatus, price.blin)
      } else {
        txHash = await payWithNative(selectedTier, walletClient as any, publicClient as any, setStatus, price.native)
      }
      upgradeTier(address, selectedTier, txHash, payMethod === 'blin' ? 'BLIN' : 'native')
      setPaid(true)
      setStatus('Tier unlocked! ✓')
      setTimeout(() => onNext(), 1000)
    } catch (e: any) {
      setError(e.message || 'Payment failed')
    }
    setPaying(false)
  }

  return (
    <div>
      {alreadyTier && (
        <StatusBox
          msg={`You're on ${user!.tier.toUpperCase()} — ${deploysLeft} deploy${deploysLeft !== 1 ? 's' : ''} remaining. You can skip payment and continue.`}
          type="ok"
        />
      )}

      {/* ── Tier card grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        margin: '24px 0',
      }} className="tier-grid">

        {(Object.entries(TIERS) as [keyof typeof TIERS, typeof TIERS['pro']][]).map(([key, tier]) => {
          const selected = selectedTier === key
          const isActive = user?.tier === key
          return (
            <TierCard
              key={key}
              tier={tier}
              price={prices[key]?.label ?? TIER_PRICES[key]}
              selected={selected}
              isActive={isActive}
              onClick={() => setSelectedTier(key)}
            />
          )
        })}
      </div>

      {/* ── Payment card ── */}
      <div style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        borderRadius: 'var(--fd-radius-lg)',
        padding: 24,
      }}>
        <div style={{
          fontSize: 15, fontWeight: 600, color: 'var(--fd-white)',
          marginBottom: 16, fontFamily: 'var(--fd-font-display)',
        }}>
          Pay to unlock <span style={{ color: 'var(--fd-cyan)' }}>{selTier.label}</span>
        </div>

        {/* Payment method pill switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--fd-slate)',
          borderRadius: 'var(--fd-radius)',
          padding: 3,
          marginBottom: 16,
        }}>
          {(['blin', 'native'] as const).map(m => (
            <button key={m}
              onClick={() => setPayMethod(m)}
              style={{
                flex: 1, padding: '8px 12px',
                borderRadius: 'calc(var(--fd-radius) - 2px)',
                border: 'none', cursor: 'pointer',
                fontFamily: 'var(--fd-font-display)', fontSize: 13, fontWeight: 600,
                background: payMethod === m ? 'var(--fd-cyan)' : 'transparent',
                color:      payMethod === m ? 'var(--fd-void)' : 'var(--fd-ghost)',
                transition: 'background 150ms ease, color 150ms ease',
                whiteSpace: 'nowrap',
              }}>
              {m === 'blin'
                ? `$BLIN · ${Number(formatUnits(price.blin, 18)).toLocaleString()} BLIN`
                : `Native · ${formatUnits(price.native, 18)} ETH/BNB`
              }
            </button>
          ))}
        </div>

        {/* BLIN info banner */}
        {payMethod === 'blin' && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--fd-radius-sm)', marginBottom: 16,
            background: 'var(--fd-cyan-ghost)', border: '1px solid var(--fd-border-cyan)',
            fontSize: 12, color: 'var(--fd-cyan)', lineHeight: 1.6,
          }}>
            <strong>$BLIN lives on Ethereum mainnet.</strong>
            {!onMainnet
              ? <span> Your wallet will be switched to mainnet automatically when you pay.</span>
              : <span> Your wallet is already on Ethereum mainnet ✓</span>
            }
            <br />
            Contract: <span style={{ fontFamily: 'var(--fd-font-mono)', fontSize: 11, opacity: 0.8 }}>{BLIN_ADDRESS}</span>
          </div>
        )}

        {/* Native info banner */}
        {payMethod === 'native' && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--fd-radius-sm)', marginBottom: 16,
            background: 'var(--fd-green-ghost)', border: '1px solid var(--fd-border-green)',
            fontSize: 12, color: 'var(--fd-green)', lineHeight: 1.6,
          }}>
            Pays in native token on your currently connected chain.
            Price is denominated in ETH-equivalent — make sure you have enough gas + value.
          </div>
        )}

        <Btn
          variant="primary"
          onClick={doPay}
          disabled={paying || paid}
          style={{ width: '100%', justifyContent: 'center', padding: '13px 22px' }}>
          {paid     ? '✓ Payment confirmed'
           : paying ? 'Processing…'
           : `Pay ${price.label} → Unlock ${selTier.label}`}
        </Btn>

        {status && <StatusBox msg={status} type={paid ? 'ok' : 'info'} />}
        {error  && <StatusBox msg={error}  type="err" />}
        {paying && <Spinner />}
      </div>

      <style>{`
        @media (max-width: 600px) {
          .tier-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

// ── TierCard ──────────────────────────────────────────────────────────────────
function TierCard({
  tier, price, selected, isActive, onClick,
}: {
  tier: typeof TIERS['pro']
  price: string
  selected: boolean
  isActive: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  const borderColor = selected
    ? 'var(--fd-border-cyan)'
    : hovered ? 'var(--fd-border-cyan)' : 'var(--fd-border)'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: 'var(--fd-surface)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--fd-radius-lg)',
        padding: '20px 18px 18px',
        cursor: 'pointer',
        transition: 'border-color 150ms ease',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>

      {/* Popular banner (Pro only) */}
      {'popular' in tier && tier.popular && (
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

      {/* Top accent bar (selected state) */}
      {selected && (
        <div style={{
          position: 'absolute',
          top: 'popular' in tier && tier.popular ? 25 : 0,
          left: 0, right: 0,
          height: 3,
          background: tier.accent,
        }} />
      )}

      {/* Badge — absolute top-right */}
      <div style={{
        position: 'absolute',
        top: 'popular' in tier && tier.popular ? 36 : 12,
        right: 12,
      }}>
        {isActive
          ? <Badge variant="green">ACTIVE</Badge>
          : <Badge variant={tier.badge}>{tier.label}</Badge>
        }
      </div>

      {/* Spacer for popular banner */}
      {'popular' in tier && tier.popular && <div style={{ height: 22 }} />}

      {/* Tier name */}
      <div style={{
        fontSize: 18, fontWeight: 600,
        color: 'var(--fd-white)',
        fontFamily: 'var(--fd-font-display)',
        marginBottom: 8, marginTop: 4,
      }}>
        {tier.label}
      </div>

      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 16 }}>
        <span style={{
          fontSize: 32, fontWeight: 700,
          color: 'var(--fd-cyan)',
          fontFamily: 'var(--fd-font-display)',
          lineHeight: 1,
        }}>{price}</span>
        <span style={{ fontSize: 14, color: 'var(--fd-ghost)' }}>/deploy</span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--fd-border)', marginBottom: 14 }} />

      {/* Feature list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
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
    </div>
  )
}
