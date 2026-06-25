import { useState } from 'react'
import { useStore } from '../../lib/store'
import { useAccount, usePublicClient, useChainId } from 'wagmi'
import { CHAIN_EXPLORERS } from '../../lib/wagmi'
import { ERC20_APPROVE_ABI } from '../../lib/airdrop'
import { Spinner } from '../ui-kit'

type Platform = 'telegram' | 'twitter' | 'discord'
type Tab = 'announcement' | 'widget'

// ── Token info used across the tool ───────────────────────────────────────────
type TokenInfo = {
  name: string; symbol: string; decimals: number; totalSupply: number
  buyTax: number; sellTax: number   // as % (e.g. 5.0)
  killBlock: boolean; walletLimit: boolean; antiSync: boolean; taxLocked: boolean
  contractAddr: string; chainId: number
}

const CHAIN_NAMES: Record<number, string> = {
  56: 'BNB Chain (BSC)', 1: 'Ethereum', 42161: 'Arbitrum One', 97: 'BSC Testnet',
}

// ── Template builders ─────────────────────────────────────────────────────────
function buildAnnouncement(platform: Platform, t: TokenInfo) {
  const explorer   = t.contractAddr ? `${CHAIN_EXPLORERS[t.chainId] ?? ''}/token/${t.contractAddr}` : ''
  const chainName  = CHAIN_NAMES[t.chainId] ?? `Chain ${t.chainId}`
  const killBlocks = t.killBlock

  if (platform === 'telegram') {
    return `🚀 *${t.name} (${t.symbol}) is now LIVE!*

🌐 Chain: ${chainName}
💰 Supply: ${t.totalSupply.toLocaleString()} ${t.symbol}

💸 *Taxes*
• Buy:  ${t.buyTax.toFixed(1)}%
• Sell: ${t.sellTax.toFixed(1)}%

🛡️ *Features*
${killBlocks      ? '• ✅ Anti-sniper kill block protection\n' : ''}${t.walletLimit    ? '• ✅ Wallet limit protection\n' : ''}${t.antiSync       ? '• ✅ Anti-SYNC protection\n' : ''}${t.taxLocked     ? '• ✅ Taxes locked forever\n' : '• ⚠️ Tax change enabled\n'}
📋 *Contract*
\`${t.contractAddr || '[contract address]'}\`

🔍 [View on Explorer](${explorer || '#'})

_Always DYOR. Not financial advice._`
  }

  if (platform === 'twitter') {
    const features = [
      killBlocks    ? '🛡️ Anti-sniper' : '',
      t.taxLocked   ? '🔒 Locked taxes' : '',
      t.walletLimit ? '💼 Wallet limit' : '',
    ].filter(Boolean).join(' | ')

    return `🚀 ${t.name} $${t.symbol} is LIVE on ${chainName}!

📊 ${t.totalSupply.toLocaleString()} supply
💸 Buy: ${t.buyTax.toFixed(1)}% | Sell: ${t.sellTax.toFixed(1)}%
${features ? features + '\n' : ''}📋 CA: ${t.contractAddr || '[address]'}
${explorer ? `🔍 ${explorer}` : ''}

#${t.symbol} #BSC #DeFi #NewToken #GEM 🔥

DYOR. NFA.`
  }

  // Discord
  return `## 🚀 ${t.name} (${t.symbol}) — Now Live!

> **Chain:** ${chainName}
> **Contract:** \`${t.contractAddr || '[address]'}\`
> **Explorer:** ${explorer || '[pending]'}

### Tokenomics
| Parameter | Value |
|-----------|-------|
| Total Supply | ${t.totalSupply.toLocaleString()} ${t.symbol} |
| Decimals | ${t.decimals} |
| Buy Tax | ${t.buyTax.toFixed(1)}% |
| Sell Tax | ${t.sellTax.toFixed(1)}% |

### Features
${killBlocks    ? `- ✅ Anti-sniper protection\n` : ''
}${t.walletLimit ? '- ✅ Max wallet limit\n' : ''
}${t.antiSync    ? '- ✅ Anti-SYNC protection\n' : ''
}${t.taxLocked   ? '- ✅ Taxes permanently locked\n' : '- ⚠️ Tax changes enabled (owner can update)\n'
}
> ⚠️ Always do your own research. This is not financial advice.`
}

