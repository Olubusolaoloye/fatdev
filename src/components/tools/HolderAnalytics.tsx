import { useState } from 'react'
import { useChainId } from 'wagmi'
import { useAccount } from 'wagmi'
import { useStore } from '../../lib/store'
import { CHAIN_EXPLORERS } from '../../lib/wagmi'
import {
  getTokenHolders, getTokenTransfers, getAccountFirstTx,
  formatTokenAmount, pct, shortAddr, relTime,
  type TokenHolder, type TokenTransfer,
} from '../../lib/explorer'
import { Spinner } from '../ui-kit'

const CHAIN_NAME: Record<number, string> = {
  56: 'BNB Chain', 1: 'Ethereum', 42161: 'Arbitrum', 97: 'BSC Testnet',
}

type WalletAge = { address: string; firstSeen: string | null; loading: boolean }
type Tab = 'holders' | 'transfers' | 'rewards'

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ background: `${color}18`, color, border: `0.5px solid ${color}44`,
      borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

function TrendBadge({ type }: { type: 'buy' | 'sell' | 'transfer' }) {
  if (type === 'buy')      return <Tag color="var(--green)">BUY</Tag>
  if (type === 'sell')     return <Tag color="var(--red)">SELL</Tag>
  return <Tag color="var(--text-muted)">TRANSFER</Tag>
}

