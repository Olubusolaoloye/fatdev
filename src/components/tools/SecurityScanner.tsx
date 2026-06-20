import { useState } from 'react'

// ── Chain config ──────────────────────────────────────────────────────────────
const CHAINS = [
  { id: '56',    label: 'BNB Chain',    short: 'BSC'  },
  { id: '1',     label: 'Ethereum',     short: 'ETH'  },
  { id: '42161', label: 'Arbitrum One', short: 'ARB'  },
  { id: '8453',  label: 'Base',         short: 'BASE' },
  { id: '137',   label: 'Polygon',      short: 'MATIC'},
]

// ── Types ─────────────────────────────────────────────────────────────────────
type Flag = { label: string; ok: boolean; value?: string; critical?: boolean }
type ScanResult = {
  name: string
  symbol: string
  score: number          // 0–100
  flags: Flag[]
  buyTax: number
  sellTax: number
  holders: number
  lpLocked: boolean
  lpPercent: number
  ownerAddress: string
  ownerRenounced: boolean
  totalSupply: string
  isHoneypot: boolean
  honeypotReason?: string
  raw: any
}

// ── GoPlus API ────────────────────────────────────────────────────────────────
async function fetchGoPlus(address: string, chainId: string): Promise<any> {
  const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address.toLowerCase()}`
  const res = await fetch(url)
  const json = await res.json()
  if (json.code !== 1) throw new Error(json.message || 'GoPlus API error')
  return Object.values(json.result)[0]
}

// ── Honeypot.is API ───────────────────────────────────────────────────────────
async function fetchHoneypot(address: string, chainId: string): Promise<any> {
  const chainMap: Record<string, string> = { '56': '56', '1': '1', '137': '137', '8453': '8453', '42161': '42161' }
  const cid = chainMap[chainId] || chainId
  const res = await fetch(`https://api.honeypot.is/v2/IsHoneypot?address=${address}&chainID=${cid}`)
  return res.json()
}

// ── Build result from raw data ────────────────────────────────────────────────
function buildResult(gp: any, hp: any): ScanResult {
  const pct = (v: any) => v ? Math.round(parseFloat(v) * 100) : 0
  const bool = (v: any) => v === '1' || v === 1 || v === true

  const buyTax  = hp?.simulationResult?.buyTax  ?? pct(gp?.buy_tax)
  const sellTax = hp?.simulationResult?.sellTax ?? pct(gp?.sell_tax)
  const isHoneypot = hp?.honeypotResult?.isHoneypot ?? false

  // LP analysis
  const lpHolders: any[] = gp?.lp_holders ?? []
  const totalLp = lpHolders.reduce((s: number, h: any) => s + parseFloat(h.percent || '0'), 0)
  const lockedLp = lpHolders
    .filter((h: any) => bool(h.is_locked) || h.tag?.toLowerCase().includes('lock'))
    .reduce((s: number, h: any) => s + parseFloat(h.percent || '0'), 0)
  const lpPercent = totalLp > 0 ? Math.round((lockedLp / totalLp) * 100) : 0
  const lpLocked  = lpPercent >= 80

  // Ownership
  const ownerAddress   = gp?.owner_address ?? gp?.creator_address ?? '—'
  const ownerRenounced = bool(gp?.owner_address === '0x0000000000000000000000000000000000000000') ||
    bool(gp?.owner_change_balance === '0') && ownerAddress.toLowerCase().includes('dead') ||
    ownerAddress === '0x0000000000000000000000000000000000000000'

  // Flags
  const flags: Flag[] = [
    { label: 'Honeypot',         ok: !isHoneypot,              critical: true                       },
    { label: 'Mintable',         ok: !bool(gp?.is_mintable),   critical: true                       },
    { label: 'Proxy Contract',   ok: !bool(gp?.is_proxy),      critical: true                       },
    { label: 'Blacklist',        ok: !bool(gp?.is_blacklisted) && !bool(gp?.is_whitelisted), critical: true },
    { label: 'Self Destruct',    ok: !bool(gp?.selfdestruct)                                         },
    { label: 'External Call',    ok: !bool(gp?.external_call)                                        },
    { label: 'Trading Pausable', ok: !bool(gp?.transfer_pausable)                                    },
    { label: 'Tax Modifiable',   ok: !bool(gp?.slippage_modifiable)                                  },
    { label: 'Ownership Safe',   ok: ownerRenounced || bool(gp?.owner_change_balance === '0')        },
    { label: 'LP Locked',        ok: lpLocked,                  value: lpPercent > 0 ? `${lpPercent}%` : '?' },
    { label: 'Open Source',      ok: bool(gp?.is_open_source)                                        },
    { label: 'Honeypot Same Creator', ok: !bool(gp?.honeypot_with_same_creator)                      },
  ]

  // Score: start 100, deduct per bad flag
  const weights: Record<string, number> = {
    'Honeypot': 40, 'Mintable': 15, 'Proxy Contract': 15, 'Blacklist': 10,
    'Self Destruct': 8, 'External Call': 5, 'Trading Pausable': 5,
    'Tax Modifiable': 3, 'Ownership Safe': 5, 'LP Locked': 5,
    'Open Source': 5, 'Honeypot Same Creator': 4,
  }
  const deduction = flags.reduce((d, f) => d + (f.ok ? 0 : (weights[f.label] ?? 3)), 0)
  const score = Math.max(0, Math.min(100, 100 - deduction))

  return {
    name:  gp?.token_name    ?? 'Unknown',
    symbol: gp?.token_symbol ?? '???',
    score,
    flags,
    buyTax,
    sellTax,
    holders:  parseInt(gp?.holder_count ?? '0'),
    lpLocked,
    lpPercent,
    ownerAddress,
    ownerRenounced,
    totalSupply: gp?.total_supply ?? '—',
    isHoneypot,
    honeypotReason: hp?.honeypotResult?.honeypotReason,
    raw: { gp, hp },
  }
}