function buildWidgetCode(t: TokenInfo) {
  return `<!-- FatDev Token Widget -->
<div id="fattoken-widget"
     data-contract="${t.contractAddr}"
     data-chain="${t.chainId}"
     data-name="${t.name}"
     data-symbol="${t.symbol}"
     data-supply="${t.totalSupply}"
     style="font-family:sans-serif;max-width:300px;border:1px solid var(--fd-cyan)30;border-radius:12px;
            background:#0A1929;padding:16px;color:#fff;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
    <div>
      <div style="font-weight:800;font-size:18px;">${t.name}</div>
      <div style="color:var(--fd-cyan);font-size:12px;">$${t.symbol}</div>
    </div>
    <img src="https://fatdev.io/logo.png" alt="FatDev" width="32" height="32"
         style="border-radius:6px;" onerror="this.style.display='none'"/>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
    <div style="background:rgba(255,215,0,0.08);border-radius:8px;padding:8px 10px;">
      <div style="color:rgba(255,255,255,0.5);font-size:10px;margin-bottom:2px;">Supply</div>
      <div style="font-weight:700;">${t.totalSupply.toLocaleString()}</div>
    </div>
    <div style="background:rgba(255,215,0,0.08);border-radius:8px;padding:8px 10px;">
      <div style="color:rgba(255,255,255,0.5);font-size:10px;margin-bottom:2px;">Buy / Sell Tax</div>
      <div style="font-weight:700;">${t.buyTax.toFixed(1)}% / ${t.sellTax.toFixed(1)}%</div>
    </div>
  </div>
  <div style="margin-top:10px;font-size:10px;color:rgba(255,255,255,0.3);">
    ${t.contractAddr ? t.contractAddr.slice(0, 10) + '...' + t.contractAddr.slice(-8) : 'Contract pending'}
    · Powered by <a href="https://fatdev.io" style="color:var(--fd-cyan);">FatDev</a>
  </div>
</div>`
}

