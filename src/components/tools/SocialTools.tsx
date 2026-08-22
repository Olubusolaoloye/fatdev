import { useState, useMemo } from 'react'
import { useStore } from '../../lib/store'
import { useAccount, usePublicClient, useChainId } from 'wagmi'
import { CHAIN_NAME } from '../../lib/wagmi'
import { ecosystemOf } from '../../lib/ecosystems'
import { resolveToken } from '../../lib/chainDetect'
import {
  generatePost, variantCount, POST_KINDS, TONES,
  type Platform, type Tone, type PostKind, type TokenFacts,
} from '../../lib/socialContent'
import { Spinner } from '../ui-kit'
import Icon, { type IconName } from '../ui-kit/Icon'
import ChainIcon from '../ui-kit/ChainIcon'

type Tab = 'content' | 'widget'

const PLATFORMS: { id: Platform; label: string; icon: IconName }[] = [
  { id: 'telegram', label: 'Telegram', icon: 'send' },
  { id: 'twitter',  label: 'X',        icon: 'megaphone' },
  { id: 'discord',  label: 'Discord',  icon: 'users' },
]

// ── Embeddable widget ─────────────────────────────────────────────────────────
function buildWidgetCode(t: TokenFacts) {
  return `<!-- FatDev Token Widget -->
<div id="fattoken-widget"
     data-contract="${t.contractAddr}"
     data-chain="${t.chainId}"
     style="font-family:system-ui,sans-serif;max-width:320px;border:1px solid #00CFFF33;
            border-radius:14px;background:#0A1929;padding:18px;color:#EEF2FF;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
    <div>
      <div style="font-weight:800;font-size:18px;">${t.name || 'Token'}</div>
      <div style="color:#00CFFF;font-size:12px;">$${t.symbol || 'SYMBOL'}</div>
    </div>
    <img src="https://fatdev.org/logo.png" alt="FatDev" width="32" height="32"
         style="border-radius:7px;" onerror="this.style.display='none'"/>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
    <div style="background:#00CFFF14;border-radius:9px;padding:9px 11px;">
      <div style="color:#8A9BC2;font-size:10px;margin-bottom:3px;">Supply</div>
      <div style="font-weight:700;">${t.totalSupply.toLocaleString()}</div>
    </div>
    <div style="background:#00CFFF14;border-radius:9px;padding:9px 11px;">
      <div style="color:#8A9BC2;font-size:10px;margin-bottom:3px;">Buy / Sell Tax</div>
      <div style="font-weight:700;">${t.buyTax.toFixed(1)}% / ${t.sellTax.toFixed(1)}%</div>
    </div>
  </div>
  <div style="margin-top:11px;font-size:10px;color:#8A9BC299;">
    ${t.contractAddr ? t.contractAddr.slice(0, 10) + '…' + t.contractAddr.slice(-8) : 'Contract pending'}
    · Powered by <a href="https://fatdev.org" style="color:#00CFFF;">FatDev</a>
  </div>
</div>`
}