// ── Score ring SVG ────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const R = 54
  const circ = 2 * Math.PI * R
  const dash = (score / 100) * circ
  const color = score >= 80 ? 'var(--green)' : score >= 55 ? 'var(--gold)' : 'var(--red)'
  const label = score >= 80 ? 'SAFE' : score >= 55 ? 'CAUTION' : 'DANGER'

  return (
    <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        {/* Track */}
        <circle cx={70} cy={70} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
        {/* Progress */}
        <circle cx={70} cy={70} r={R} fill="none"
          stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: 'stroke-dasharray 1s ease' }}
        />
        {/* Glow dots */}
        <circle cx={70} cy={70} r={38} fill="rgba(255,215,0,0.03)" />
        <circle cx={70} cy={70} r={26} fill="rgba(0,0,0,0.4)" />
      </svg>
      {/* Center text */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 28, fontWeight: 700,
          color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em',
          color, marginTop: 2 }}>{label}</span>
      </div>
    </div>
  )
}

// ── Scanning animation ────────────────────────────────────────────────────────
function ScanAnimation() {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
      <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 24px' }}>
        <svg width={120} height={120} viewBox="0 0 120 120">
          <circle cx={60} cy={60} r={50} fill="none" stroke="rgba(255,215,0,0.08)" strokeWidth={1} />
          <circle cx={60} cy={60} r={36} fill="none" stroke="rgba(255,215,0,0.12)" strokeWidth={1} />
          <circle cx={60} cy={60} r={22} fill="none" stroke="rgba(255,215,0,0.18)" strokeWidth={1} />
          {/* Rotating sweep */}
          <g style={{ transformOrigin: '60px 60px', animation: 'spin 1.5s linear infinite' }}>
            <line x1={60} y1={60} x2={60} y2={12} stroke="var(--gold)" strokeWidth={2}
              strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px var(--gold))' }} />
            <circle cx={60} cy={12} r={3} fill="var(--gold)"
              style={{ filter: 'drop-shadow(0 0 6px var(--gold))' }} />
          </g>
          <circle cx={60} cy={60} r={4} fill="var(--gold)"
            style={{ filter: 'drop-shadow(0 0 8px var(--gold))' }} />
        </svg>
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Scanning contract…</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Querying GoPlus + Honeypot.is security APIs
      </div>
    </div>
  )
}