export function HolderAnalytics() {
  const { address } = useAccount()
  const chainId     = useChainId()
  const { getUserData } = useStore()
  const deploys = address ? getUserData(address).deploys : []

  const [tokenAddr, setTokenAddr]   = useState('')
  const [totalSupply, setTotalSupply] = useState('')
  const [decimals, setDecimals]     = useState(18)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [tab, setTab]               = useState<Tab>('holders')

  const [holders,   setHolders]   = useState<TokenHolder[]>([])
  const [transfers, setTransfers] = useState<TokenTransfer[]>([])
  const [walletAges, setWalletAges] = useState<Record<string, WalletAge>>({})
  const [bigTxThreshold, setBigTxThreshold] = useState(1)  // % of supply

  const chainInfo = CHAIN_EXPLORERS[chainId] ?? ''

  // ── Fetch all data ──────────────────────────────────────────────────────────
  async function fetchData() {
    if (!/^0x[0-9a-fA-F]{40}$/.test(tokenAddr)) {
      setError('Enter a valid contract address'); return
    }
    setLoading(true); setError('')
    setHolders([]); setTransfers([]); setWalletAges({})

    try {
      const [h, t] = await Promise.all([
        getTokenHolders(tokenAddr, chainId),
        getTokenTransfers(tokenAddr, chainId),
      ])
      setHolders(Array.isArray(h) ? h : [])
      setTransfers(Array.isArray(t) ? t : [])

      // Infer totalSupply + decimals from holder data if available
      if (Array.isArray(t) && t.length > 0) {
        setDecimals(Number(t[0].tokenDecimal) || 18)
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  // ── Lazy-load wallet age for a single address ────────────────────────────────
  async function loadWalletAge(addr: string) {
    if (walletAges[addr]) return
    setWalletAges(prev => ({ ...prev, [addr]: { address: addr, firstSeen: null, loading: true } }))
    try {
      const txs = await getAccountFirstTx(addr, chainId)
      const firstSeen = txs?.[0]?.timeStamp ?? null
      setWalletAges(prev => ({ ...prev, [addr]: { address: addr, firstSeen, loading: false } }))
    } catch {
      setWalletAges(prev => ({ ...prev, [addr]: { address: addr, firstSeen: null, loading: false } }))
    }
  }

  // ── Classify transfer as buy / sell / transfer ───────────────────────────────
  function classifyTransfer(t: TokenTransfer): 'buy' | 'sell' | 'transfer' {
    // If from/to matches the main pair address pattern or is a DEX router, classify as buy/sell
    // Heuristic: if sender/recipient looks like a pair (not EOA pattern), it's a swap
    // Simplified: large value transfers between non-zero addresses
    if (t.from === tokenAddr.toLowerCase()) return 'buy'   // contract sending = distribution
    if (t.to   === tokenAddr.toLowerCase()) return 'sell'
    return 'transfer'
  }

  function txValue(t: TokenTransfer): number {
    try { return Number(BigInt(t.value)) / (10 ** decimals) } catch { return 0 }
  }

  const supplyNum = Number(totalSupply) || 0
  const threshold = supplyNum > 0 ? (bigTxThreshold / 100) * supplyNum : 0

  const bigTransfers = transfers.filter(t => txValue(t) >= (threshold > 0 ? threshold : 0))

  // ── Reward transfers: token sent FROM the contract address ──────────────────
  const rewardTransfers = transfers.filter(t =>
    t.from.toLowerCase() === tokenAddr.toLowerCase() &&
    t.to.toLowerCase() !== '0x000000000000000000000000000000000000dead'
  )

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'holders',   label: 'Top holders',  count: holders.length },
    { key: 'transfers', label: 'Large transfers', count: bigTransfers.length },
    { key: 'rewards',   label: 'LP rewards paid', count: rewardTransfers.length },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Token input */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Token to analyse</div>

        {deploys.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Quick-select:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {deploys.filter(d => d.contractAddress).map(d => (
                <button key={d.id} className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => { setTokenAddr(d.contractAddress!); setError('') }}>
                  {d.tokenSymbol} · {CHAIN_NAME[d.chainId] ?? d.chainId}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input className="field-input" style={{ flex: 1, fontFamily: "'Space Mono',monospace", fontSize: 12 }}
            placeholder="0x… token contract address"
            value={tokenAddr} onChange={e => { setTokenAddr(e.target.value); setError('') }} />
          <button className="btn-primary" style={{ padding: '8px 18px', fontSize: 13 }}
            onClick={fetchData} disabled={loading}>
            {loading ? '…' : 'Analyse'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total supply (for %)</label>
            <input className="field-input" style={{ width: 160, fontSize: 12, padding: '5px 10px' }}
              placeholder="e.g. 1000000000"
              value={totalSupply} onChange={e => setTotalSupply(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Big tx threshold (%)</label>
            <input className="field-input" style={{ width: 80, fontSize: 12, padding: '5px 10px' }}
              type="number" min="0.01" max="100" step="0.01"
              value={bigTxThreshold} onChange={e => setBigTxThreshold(Number(e.target.value))} />
          </div>
        </div>

        {error && <div style={{ marginTop: 8, color: 'var(--red)', fontSize: 12 }}>✗ {error}</div>}
        {loading && <div style={{ marginTop: 10 }}><Spinner /></div>}
      </div>

      {/* Summary pills */}
      {holders.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span className="pill pill-gold">{holders.length} holders loaded</span>
          <span className="pill pill-ok">{transfers.length} recent transfers</span>
          <span className="pill">{rewardTransfers.length} rewards paid</span>
          <span className="pill" style={{ background: 'rgba(255,82,82,0.1)', color: 'var(--red)' }}>
            {bigTransfers.length} large txs (&gt;{bigTxThreshold}% supply)
          </span>
        </div>
      )}

      {/* Tabs */}
      {(holders.length > 0 || transfers.length > 0) && (
        <div>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 0, borderBottom: '0.5px solid var(--border)', paddingBottom: 0 }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ padding: '8px 16px', borderRadius: '8px 8px 0 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: 'none', background: tab === t.key ? 'var(--navy-card)' : 'transparent',
                  color: tab === t.key ? 'var(--gold)' : 'var(--text-muted)',
                  borderBottom: tab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
                  marginBottom: -1 }}>
                {t.label}
                {t.count !== undefined && (
                  <span style={{ marginLeft: 6, fontSize: 11, background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '1px 5px' }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Top holders tab ── */}
          {tab === 'holders' && (
            <div className="card" style={{ borderRadius: '0 8px 8px 8px', marginTop: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Click <strong style={{ color: '#fff' }}>Check age</strong> to detect bot wallets (new wallets = potential bots).
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                      {['Rank', 'Address', 'Balance', '% Supply', 'Wallet age', ''].map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {holders.map((h, i) => {
                      const age  = walletAges[h.TokenHolderAddress.toLowerCase()]
                      const isBot = age?.firstSeen && (Date.now() - Number(age.firstSeen) * 1000) < 90 * 24 * 3600 * 1000
                      return (
                        <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontWeight: 700 }}>#{i + 1}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <a href={`${chainInfo}/address/${h.TokenHolderAddress}`} target="_blank" rel="noopener"
                              style={{ color: 'var(--blue)', fontFamily: "'Space Mono',monospace" }}>
                              {shortAddr(h.TokenHolderAddress)}
                            </a>
                          </td>
                          <td style={{ padding: '8px 10px', fontFamily: "'Space Mono',monospace" }}>
                            {formatTokenAmount(h.TokenHolderQuantity, decimals, 0)}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {totalSupply
                              ? <span style={{ fontWeight: 600, color: Number(pct(h.TokenHolderQuantity, totalSupply.replace(/,/g, '') + '0'.repeat(decimals))) > 5 ? 'var(--red)' : 'inherit' }}>
                                  {pct(h.TokenHolderQuantity, totalSupply.replace(/,/g, '') + '0'.repeat(decimals))}
                                </span>
                              : '—'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {age?.loading
                              ? <span style={{ color: 'var(--text-muted)' }}>…</span>
                              : age?.firstSeen
                                ? <span style={{ color: isBot ? 'var(--red)' : 'var(--green)' }}>
                                    {isBot ? '🤖 ' : '✓ '}
                                    {relTime(age.firstSeen)}
                                    {isBot && <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--red)' }}>new wallet</span>}
                                  </span>
                                : <span style={{ color: 'var(--text-muted)' }}>—</span>
                            }
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {!age && (
                              <button className="btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }}
                                onClick={() => loadWalletAge(h.TokenHolderAddress.toLowerCase())}>
                                Check age
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Large transfers tab ── */}
          {tab === 'transfers' && (
            <div className="card" style={{ borderRadius: '0 8px 8px 8px' }}>
              {bigTransfers.length === 0
                ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No transfers above {bigTxThreshold}% of supply. Lower the threshold or enter total supply above.</p>
                : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                        {['Type', 'When', 'From', 'To', 'Amount', 'Tx'].map(h => (
                          <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bigTransfers.slice(0, 100).map((t, i) => (
                        <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                          <td style={{ padding: '8px 10px' }}><TrendBadge type={classifyTransfer(t)} /></td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{relTime(t.timeStamp)}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <a href={`${chainInfo}/address/${t.from}`} target="_blank" rel="noopener"
                              style={{ color: 'var(--blue)', fontFamily: "'Space Mono',monospace" }}>
                              {shortAddr(t.from)}
                            </a>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <a href={`${chainInfo}/address/${t.to}`} target="_blank" rel="noopener"
                              style={{ color: 'var(--blue)', fontFamily: "'Space Mono',monospace" }}>
                              {shortAddr(t.to)}
                            </a>
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                            {txValue(t).toLocaleString('en-US', { maximumFractionDigits: 0 })} {t.tokenSymbol}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <a href={`${chainInfo}/tx/${t.hash}`} target="_blank" rel="noopener"
                              style={{ color: 'var(--blue)', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>
                              {shortAddr(t.hash)}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── LP rewards paid tab ── */}
          {tab === 'rewards' && (
            <div className="card" style={{ borderRadius: '0 8px 8px 8px' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Token transfers sent <em>from</em> the contract to holders — these are <code style={{ color: 'var(--gold)' }}>processReward()</code> distributions.
              </div>
              {rewardTransfers.length === 0
                ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No reward distributions found yet.</p>
                : (
                <>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span className="pill pill-ok">{rewardTransfers.length} payments</span>
                    <span className="pill pill-gold">
                      Total: {rewardTransfers.reduce((s, t) => s + txValue(t), 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} {rewardTransfers[0]?.tokenSymbol}
                    </span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                          {['When', 'Recipient', 'Amount', 'Tx'].map(h => (
                            <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rewardTransfers.slice(0, 100).map((t, i) => (
                          <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                            <td style={{ padding: '8px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{relTime(t.timeStamp)}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <a href={`${chainInfo}/address/${t.to}`} target="_blank" rel="noopener"
                                style={{ color: 'var(--blue)', fontFamily: "'Space Mono',monospace" }}>
                                {shortAddr(t.to)}
                              </a>
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--green)' }}>
                              +{txValue(t).toLocaleString('en-US', { maximumFractionDigits: 4 })} {t.tokenSymbol}
                            </td>
                            <td style={{ padding: '8px 10px' }}>
                              <a href={`${chainInfo}/tx/${t.hash}`} target="_blank" rel="noopener"
                                style={{ color: 'var(--blue)', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>
                                {shortAddr(t.hash)}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
