import { useState, useEffect } from 'react'
import { useWalletClient, usePublicClient, useAccount, useChainId } from 'wagmi'
import { mainnet } from 'viem/chains'
import { parseEther, parseUnits } from 'viem'
import { useStore } from '../../lib/store'
import { payWithBLIN, payWithNative } from '../../lib/contracts'
import { quoteNative, roundNative, formatQuote, isChainPriceable, type NativeQuote } from '../../lib/priceOracle'
import { SERVICES } from '../../lib/services'
import { CHAIN_NAME } from '../../lib/wagmi'
import { StatusBox, Spinner, Btn } from '../ui-kit'
import Icon from '../ui-kit/Icon'
import ChainIcon from '../ui-kit/ChainIcon'

/** $BLIN is priced in USD too; the discount is part of the service catalogue. */
const CREATOR = SERVICES.find(s => s.key === 'creator')!
const PRICE_USD      = CREATOR.fee.kind === 'flat' ? CREATOR.fee.usd : 30
const PRICE_BLIN_USD = CREATOR.fee.kind === 'flat' ? (CREATOR.fee.blinUsd ?? PRICE_USD) : PRICE_USD

export function Step1Plan({ onNext }: { onNext: () => void }) {
  const { address } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { payMethod, setPayMethod, getUserData, addDeployCredits } = useStore()

  const [quote, setQuote]     = useState<NativeQuote | null>(null)
  const [quoteErr, setQuoteErr] = useState('')
  const [quoting, setQuoting] = useState(false)

  const [paying, setPaying] = useState(false)
  const [paid, setPaid]     = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError]   = useState('')

  const user      = address ? getUserData(address) : null
  const credits   = user ? user.deploysLimit - user.deploysUsed : 0
  const onMainnet = chainId === mainnet.id

  // Live native quote for the connected chain
  useEffect(() => {
    let cancelled = false
    if (!isChainPriceable(chainId)) {
      setQuote(null)
      setQuoteErr('No native price feed for this network yet — pay in $BLIN or switch chains.')
      return
    }
    setQuoting(true); setQuoteErr('')
    quoteNative(chainId, PRICE_USD)
      .then(q => { if (!cancelled) { setQuote(q); setQuoteErr('') } })
      .catch(e => { if (!cancelled) { setQuote(null); setQuoteErr(e.message) } })
      .finally(() => { if (!cancelled) setQuoting(false) })
    return () => { cancelled = true }
  }, [chainId])

  async function doPay() {
    if (!walletClient || !publicClient || !address) return
    setPaying(true); setError(''); setStatus('')
    try {
      let txHash: string
      let usdPaid: number

      if (payMethod === 'blin') {
        // $BLIN amount still comes from the configured token quantity
        const blinAmount = parseUnits(String(PRICE_BLIN_USD * 1000), 18)
        txHash  = await payWithBLIN('deploy', walletClient as any, publicClient as any, setStatus, blinAmount)
        usdPaid = PRICE_BLIN_USD
      } else {
        // Re-quote at the moment of charging so the rate is never stale
        const fresh = await quoteNative(chainId, PRICE_USD)
        const wei   = parseEther(String(roundNative(fresh.nativeAmount)))
        txHash  = await payWithNative('deploy', walletClient as any, publicClient as any, setStatus, wei)
        usdPaid = PRICE_USD
      }

      addDeployCredits(address, 1, txHash, payMethod === 'blin' ? 'BLIN' : 'native', usdPaid)
      setPaid(true)
      setStatus('Payment confirmed — deploy unlocked.')
      setTimeout(() => onNext(), 900)
    } catch (e: any) {
      setError(e.message || 'Payment failed')
    }
    setPaying(false)
  }

  // Already holds an unused credit — no need to pay again
  if (credits > 0 && !paid) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="tool-panel" style={{ borderColor: 'var(--fd-border-green)' }}>
          <div className="tool-head">
            <span className="tool-head__icon" style={{
              background: 'rgba(0,229,122,0.1)', borderColor: 'rgba(0,229,122,0.3)',
              color: 'var(--fd-green)',
            }}><Icon name="check" size={17} /></span>
            <div>
              <h3 className="tool-head__title">Deploy already paid for</h3>
              <p className="tool-head__sub">
                {credits} deploy{credits === 1 ? '' : 's'} remaining on this wallet
              </p>
            </div>
          </div>
          <Btn variant="primary" onClick={onNext} style={{ width: '100%', justifyContent: 'center' }}>
            Continue to deploy
            <Icon name="arrowRight" size={15} />
          </Btn>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Price ── */}
      <section className="tool-panel">
        <div className="tool-head">
          <span className="tool-head__icon"><Icon name="zap" size={17} /></span>
          <div>
            <h3 className="tool-head__title">Token deployment</h3>
            <p className="tool-head__sub">One payment, one deploy — no plans, no subscription</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
          <span style={{
            fontSize: 40, fontWeight: 800, color: 'var(--fd-cyan)',
            fontFamily: 'var(--fd-font-display)', lineHeight: 1,
          }}>${PRICE_USD}</span>
          <span style={{ fontSize: 14, color: 'var(--fd-ghost)' }}>per deploy</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--fd-ghost)', marginBottom: 16 }}>
          or <strong style={{ color: 'var(--fd-cyan)' }}>${PRICE_BLIN_USD}</strong> paying in $BLIN
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'Standard, Tax, Deflationary or Reflection token',
            'Deployed and verified on-chain from your own wallet',
            'Full tax, anti-bot and limit configuration',
            'Every free tool included — scanner, audit, airdrop, social',
          ].map(f => (
            <li key={f} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, color: 'var(--fd-ghost)' }}>
              <Icon name="check" size={14} style={{ color: 'var(--fd-green)', marginTop: 1 }} />
              {f}
            </li>
          ))}
        </ul>
      </section>

      {/* ── Payment method ── */}
      <section className="tool-panel">
        <div className="scan-section-label">Pay with</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {([
            ['blin',   '$BLIN',  `$${PRICE_BLIN_USD}`, 'Ethereum mainnet'],
            ['native', 'Native', `$${PRICE_USD}`,      CHAIN_NAME[chainId] ?? 'connected chain'],
          ] as const).map(([m, label, price, sub]) => (
            <button key={m} className="opt" aria-pressed={payMethod === m}
              onClick={() => setPayMethod(m)}>
              <span className="opt__label">{label} · {price}</span>
              <span className="opt__blurb">{sub}</span>
            </button>
          ))}
        </div>

        {payMethod === 'native' && (
          <div style={{
            padding: '11px 14px', borderRadius: 'var(--fd-radius-sm)',
            background: 'var(--fd-cyan-ghost)', border: '1px solid var(--fd-border-cyan)',
            fontSize: 12, color: 'var(--fd-ghost)', lineHeight: 1.65,
            display: 'flex', gap: 9,
          }}>
            <ChainIcon chainId={chainId} size={16} />
            <div>
              {quoteErr ? (
                <span style={{ color: 'var(--amber)' }}>{quoteErr}</span>
              ) : quote ? (
                <>
                  <strong style={{ color: 'var(--fd-white)' }}>${quote.usd}</strong> ={' '}
                  <strong style={{ color: 'var(--fd-white)' }}>{formatQuote(quote)}</strong>{' '}
                  at ${quote.usdPerNative.toLocaleString(undefined, { maximumFractionDigits: 6 })} / {quote.symbol}.
                  <br />
                  {quote.pegged
                    ? 'Native coin is USD-pegged on this network.'
                    : 'Re-quoted the moment you pay, so the USD price holds on every chain.'}
                </>
              ) : quoting ? 'Fetching the current rate…' : 'Rate unavailable.'}
            </div>
          </div>
        )}

        {payMethod === 'blin' && !onMainnet && (
          <div style={{
            padding: '11px 14px', borderRadius: 'var(--fd-radius-sm)',
            background: 'rgba(255,176,32,0.07)', border: '1px solid rgba(255,176,32,0.22)',
            fontSize: 12, color: 'var(--fd-ghost)', lineHeight: 1.65,
            display: 'flex', gap: 9,
          }}>
            <Icon name="alert" size={15} style={{ color: 'var(--amber)', marginTop: 1 }} />
            <span>$BLIN lives on Ethereum mainnet — your wallet will be asked to switch networks.</span>
          </div>
        )}
      </section>

      {/* ── Pay ── */}
      <div>
        {status && <StatusBox msg={status} type={paid ? 'ok' : 'info'} />}
        {error  && <StatusBox msg={error} type="err" />}

        {!paid && (
          <Btn variant="primary" onClick={doPay}
            disabled={paying || (payMethod === 'native' && !quote)}
            style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>
            {paying ? <Spinner /> : (
              <>
                <Icon name="coins" size={16} />
                Pay {payMethod === 'blin'
                  ? `$${PRICE_BLIN_USD} in $BLIN`
                  : quote ? formatQuote(quote) : `$${PRICE_USD}`}
              </>
            )}
          </Btn>
        )}
      </div>
    </div>
  )
}