// ── Flag row ─────────────────────────────────────────────────────────────────
function FlagRow({ flag }: { flag: Flag }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 14px', borderRadius: 8,
      background: flag.ok
        ? 'rgba(0,230,118,0.04)'
        : flag.critical
          ? 'rgba(255,82,82,0.08)'
          : 'rgba(255,215,0,0.05)',
      border: `0.5px solid ${flag.ok
        ? 'rgba(0,230,118,0.15)'
        : flag.critical
          ? 'rgba(255,82,82,0.25)'
          : 'rgba(255,215,0,0.15)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 18, height: 18, borderRadius: '50%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800,
          background: flag.ok ? 'rgba(0,230,118,0.2)' : flag.critical ? 'rgba(255,82,82,0.2)' : 'rgba(255,215,0,0.15)',
          color: flag.ok ? 'var(--green)' : flag.critical ? 'var(--red)' : 'var(--gold)',
          flexShrink: 0,
        }}>
          {flag.ok ? '✓' : '✗'}
        </span>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{flag.label}</span>
        {!flag.ok && flag.critical && (
          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 20, background: 'rgba(255,82,82,0.2)',
            color: 'var(--red)', fontWeight: 700, letterSpacing: '.06em' }}>CRITICAL</span>
        )}
      </div>
      {flag.value && (
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: flag.ok ? 'var(--green)' : 'var(--gold)' }}>
          {flag.value}
        </span>
      )}
    </div>
  )
}

// ── Tax bar ───────────────────────────────────────────────────────────────────
function TaxMeter({ label, pct }: { label: string; pct: number }) {
  const color = pct <= 5 ? 'var(--green)' : pct <= 15 ? 'var(--gold)' : 'var(--red)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 13, color, fontWeight: 700 }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, background: color,
          width: `${Math.min(100, pct * 4)}%`,
          boxShadow: `0 0 8px ${color}`,
          transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function SecurityScanner() {
  const [address,  setAddress]  = useState('')
  const [chainId,  setChainId]  = useState('56')
  const [scanning, setScanning] = useState(false)
  const [result,   setResult]   = useState<ScanResult | null>(null)
  const [error,    setError]    = useState('')

  async function scan() {
    const addr = address.trim()
    if (!addr.startsWith('0x') || addr.length !== 42) {
      setError('Enter a valid contract address (0x…)')
      return
    }
    setScanning(true); setError(''); setResult(null)
    try {
      const [gp, hp] = await Promise.allSettled([
        fetchGoPlus(addr, chainId),
        fetchHoneypot(addr, chainId),
      ])
      const gpData = gp.status === 'fulfilled' ? gp.value : null
      const hpData = hp.status === 'fulfilled' ? hp.value : null
      if (!gpData && !hpData) throw new Error('Both APIs failed. Check address and chain.')
      setResult(buildResult(gpData ?? {}, hpData ?? {}))
    } catch (e: any) {
      setError(e.message || 'Scan failed')
    }
    setScanning(false)
  }

  const score = result?.score ?? 0
  const scoreColor = score >= 80 ? 'var(--green)' : score >= 55 ? 'var(--gold)' : 'var(--red)'

  return (
    <div className="step-panel">

      {/* ── Input card ── */}
      <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, #0a1929 0%, #071525 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,215,0,0.1)',
            border: '0.5px solid rgba(255,215,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 16 }}>🛡️</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Token Security Scanner</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Powered by GoPlus Security + Honeypot.is
            </div>
          </div>
        </div>

        {/* Chain selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {CHAINS.map(c => (
            <button key={c.id} onClick={() => setChainId(c.id)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                border: `0.5px solid ${chainId === c.id ? 'var(--gold)' : 'var(--border)'}`,
                background: chainId === c.id ? 'rgba(255,215,0,0.15)' : 'transparent',
                color: chainId === c.id ? 'var(--gold)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}>
              {c.short}
            </button>
          ))}
        </div>

        {/* Address input */}
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="field-input"
            placeholder="0x… contract address"
            value={address}
            onChange={e => { setAddress(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && !scanning && scan()}
            style={{ flex: 1, fontFamily: "'Space Mono',monospace", fontSize: 13 }}
          />
          <button className="btn-primary" onClick={scan} disabled={scanning}
            style={{ padding: '10px 20px', whiteSpace: 'nowrap', minWidth: 100 }}>
            {scanning ? 'Scanning…' : '⚡ Scan'}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red)',
            background: 'rgba(255,82,82,0.08)', border: '0.5px solid rgba(255,82,82,0.25)',
            padding: '8px 12px', borderRadius: 8 }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Scanning animation ── */}
      {scanning && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #0a1929 0%, #071525 100%)' }}>
          <ScanAnimation />
        </div>
      )}

      {/* ── Results ── */}
      {result && !scanning && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Honeypot alert */}
          {result.isHoneypot && (
            <div style={{
              padding: '14px 18px', borderRadius: 10,
              background: 'rgba(255,82,82,0.12)',
              border: '1px solid rgba(255,82,82,0.4)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 24 }}>☠️</span>
              <div>
                <div style={{ fontWeight: 800, color: 'var(--red)', marginBottom: 2 }}>
                  HONEYPOT DETECTED
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,82,82,0.8)' }}>
                  {result.honeypotReason ?? 'Sell transactions will fail. Do not buy.'}
                </div>
              </div>
            </div>
          )}

          {/* Score + identity */}
          <div className="card" style={{
            background: 'linear-gradient(135deg, #0a1929 0%, #071525 100%)',
            display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
          }}>
            <ScoreRing score={result.score} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 22 }}>{result.name}</span>
                <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 13,
                  color: 'var(--gold)', padding: '1px 8px', background: 'rgba(255,215,0,0.1)',
                  borderRadius: 6 }}>{result.symbol}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                {CHAINS.find(c => c.id === chainId)?.label} ·{' '}
                {parseInt(result.holders as any).toLocaleString()} holders
              </div>
              {/* Mini stat row */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'Score', val: `${result.score}/100`, color: scoreColor },
                  { label: 'Owner', val: result.ownerRenounced ? 'Renounced' : 'Active',
                    color: result.ownerRenounced ? 'var(--green)' : 'var(--gold)' },
                  { label: 'LP Lock', val: result.lpPercent > 0 ? `${result.lpPercent}%` : 'Unknown',
                    color: result.lpLocked ? 'var(--green)' : 'var(--red)' },
                ].map(s => (
                  <div key={s.label} style={{
                    padding: '5px 12px', borderRadius: 20,
                    background: 'rgba(255,255,255,0.04)', border: '0.5px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}: </span>
                    <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11,
                      color: s.color, fontWeight: 700 }}>{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tax simulation */}
          <div className="card" style={{ background: 'linear-gradient(135deg, #0a1929 0%, #071525 100%)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
              color: 'var(--text-muted)', marginBottom: 14 }}>Tax Simulation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <TaxMeter label="Buy Tax" pct={result.buyTax} />
              <TaxMeter label="Sell Tax" pct={result.sellTax} />
            </div>
            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)',
              display: 'flex', gap: 6 }}>
              {result.buyTax > 25 || result.sellTax > 25
                ? <span style={{ color: 'var(--red)' }}>⚠ High tax — likely scam or rugged</span>
                : result.buyTax > 10 || result.sellTax > 10
                  ? <span style={{ color: 'var(--gold)' }}>⚠ Elevated tax — trade carefully</span>
                  : <span style={{ color: 'var(--green)' }}>✓ Tax within normal range</span>
              }
            </div>
          </div>

          {/* Security flags */}
          <div className="card" style={{ background: 'linear-gradient(135deg, #0a1929 0%, #071525 100%)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
              color: 'var(--text-muted)', marginBottom: 14 }}>Security Flags</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.flags.map(f => <FlagRow key={f.label} flag={f} />)}
            </div>
          </div>

          {/* Owner + contract info */}
          <div className="card" style={{ background: 'linear-gradient(135deg, #0a1929 0%, #071525 100%)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
              color: 'var(--text-muted)', marginBottom: 14 }}>Contract Info</div>
            {[
              { label: 'Owner',        val: result.ownerAddress,    mono: true  },
              { label: 'Total Supply', val: result.totalSupply,     mono: true  },
              { label: 'Holders',      val: parseInt(result.holders as any).toLocaleString(), mono: false },
              { label: 'LP Locked',    val: result.lpPercent > 0 ? `${result.lpPercent}% locked` : 'Unknown', mono: false },
            ].map(row => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: '8px 0', borderBottom: '0.5px solid var(--border)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, minWidth: 100 }}>{row.label}</span>
                <span style={{
                  fontSize: 11, textAlign: 'right', wordBreak: 'break-all',
                  fontFamily: row.mono ? "'Space Mono',monospace" : 'inherit',
                  color: '#fff',
                }}>
                  {row.val}
                </span>
              </div>
            ))}
          </div>

          {/* Data sources */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['GoPlus Security', 'Honeypot.is'].map(src => (
              <span key={src} style={{
                fontSize: 10, color: 'var(--text-muted)', padding: '3px 10px',
                border: '0.5px solid var(--border)', borderRadius: 20,
              }}>
                ⚡ {src}
              </span>
            ))}
            <button onClick={() => setResult(null)} style={{
              fontSize: 10, color: 'var(--text-muted)', padding: '3px 10px',
              border: '0.5px solid var(--border)', borderRadius: 20,
              background: 'transparent', cursor: 'pointer',
            }}>
              ✕ Clear
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!scanning && !result && !error && (
        <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>🛡️</div>
          <div style={{ fontSize: 13 }}>Enter any token contract address above to run a full security scan.</div>
          <div style={{ fontSize: 11, marginTop: 6 }}>Works on BSC, Ethereum, Arbitrum, Base, Polygon</div>
        </div>
      )}
    </div>
  )
}
