import { useState } from 'react'
import { useWalletClient, usePublicClient, useAccount, useChainId } from 'wagmi'
import { mainnet } from 'viem/chains'
import { formatUnits, parseEther, parseUnits } from 'viem'
import { useStore } from '../../lib/store'
import { payWithBLIN, payWithNative, BLIN_ADDRESS } from '../../lib/contracts'
import { useAppConfig } from '../../hooks/useAppConfig'
import { StatusBox, Spinner } from '../ui-kit'

const TIERS = {
  starter: { label: 'Starter', deploys: 1,   features: ['1 token deploy', 'All config options', 'Param export', 'Email support'] },
  pro:     { label: 'Pro',     deploys: 3,    popular: true, features: ['3 token deploys', 'Full tax config', 'Anti-bot suite', 'One-click deploy', 'Priority support'] },
  elite:   { label: 'Elite',   deploys: 999,  features: ['Unlimited deploys', 'All chains', 'Custom tokenomics', 'Telegram bot access', 'Dedicated support'] },
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

  const user         = address ? getUserData(address) : null
  const deploysLeft  = user ? (user.deploysLimit >= 999 ? '∞' : user.deploysLimit - user.deploysUsed) : 0
  const alreadyTier  = user && user.tier !== 'free'
  const onMainnet    = chainId === mainnet.id
  const selTier      = TIERS[selectedTier]
  // Build price object from Supabase config (falls back to hardcoded defaults)
  const tierCfg      = prices[selectedTier]
  const price        = {
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
    <div className="step-panel">
      {/* Existing tier notice */}
      {alreadyTier && (
        <StatusBox
          msg={`You're on ${user!.tier.toUpperCase()} — ${deploysLeft} deploy${deploysLeft !== 1 ? 's' : ''} remaining. You can skip payment and continue.`}
          type="ok"
        />
      )}

      {/* Tier cards */}
      <div className="tier-cards-grid grid-3" style={{ margin: '16px 0' }}>
        {(Object.entries(TIERS) as [string, typeof TIERS['pro']][]).map(([key, tier]) => (
          <div key={key}
            className={`tier-card card-hover ${selectedTier === key ? 'selected' : ''}`}
            onClick={() => setSelectedTier(key as any)}>
            {'popular' in tier && tier.popular && <div className="tier-badge">POPULAR</div>}
            {user?.tier === key && (
              <div className="tier-badge" style={{ background: 'var(--green)', color: 'var(--navy)' }}>ACTIVE</div>
            )}
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 2 }}>{tier.label}</div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 20, color: 'var(--gold)', fontWeight: 700, marginBottom: 2 }}>
              {prices[key as keyof typeof prices]?.label ?? '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>
              {tier.deploys >= 999 ? 'Unlimited deploys' : `${tier.deploys} deploy${tier.deploys !== 1 ? 's' : ''}`}
            </div>
            {tier.features.map(f => (
              <div key={f} style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 6, marginBottom: 3 }}>
                <span style={{ color: 'var(--green)' }}>✓</span> {f}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Payment card */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Pay to unlock {selTier.label}</div>

        {/* Method toggles */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {(['blin', 'native'] as const).map(m => (
            <button key={m} onClick={() => setPayMethod(m)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
                fontFamily: 'Syne,sans-serif', fontWeight: 600, fontSize: 12,
                background:   payMethod === m ? 'rgba(255,215,0,0.1)' : 'transparent',
                border:      `0.5px solid ${payMethod === m ? 'var(--gold)' : 'var(--border-strong)'}`,
                color:        payMethod === m ? 'var(--gold)' : 'var(--text-secondary)',
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
            padding: '10px 14px', borderRadius: 8, marginBottom: 14,
            background: 'rgba(74,144,226,0.1)', border: '0.5px solid rgba(74,144,226,0.35)',
            fontSize: 12, color: '#4A90E2', lineHeight: 1.6,
          }}>
            <strong>$BLIN lives on Ethereum mainnet.</strong>
            {!onMainnet
              ? <span> Your wallet will be switched to mainnet automatically when you pay.</span>
              : <span> Your wallet is already on Ethereum mainnet ✓</span>
            }
            <br />
            Contract: <span style={{ fontFamily: "'Space Mono',monospace", color: 'var(--gold)', fontSize: 11 }}>{BLIN_ADDRESS}</span>
          </div>
        )}

        {/* Native info banner */}
        {payMethod === 'native' && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 14,
            background: 'rgba(0,230,118,0.08)', border: '0.5px solid rgba(0,230,118,0.25)',
            fontSize: 12, color: 'var(--green)', lineHeight: 1.6,
          }}>
            Pays in native token on your currently connected chain.
            Price is denominated in ETH-equivalent — make sure you have enough gas + value.
          </div>
        )}

        <button className="btn-primary" style={{ width: '100%', padding: 13 }}
          onClick={doPay} disabled={paying || paid}>
          {paid        ? '✓ Payment confirmed'
           : paying    ? 'Processing…'
           : `Pay ${price.label} → Unlock ${selTier.label}`}
        </button>

        {status && <StatusBox msg={status} type={paid ? 'ok' : 'info'} />}
        {error  && <StatusBox msg={error}  type="err" />}
        {paying && <Spinner />}
      </div>
    </div>
  )
}