// ── Component ─────────────────────────────────────────────────────────────────
export function SocialTools() {
  const { cfg, getUserData } = useStore()
  const { address }   = useAccount()
  const chainId       = useChainId()
  const publicClient  = usePublicClient()
  const user          = address ? getUserData(address) : null
  const deploys       = user?.deploys ?? []

  const [tab, setTab] = useState<Tab>('content')

  // ── Token facts ─────────────────────────────────────────────────────────────
  const [facts, setFacts] = useState<TokenFacts>({
    name: cfg.name, symbol: cfg.symbol, decimals: cfg.decimals,
    totalSupply: Number(cfg.totalSupply) || 0,
    buyTax: cfg.buyTax / 100, sellTax: cfg.sellTax / 100,
    contractAddr: deploys[0]?.contractAddress ?? '',
    chainId,
    taxLocked: true,
  })

  const [contractInput, setContractInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  // ── Composer state ──────────────────────────────────────────────────────────
  const [kind, setKind]         = useState<PostKind>('launch')
  const [tone, setTone]         = useState<Tone>('hype')
  const [platform, setPlatform] = useState<Platform>('telegram')
  const [variant, setVariant]   = useState(0)
  const [copied, setCopied]     = useState<string | null>(null)

  const post = useMemo(
    () => generatePost(kind, platform, tone, facts, variant),
    [kind, platform, tone, facts, variant]
  )
  const widgetCode = useMemo(() => buildWidgetCode(facts), [facts])

  async function copy(text: string, tag: string) {
    await navigator.clipboard.writeText(text)
    setCopied(tag)
    setTimeout(() => setCopied(c => (c === tag ? null : c)), 1800)
  }

  async function loadContract(addr: string) {
    const clean = addr.trim()
    if (!publicClient) return
    setLoading(true); setLoadError('')
    try {
      // Resolve against the chain the token actually lives on, not whichever
      // network the wallet happens to be connected to.
      const t = await resolveToken(clean)
      setFacts(f => ({
        ...f, contractAddr: t.address, chainId: t.chainId,
        symbol: t.symbol, decimals: t.decimals,
        name: t.name || f.name || t.symbol,
      }))
    } catch (e: any) {
      setLoadError(e.shortMessage ?? e.message ?? 'Failed to read contract')
    }
    setLoading(false)
  }

  const variants = variantCount(kind, tone)
  // Buy/sell tax is an EVM-token concept — offering the fields on a Solana mint
  // invites users to type numbers that then appear in posts as fact.
  const hasTax = ecosystemOf(facts.chainId) === 'evm'

  return (
    <div className="step-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Tabs ── */}
      <div className="seg" style={{ alignSelf: 'flex-start' }}>
        {([['content', 'Content', 'megaphone'], ['widget', 'Website widget', 'code']] as const).map(([id, label, ic]) => (
          <button key={id} className="seg__btn" aria-pressed={tab === id}
            onClick={() => setTab(id as Tab)}>
            <Icon name={ic as IconName} size={14} />{label}
          </button>
        ))}
      </div>

      {/* ── Token facts ── */}
      <section className="tool-panel">
        <div className="tool-head">
          <span className="tool-head__icon"><Icon name="coins" size={17} /></span>
          <div>
            <h3 className="tool-head__title">Token details</h3>
            <p className="tool-head__sub">Every post is built from these — nothing left as a placeholder</p>
          </div>
        </div>

        {deploys.filter(d => d.contractAddress).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--fd-ghost)', marginBottom: 7 }}>From your deploys:</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {deploys.filter(d => d.contractAddress).map(d => (
                <button key={d.id} className="btn-ghost" style={{ fontSize: 11, padding: '4px 11px' }}
                  onClick={() => setFacts(f => ({
                    ...f, contractAddr: d.contractAddress!, symbol: d.tokenSymbol,
                    name: d.tokenName ?? f.name, chainId: d.chainId ?? f.chainId,
                  }))}>
                  {d.tokenSymbol}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 9, marginBottom: 14, flexWrap: 'wrap' }}>
          <input className="field-input"
            style={{ flex: 1, minWidth: 220, fontFamily: 'var(--fd-font-mono)', fontSize: 12.5 }}
            placeholder="EVM 0x… · Solana mint · Sui coin type — detected automatically"
            value={contractInput}
            onChange={e => { setContractInput(e.target.value); setLoadError('') }}
            onKeyDown={e => e.key === 'Enter' && loadContract(contractInput)} />
          <button className="btn-primary" onClick={() => loadContract(contractInput)} disabled={loading}
            style={{ padding: '9px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            {loading ? <Spinner /> : <><Icon name="download" size={14} />Load</>}
          </button>
        </div>
        {loadError && (
          <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{loadError}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          {([
            ['Name',     facts.name,               (v: string) => setFacts(f => ({ ...f, name: v })),            'text'],
            ['Symbol',   facts.symbol,             (v: string) => setFacts(f => ({ ...f, symbol: v.toUpperCase() })), 'text'],
            ['Supply',   String(facts.totalSupply), (v: string) => setFacts(f => ({ ...f, totalSupply: Number(v) || 0 })), 'number'],
            ...(hasTax ? [
              ['Buy tax %',  String(facts.buyTax),   (v: string) => setFacts(f => ({ ...f, buyTax: Number(v) || 0 })),  'number'],
              ['Sell tax %', String(facts.sellTax),  (v: string) => setFacts(f => ({ ...f, sellTax: Number(v) || 0 })), 'number'],
            ] as const : []),
          ] as const).map(([label, value, onChange, type]: any) => (
            <label key={label} style={{ display: 'block' }}>
              <span className="field-label">{label}</span>
              <input className="field-input" type={type} value={value}
                onChange={e => onChange(e.target.value)} style={{ width: '100%' }} />
            </label>
          ))}
        </div>

        <div style={{
          marginTop: 12, fontSize: 11.5, color: 'var(--fd-ghost)',
          display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap',
        }}>
          <ChainIcon chainId={facts.chainId} size={14} />
          {CHAIN_NAME[facts.chainId] ?? `Chain ${facts.chainId}`}
          {facts.contractAddr && (
            <>
              <span style={{ opacity: 0.5 }}>·</span>
              <code style={{ fontFamily: 'var(--fd-font-mono)' }}>
                {facts.contractAddr.slice(0, 10)}…{facts.contractAddr.slice(-6)}
              </code>
            </>
          )}
        </div>
      </section>

      {tab === 'content' ? (
        <>
          {/* ── Post kind ── */}
          <section>
            <div className="scan-section-label">What are you posting?</div>
            <div className="opt-grid">
              {POST_KINDS.map(k => (
                <button key={k.kind} className="opt" aria-pressed={kind === k.kind}
                  onClick={() => { setKind(k.kind); setVariant(0) }}>
                  <span className="opt__label">{k.label}</span>
                  <span className="opt__blurb">{k.blurb}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ── Tone ── */}
          <section>
            <div className="scan-section-label">Tone of voice</div>
            <div className="opt-grid">
              {TONES.map(t => (
                <button key={t.tone} className="opt" aria-pressed={tone === t.tone}
                  onClick={() => { setTone(t.tone); setVariant(0) }}>
                  <span className="opt__label">{t.label}</span>
                  <span className="opt__blurb">{t.blurb}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ── Output ── */}
          <section>
            <div className="scan-section-label">Your post</div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 10, marginBottom: 11, flexWrap: 'wrap',
            }}>
              <div className="seg">
                {PLATFORMS.map(p => (
                  <button key={p.id} className="seg__btn" aria-pressed={platform === p.id}
                    onClick={() => setPlatform(p.id)}>
                    <Icon name={p.icon} size={14} />{p.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {variants > 1 && (
                  <button className="btn-ghost"
                    onClick={() => setVariant(v => (v + 1) % variants)}
                    style={{ fontSize: 12, padding: '7px 13px', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <Icon name="refresh" size={14} />Reword
                  </button>
                )}
                <button className="btn-primary"
                  onClick={() => copy(post.text, 'post')}
                  style={{ fontSize: 12.5, padding: '7px 15px', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <Icon name={copied === 'post' ? 'check' : 'copy'} size={14} />
                  {copied === 'post' ? 'Copied' : 'Copy post'}
                </button>
              </div>
            </div>

            <div className="preview">{post.text}</div>

            <div className="preview__meta">
              <span style={{ fontSize: 11.5, color: 'var(--fd-ghost)' }}>
                {platform === 'telegram' && 'Telegram markdown — paste straight into your channel'}
                {platform === 'twitter'  && 'Plain text with hashtags — ready for X'}
                {platform === 'discord'  && 'Discord markdown — headings and tables render natively'}
              </span>
              {platform === 'twitter' && (
                <span className={`preview__count${post.overLimit ? ' preview__count--over' : ''}`}>
                  {post.charCount} / 280
                  {post.overLimit && ' — too long, trim before posting'}
                </span>
              )}
            </div>
          </section>
        </>
      ) : (
        /* ── Widget tab ── */
        <section>
          <div className="scan-section-label">Embeddable widget</div>
          <p style={{ fontSize: 12.5, color: 'var(--fd-ghost)', lineHeight: 1.6, margin: '0 0 12px' }}>
            Drop this into any website to show live token details. Self-contained HTML —
            no script tag, no external dependency.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button className="btn-primary" onClick={() => copy(widgetCode, 'widget')}
              style={{ fontSize: 12.5, padding: '7px 15px', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Icon name={copied === 'widget' ? 'check' : 'copy'} size={14} />
              {copied === 'widget' ? 'Copied' : 'Copy embed code'}
            </button>
          </div>
          <div className="preview">{widgetCode}</div>
        </section>
      )}
    </div>
  )
}