// ── Component ──────────────────────────────────────────────────────────────────
export function SocialTools() {
  const { cfg, getUserData }  = useStore()
  const { address }           = useAccount()
  const chainId               = useChainId()
  const publicClient          = usePublicClient()
  const user                  = address ? getUserData(address) : null
  const deploys               = user?.deploys ?? []

  // ── Contract address input ─────────────────────────────────────────────────
  const [contractInput,  setContractInput]  = useState('')
  const [loadingToken,   setLoadingToken]   = useState(false)
  const [loadError,      setLoadError]      = useState('')
  const [source,         setSource]         = useState<'wizard' | 'custom'>('wizard')

  // ── Editable token info (defaults from wizard cfg, overridable) ────────────
  const [info, setInfo] = useState<TokenInfo>({
    name:         cfg.name,
    symbol:       cfg.symbol,
    decimals:     cfg.decimals,
    totalSupply:  Number(cfg.totalSupply),
    buyTax:       (cfg.buyFund + cfg.buyLP + cfg.buyReward + cfg.buyBurn)   / 100,
    sellTax:      (cfg.sellFund + cfg.sellLP + cfg.sellReward + cfg.sellBurn) / 100,
    killBlock:    cfg.enableKillBlock,
    walletLimit:  cfg.enableWalletLimit,
    antiSync:     cfg.antiSYNC,
    taxLocked:    !cfg.enableChangeTax,
    contractAddr: deploys[0]?.contractAddress ?? '',
    chainId,
  })

  const [tab,          setTab]          = useState<Tab>('announcement')
  const [platform,     setPlatform]     = useState<Platform>('telegram')
  const [copied,       setCopied]       = useState(false)
  const [widgetCopied, setWidgetCopied] = useState(false)

  // ── Load custom contract (pulls symbol/decimals on-chain) ─────────────────
  async function loadContract(addr: string) {
    const clean = addr.trim()
    if (!/^0x[0-9a-fA-F]{40}$/.test(clean)) { setLoadError('Enter a valid 0x contract address'); return }
    if (!publicClient) return
    setLoadingToken(true); setLoadError('')
    try {
      const [sym, dec] = await Promise.all([
        publicClient.readContract({ address: clean as `0x${string}`, abi: ERC20_APPROVE_ABI, functionName: 'symbol' }),
        publicClient.readContract({ address: clean as `0x${string}`, abi: ERC20_APPROVE_ABI, functionName: 'decimals' }),
      ])
      setInfo(i => ({ ...i, contractAddr: clean, symbol: sym as string, decimals: Number(dec), chainId, name: i.name || (sym as string) }))
      setSource('custom')
    } catch (e: any) {
      setLoadError(e.shortMessage ?? e.message ?? 'Failed to read contract')
    }
    setLoadingToken(false)
  }

  // ── Use wizard config ──────────────────────────────────────────────────────
  function useWizardConfig() {
    setInfo({
      name:         cfg.name,
      symbol:       cfg.symbol,
      decimals:     cfg.decimals,
      totalSupply:  Number(cfg.totalSupply),
      buyTax:       (cfg.buyFund + cfg.buyLP + cfg.buyReward + cfg.buyBurn)   / 100,
      sellTax:      (cfg.sellFund + cfg.sellLP + cfg.sellReward + cfg.sellBurn) / 100,
      killBlock:    cfg.enableKillBlock,
      walletLimit:  cfg.enableWalletLimit,
      antiSync:     cfg.antiSYNC,
      taxLocked:    !cfg.enableChangeTax,
      contractAddr: deploys[0]?.contractAddress ?? '',
      chainId,
    })
    setContractInput('')
    setSource('wizard')
  }

  const announcement = buildAnnouncement(platform, info)
  const widgetCode   = buildWidgetCode(info)

  async function copyText(text: string, setCop: (b: boolean) => void) {
    await navigator.clipboard.writeText(text)
    setCop(true); setTimeout(() => setCop(false), 2000)
  }

  const platformMeta: Record<Platform, { icon: string; label: string; color: string }> = {
    telegram: { icon: '✈️', label: 'Telegram',   color: '#2CA5E0' },
    twitter:  { icon: '🐦', label: 'X / Twitter', color: '#1DA1F2' },
    discord:  { icon: '🎮', label: 'Discord',     color: '#7289DA' },
  }

  // ── Inline toggle ──────────────────────────────────────────────────────────
  function BoolToggle({ field, label }: { field: keyof TokenInfo; label: string }) {
    const val = info[field] as boolean
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
        <div style={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0,
          background: val ? 'var(--fd-cyan)' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s' }}
          onClick={() => setInfo(i => ({ ...i, [field]: !val }))}>
          <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff',
            position: 'absolute', top: 2, left: val ? 18 : 2, transition: 'left 0.2s' }} />
        </div>
        {label}
      </label>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Contract address input ── */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Token contract address</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Paste any ERC-20 / BEP-20 contract to auto-fill symbol &amp; decimals, then fill in the rest below. Or use your wizard config.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="field-input"
            style={{ flex: 1, fontFamily: "'Space Mono',monospace", fontSize: 12 }}
            placeholder="0x… token contract address"
            value={contractInput}
            onChange={e => { setContractInput(e.target.value); setLoadError('') }}
            onKeyDown={e => e.key === 'Enter' && loadContract(contractInput)}
          />
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}
            onClick={() => loadContract(contractInput)} disabled={loadingToken}>
            {loadingToken ? <Spinner /> : 'Load'}
          </button>
        </div>
        {loadError && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)' }}>{loadError}</div>}

        {/* Status + quick-select */}
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {source === 'custom' && info.contractAddr && (
            <>
              <span className="pill pill-ok">✓ Custom contract</span>
              {info.symbol && <span className="pill pill-gold">{info.symbol}</span>}
            </>
          )}
          {source === 'wizard' && <span className="pill pill-gold">Using wizard config</span>}
          <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={useWizardConfig}>
            ↩ Use wizard config
          </button>
        </div>

        {/* Deploys quick-select */}
        {deploys.filter(d => d.contractAddress).length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Your FatDev deploys:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {deploys.filter(d => d.contractAddress).map(d => (
                <button key={d.contractAddress} className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={() => {
                    const deployChain = d.chainId ?? chainId
                    setInfo(i => ({ ...i, contractAddr: d.contractAddress!, chainId: deployChain,
                      name: d.tokenName ?? i.name, symbol: d.tokenSymbol ?? i.symbol,
                      decimals: d.decimals ?? i.decimals }))
                    setContractInput(d.contractAddress!)
                    setSource('custom')
                  }}>
                  {d.tokenSymbol}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Editable token info ── */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Token details for announcements</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <div className="field-label">Token name</div>
            <input className="field-input" style={{ width: '100%' }} value={info.name}
              onChange={e => setInfo(i => ({ ...i, name: e.target.value }))} />
          </div>
          <div>
            <div className="field-label">Symbol</div>
            <input className="field-input" style={{ width: '100%' }} value={info.symbol}
              onChange={e => setInfo(i => ({ ...i, symbol: e.target.value }))} />
          </div>
          <div>
            <div className="field-label">Total supply</div>
            <input type="number" className="field-input" style={{ width: '100%' }} min={0}
              value={info.totalSupply} onChange={e => setInfo(i => ({ ...i, totalSupply: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div>
            <div className="field-label">Buy tax %</div>
            <input type="number" className="field-input" style={{ width: '100%' }} min={0} max={25} step="0.1"
              value={info.buyTax} onChange={e => setInfo(i => ({ ...i, buyTax: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div>
            <div className="field-label">Sell tax %</div>
            <input type="number" className="field-input" style={{ width: '100%' }} min={0} max={25} step="0.1"
              value={info.sellTax} onChange={e => setInfo(i => ({ ...i, sellTax: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div>
            <div className="field-label">Contract address</div>
            <input className="field-input" style={{ width: '100%', fontFamily: "'Space Mono',monospace", fontSize: 11 }}
              value={info.contractAddr} onChange={e => setInfo(i => ({ ...i, contractAddr: e.target.value }))}
              placeholder="0x…" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <BoolToggle field="taxLocked"    label="Taxes locked" />
          <BoolToggle field="antiSync"     label="Anti-SYNC" />
          <BoolToggle field="killBlock"    label="Kill block / anti-sniper" />
          <BoolToggle field="walletLimit"  label="Wallet limit" />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['announcement', 'widget'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={tab === t ? 'btn-primary' : 'btn-ghost'}
            style={{ fontSize: 13, padding: '6px 18px', textTransform: 'capitalize' }}>
            {t === 'announcement' ? '📢 Announcement' : '🔲 Embed Widget'}
          </button>
        ))}
      </div>

      {/* ── Announcement tab ── */}
      {tab === 'announcement' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {(Object.keys(platformMeta) as Platform[]).map(p => (
              <button key={p} onClick={() => setPlatform(p)}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${platform === p ? platformMeta[p].color : 'var(--border)'}`,
                  background: platform === p ? `${platformMeta[p].color}20` : 'transparent',
                  color: platform === p ? platformMeta[p].color : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}>
                {platformMeta[p].icon} {platformMeta[p].label}
              </button>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: `${platformMeta[platform].color}12` }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: platformMeta[platform].color }}>
                {platformMeta[platform].icon} {platformMeta[platform].label} Preview
              </span>
              <button className="btn-primary" style={{ fontSize: 11, padding: '4px 12px' }}
                onClick={() => copyText(announcement, setCopied)}>
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
            <pre style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: '16px',
              fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.7, margin: 0,
              color: 'var(--text-secondary)', maxHeight: 480, overflowY: 'auto',
            }}>
              {announcement}
            </pre>
          </div>
        </div>
      )}

      {/* ── Widget tab ── */}
      {tab === 'widget' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(74,144,226,0.08)',
            border: '0.5px solid rgba(74,144,226,0.25)', fontSize: 12, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--blue)' }}>Embed on your website:</strong>{' '}
            Paste this HTML anywhere on your token landing page to show live stats.
            Style it further with your own CSS — all inline styles are overridable.
          </div>

          <div className="card" style={{ padding: 20, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Preview */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>PREVIEW</div>
              <div style={{ fontFamily: 'sans-serif', maxWidth: 280, border: '1px solid rgba(255,215,0,0.2)',
                borderRadius: 12, background: '#0A1929', padding: 16, color: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{info.name || 'Token Name'}</div>
                    <div style={{ color: 'var(--fd-cyan)', fontSize: 12 }}>${info.symbol || 'TKN'}</div>
                  </div>
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--fd-cyan)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, color: '#040D18', fontSize: 14 }}>F</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div style={{ background: 'rgba(255,215,0,0.08)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginBottom: 2 }}>Supply</div>
                    <div style={{ fontWeight: 700 }}>{info.totalSupply > 0 ? info.totalSupply.toLocaleString() : '—'}</div>
                  </div>
                  <div style={{ background: 'rgba(255,215,0,0.08)', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginBottom: 2 }}>Buy/Sell Tax</div>
                    <div style={{ fontWeight: 700 }}>{info.buyTax.toFixed(1)}% / {info.sellTax.toFixed(1)}%</div>
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                  {info.contractAddr ? info.contractAddr.slice(0, 10) + '...' + info.contractAddr.slice(-8) : 'Contract pending'}
                  {' '}· Powered by FatDev
                </div>
              </div>
            </div>

            {/* Embed code */}
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>EMBED CODE</div>
              <div style={{ position: 'relative' }}>
                <pre style={{
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 10.5,
                  fontFamily: "'Space Mono',monospace", lineHeight: 1.6,
                  background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 12,
                  border: '0.5px solid var(--border)', maxHeight: 260, overflowY: 'auto',
                  color: 'var(--text-secondary)', margin: 0,
                }}>
                  {widgetCode}
                </pre>
                <button className="btn-primary"
                  style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, padding: '3px 10px' }}
                  onClick={() => copyText(widgetCode, setWidgetCopied)}>
                  {widgetCopied ? '✓' : '📋'}
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>💡 Enhance the widget</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              The static widget above works out-of-the-box. To add <strong style={{ color: '#fff' }}>live price &amp; holder data</strong>,
              wire up the widget's <code style={{ color: 'var(--fd-cyan)', fontSize: 11 }}>data-contract</code> to the
              BSCScan/Etherscan API (same key used by FatDev: <code style={{ color: 'var(--fd-cyan)', fontSize: 11 }}>BHPP1DMU8YABI4Y9MV7PUGATK49IKR8D3F</code>).
              Call <code style={{ color: 'var(--fd-cyan)', fontSize: 11 }}>tokenholderlist</code> for holder count
              and <code style={{ color: 'var(--fd-cyan)', fontSize: 11 }}>tokentx</code> for recent activity.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
