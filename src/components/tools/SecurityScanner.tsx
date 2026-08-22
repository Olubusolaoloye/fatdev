import { useState } from 'react'
import { downloadShareCard, copyShareCard, type ShareCardData, type Tone } from '../../lib/shareCard'
import { CHAIN_NAME, CHAIN_EXPLORERS, SUPPORTED_CHAINS } from '../../lib/wagmi'
import { detectChains, fetchDexPairs, type ChainCandidate } from '../../lib/chainDetect'
import { buildScanReport, type ScanReport, type Pillar, type Finding as FindingType, type FindingState } from '../../lib/scanEngine'
import Icon from '../ui-kit/Icon'
import { detectEcosystem, ADDRESS_HINT, nonEvmTokenUrl, SOLANA_CHAIN_ID, SUI_CHAIN_ID } from '../../lib/ecosystems'
import { scanSolana, scanSui } from '../../lib/nonEvmScan'
import ChainIcon from '../ui-kit/ChainIcon'
import TokenAvatar from '../ui-kit/TokenAvatar'

// ── APIs ──────────────────────────────────────────────────────────────────────
async function fetchGoPlus(address: string, chainId: number): Promise<any> {
  const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address.toLowerCase()}`
  const res = await fetch(url)
  const json = await res.json()
  if (json.code !== 1) throw new Error(json.message || 'GoPlus API error')
  const entry = Object.values(json.result ?? {})[0]
  if (!entry) throw new Error('No GoPlus record')
  return entry
}

async function fetchHoneypot(address: string, chainId: number): Promise<any> {
  const res = await fetch(`https://api.honeypot.is/v2/IsHoneypot?address=${address}&chainID=${chainId}`)
  if (!res.ok) throw new Error(`Honeypot.is returned ${res.status}`)
  return res.json()
}

// ── Small presentational pieces ───────────────────────────────────────────────
const STATE_COLOR: Record<FindingState, string> = {
  pass: 'var(--fd-green)', warn: 'var(--amber)', fail: 'var(--red)', unknown: 'var(--text-muted)',
}
const STATE_ICON: Record<FindingState, 'check' | 'alert' | 'x' | 'info'> = {
  pass: 'check', warn: 'alert', fail: 'x', unknown: 'info',
}

function verdictTone(v: ScanReport['verdict']): Tone {
  return v === 'LOW RISK' ? 'good' : v === 'CAUTION' ? 'warn' : 'bad'
}
function verdictColor(v: ScanReport['verdict']): string {
  return v === 'LOW RISK' ? 'var(--fd-green)' : v === 'CAUTION' ? 'var(--amber)' : 'var(--red)'
}
/** Literal hex — CSS custom properties need a real colour to build rgba tints from. */
function verdictHex(v: ScanReport['verdict']): string {
  return v === 'LOW RISK' ? '#00E57A' : v === 'CAUTION' ? '#FFB020' : '#FF5252'
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const R = 58, circ = 2 * Math.PI * R
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circ
  return (
    <div style={{ position: 'relative', width: 148, height: 148, flexShrink: 0 }}>
      <svg width={148} height={148} viewBox="0 0 148 148" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={74} cy={74} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={11} />
        <circle cx={74} cy={74} r={R} fill="none" stroke={color} strokeWidth={11}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 9px ${color})`, transition: 'stroke-dasharray 900ms ease' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: 'var(--fd-font-mono)', fontSize: 38, fontWeight: 800, color, lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--fd-font-mono)', marginTop: 3 }}>
          / 100
        </span>
      </div>
    </div>
  )
}

function pillarColor(p: Pillar): string {
  if (!p.covered) return 'var(--text-muted)'
  return p.score >= 80 ? 'var(--fd-green)' : p.score >= 50 ? 'var(--amber)' : 'var(--red)'
}

function Finding({ f }: { f: FindingType }) {
  return (
    <li className="scan-finding">
      <span style={{ color: STATE_COLOR[f.state], marginTop: 1, flexShrink: 0 }}>
        <Icon name={STATE_ICON[f.state]} size={14} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className={`scan-finding__label${f.state === 'unknown' ? ' scan-finding__label--muted' : ''}`}>
          {f.label}
        </div>
        {f.detail && <div className="scan-finding__detail">{f.detail}</div>}
      </div>
    </li>
  )
}

function PillarCard({ p, defaultOpen }: { p: Pillar; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const color = pillarColor(p)

  return (
    <section className="scan-pillar" style={{ ['--pillar-color' as any]: color }}>
      <button className="scan-pillar__head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 className="scan-pillar__title" style={{ margin: 0 }}>{p.title}</h3>
            <span className="scan-pillar__weight">{Math.round(p.weight * 100)}%</span>
            {!p.covered && <span className="scan-badge-muted">NOT ASSESSED</span>}
          </div>
          <div className="scan-pillar__track">
            <div className="scan-pillar__fill" style={{ width: `${p.covered ? p.score : 0}%` }} />
          </div>
        </div>
        <span className="scan-pillar__score">{p.covered ? p.score : '—'}</span>
        <Icon name="arrowRight" size={14} style={{
          color: 'var(--fd-ghost)',
          transform: open ? 'rotate(90deg)' : 'none',
          transition: 'transform 180ms ease',
        }} />
      </button>

      {open && (
        <ul className="scan-pillar__body" style={{ listStyle: 'none', margin: 0 }}>
          {p.findings.map((f, i) => <Finding key={i} f={f} />)}
        </ul>
      )}
    </section>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
type Phase = 'idle' | 'detecting' | 'scanning' | 'done'

export function SecurityScanner() {
  const [address, setAddress] = useState('')
  const [phase,   setPhase]   = useState<Phase>('idle')
  const [status,  setStatus]  = useState('')
  const [error,   setError]   = useState('')
  const [report,  setReport]  = useState<ScanReport | null>(null)

  const [candidates, setCandidates] = useState<ChainCandidate[]>([])
  const [activeChain, setActiveChain] = useState<number | null>(null)

  const [cardBusy,   setCardBusy]   = useState<'png' | 'copy' | null>(null)
  const [cardNotice, setCardNotice] = useState('')

  const ecosystem = detectEcosystem(address)
  const valid = ecosystem !== null

  // ── Scan one chain ──────────────────────────────────────────────────────────
  async function scanOn(addr: string, chainId: number, knownPairs?: any[]) {
    setPhase('scanning')
    setStatus(`Auditing on ${CHAIN_NAME[chainId] ?? `chain ${chainId}`}…`)
    setActiveChain(chainId)

    const [gpRes, hpRes, pairs] = await Promise.all([
      Promise.allSettled([fetchGoPlus(addr, chainId)]).then(r => r[0]),
      Promise.allSettled([fetchHoneypot(addr, chainId)]).then(r => r[0]),
      knownPairs ?? fetchDexPairs(addr, chainId),
    ])

    const goPlus   = gpRes.status === 'fulfilled' ? gpRes.value : null
    const honeypot = hpRes.status === 'fulfilled' ? hpRes.value : null

    if (!goPlus && !honeypot && pairs.length === 0) {
      throw new Error(
        `No security data available for ${CHAIN_NAME[chainId] ?? `chain ${chainId}`}. ` +
        `The GoPlus and Honeypot.is APIs do not currently cover this network.`
      )
    }

    setReport(buildScanReport({ address: addr, chainId, goPlus, honeypot, dexPairs: pairs }))
    setPhase('done')
  }

  // ── Detect then scan ────────────────────────────────────────────────────────
  async function run() {
    const addr = address.trim()
    if (!valid) { setError(ADDRESS_HINT); return }

    setError(''); setReport(null); setCandidates([]); setCardNotice('')

    // Solana and Sui are identified by address shape alone — no chain detection
    // needed, and they use their own scan engines with chain-appropriate pillars.
    if (ecosystem === 'solana' || ecosystem === 'sui') {
      const chainId = ecosystem === 'solana' ? SOLANA_CHAIN_ID : SUI_CHAIN_ID
      setPhase('scanning')
      setActiveChain(chainId)
      setStatus(`Auditing on ${ecosystem === 'solana' ? 'Solana' : 'Sui'}…`)
      try {
        setReport(ecosystem === 'solana' ? await scanSolana(addr) : await scanSui(addr))
        setPhase('done')
      } catch (e: any) {
        setError(e.message ?? 'Scan failed')
        setPhase('idle')
      }
      return
    }

    setPhase('detecting')
    setStatus('Finding which network this contract is on…')

    try {
      const det = await detectChains(addr)
      setCandidates(det.candidates)

      if (!det.best) {
        throw new Error(
          'No contract found at this address on any supported network. ' +
          'Check the address, or the token may be on a chain FatDev does not cover yet.'
        )
      }
      // Reuse the pairs detection already fetched rather than asking again
      await scanOn(addr, det.best.chainId, det.dexPairs)
    } catch (e: any) {
      setError(e.message ?? 'Scan failed')
      setPhase('idle')
    }
  }

  async function switchChain(chainId: number) {
    setError('')
    try { await scanOn(address.trim(), chainId) }
    catch (e: any) { setError(e.message ?? 'Scan failed'); setPhase('done') }
  }

  // ── Share card ──────────────────────────────────────────────────────────────
  function buildCard(r: ScanReport): ShareCardData {
    const taxTone = (t: number): Tone => t > 25 ? 'bad' : t > 10 ? 'warn' : 'good'
    const failed = r.pillars.flatMap(p => p.findings).filter(f => f.state === 'fail')

    return {
      kicker:   'Token Security Scan',
      title:    r.name,
      symbol:   r.symbol,
      subtitle: `${CHAIN_NAME[r.chainId] ?? `Chain ${r.chainId}`} · ${r.holders.toLocaleString()} holders · ${r.coverage}% coverage`,
      score:    r.score,
      verdict:  r.verdict,
      verdictTone: verdictTone(r.verdict),
      verdictNote: r.isHoneypot
        ? (r.honeypotReason || 'Sell simulation failed — this token cannot be sold.')
        : failed.length === 0
          ? `No critical risks found across ${r.pillars.length} weighted security pillars.`
          : `${failed.length} critical issue${failed.length > 1 ? 's' : ''}: ${failed.slice(0, 2).map(f => f.label).join(', ')}${failed.length > 2 ? '…' : ''}`,
      stats: (r.chainId === SOLANA_CHAIN_ID || r.chainId === SUI_CHAIN_ID) ? [
        { label: r.chainId === SUI_CHAIN_ID ? 'Treasury Cap' : 'Mint Auth',
          value: r.isMintable ? 'Live' : 'Revoked', tone: r.isMintable ? 'bad' : 'good' },
        { label: r.chainId === SUI_CHAIN_ID ? 'Upgradeable' : 'Freeze Auth',
          value: r.chainId === SUI_CHAIN_ID ? (r.isProxy ? 'Yes' : 'No') : (r.ownerRenounced ? 'Revoked' : 'Live'),
          tone: (r.chainId === SUI_CHAIN_ID ? r.isProxy : !r.ownerRenounced) ? 'warn' : 'good' },
        { label: 'Liquidity', value: r.liquidityUsd > 0 ? `$${Math.round(r.liquidityUsd).toLocaleString()}` : 'None',
          tone: r.liquidityUsd > 25_000 ? 'good' : r.liquidityUsd > 0 ? 'warn' : 'bad' },
        { label: 'Holders',   value: r.holders > 0 ? r.holders.toLocaleString() : '—', tone: 'neutral' },
      ] : [
        { label: 'Buy Tax',   value: `${r.buyTax.toFixed(1)}%`,  tone: taxTone(r.buyTax) },
        { label: 'Sell Tax',  value: `${r.sellTax.toFixed(1)}%`, tone: taxTone(r.sellTax) },
        { label: 'Liquidity', value: r.liquidityUsd > 0 ? `$${Math.round(r.liquidityUsd).toLocaleString()}` : 'None',
          tone: r.liquidityUsd > 25_000 ? 'good' : r.liquidityUsd > 0 ? 'warn' : 'bad' },
        { label: 'Ownership', value: r.ownerRenounced ? 'Renounced' : 'Active',
          tone: r.ownerRenounced ? 'good' : 'warn' },
      ],
      // A pillar holding any critical finding must never show a green tick, even
      // if its weighted score survived — otherwise the chips contradict the
      // verdict note directly above them.
      highlights: r.pillars.map(p => ({
        label: p.title.replace(' & ', ' + '),
        ok: p.covered && p.score >= 70 && !p.findings.some(f => f.state === 'fail'),
      })),
      contract: r.address,
      logoUrl:  r.logoUrl,
    }
  }

  async function saveCard() {
    if (!report) return
    setCardBusy('png'); setCardNotice('')
    try {
      const slug = (report.symbol || 'token').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'token'
      await downloadShareCard(buildCard(report), `fatdev-scan-${slug}.png`)
    } catch (e: any) { setCardNotice(`Image export failed: ${e.message ?? e}`) }
    setCardBusy(null)
  }
  async function clipCard() {
    if (!report) return
    setCardBusy('copy'); setCardNotice('')
    const ok = await copyShareCard(buildCard(report))
    setCardNotice(ok
      ? 'Image copied — paste it straight into Telegram, X, or Discord.'
      : 'Your browser blocks image copy. Use Download PNG instead.')
    setCardBusy(null)
  }

  const busy = phase === 'detecting' || phase === 'scanning'
  const vColor = report ? verdictColor(report.verdict) : 'var(--fd-cyan)'
  const vRaw   = report ? verdictHex(report.verdict) : '#00CFFF'
  const explorer = report ? CHAIN_EXPLORERS[report.chainId] : ''

  // ── Derived view models ─────────────────────────────────────────────────────
  // Everything a red/amber pillar flagged, hoisted above the accordions so a
  // real problem is never one click away from being missed.
  const allFindings = report ? report.pillars.flatMap(p => p.findings) : []
  const failCount   = allFindings.filter(f => f.state === 'fail').length
  const topRisks    = [
    ...allFindings.filter(f => f.state === 'fail'),
    ...allFindings.filter(f => f.state === 'warn'),
  ].slice(0, 6)

  const riskRaw   = failCount > 0 ? '#FF5252' : '#FFB020'
  const riskColor = failCount > 0 ? 'var(--red)' : 'var(--amber)'

  // Worst-scoring covered pillars first; unassessed ones sink to the bottom
  const orderedPillars = report
    ? [...report.pillars].sort((a, b) => {
        if (a.covered !== b.covered) return a.covered ? -1 : 1
        return a.score - b.score
      })
    : []

  const taxColor = (t: number) =>
    t > 25 ? 'var(--red)' : t > 10 ? 'var(--amber)' : 'var(--fd-green)'

  const lpSecured = report ? report.lpLockedPct + report.lpBurnedPct : 0

  const isNonEvm = report != null &&
    (report.chainId === SOLANA_CHAIN_ID || report.chainId === SUI_CHAIN_ID)

  // Tiles differ by ecosystem. Buy/sell tax and LP-lock are EVM concepts —
  // rendering "0.0% / 0.0%" tax for a Solana mint implies a tax model that
  // chain does not have, and "LP Secured: Unknown" is noise there.
  const stats = report ? (isNonEvm ? [
    {
      label: 'Liquidity',
      value: report.liquidityUsd > 0 ? `$${Math.round(report.liquidityUsd).toLocaleString()}` : 'None',
      color: report.liquidityUsd > 25_000 ? 'var(--fd-green)'
           : report.liquidityUsd > 0      ? 'var(--amber)' : 'var(--red)',
      sub: report.volume24h > 0 ? `$${Math.round(report.volume24h).toLocaleString()} 24h vol` : undefined,
    },
    {
      label: report.chainId === SUI_CHAIN_ID ? 'Treasury Cap' : 'Mint Authority',
      value: report.isMintable ? 'Live' : 'Revoked',
      color: report.isMintable ? 'var(--red)' : 'var(--fd-green)',
      sub: report.isMintable ? 'supply can grow' : 'supply is fixed',
    },
    {
      label: report.chainId === SUI_CHAIN_ID ? 'Upgradeable' : 'Freeze Authority',
      value: report.chainId === SUI_CHAIN_ID
        ? (report.isProxy ? 'Yes' : 'No')
        : (report.ownerRenounced ? 'Revoked' : 'Live'),
      color: (report.chainId === SUI_CHAIN_ID ? report.isProxy : !report.ownerRenounced)
        ? 'var(--amber)' : 'var(--fd-green)',
    },
    {
      label: 'Holders',
      value: report.holders > 0 ? report.holders.toLocaleString() : '—',
      color: 'var(--fd-white)',
      sub: report.topHolderPct > 0 ? `top wallet ${report.topHolderPct.toFixed(1)}%` : undefined,
    },
    {
      label: 'Total Supply',
      value: (() => {
        const n = Number(report.totalSupply)
        if (!Number.isFinite(n) || n <= 0) return '—'
        if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`
        if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`
        if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`
        return n.toLocaleString()
      })(),
      color: 'var(--fd-white)',
    },
    {
      label: 'Pair Age',
      value: report.pairAgeDays != null ? `${report.pairAgeDays}d` : '—',
      color: report.pairAgeDays == null ? 'var(--text-muted)'
           : report.pairAgeDays < 14 ? 'var(--amber)' : 'var(--fd-green)',
    },
  ] : [
    {
      label: 'Liquidity',
      value: report.liquidityUsd > 0 ? `$${Math.round(report.liquidityUsd).toLocaleString()}` : 'None',
      color: report.liquidityUsd > 25_000 ? 'var(--fd-green)'
           : report.liquidityUsd > 0      ? 'var(--amber)' : 'var(--red)',
      sub: report.volume24h > 0 ? `$${Math.round(report.volume24h).toLocaleString()} 24h vol` : undefined,
    },
    {
      label: 'Buy / Sell Tax',
      value: `${report.buyTax.toFixed(1)}% / ${report.sellTax.toFixed(1)}%`,
      color: taxColor(Math.max(report.buyTax, report.sellTax)),
    },
    {
      label: 'LP Secured',
      value: lpSecured > 0 ? `${lpSecured}%` : 'Unknown',
      color: lpSecured >= 80 ? 'var(--fd-green)' : lpSecured > 0 ? 'var(--amber)' : 'var(--text-muted)',
      sub: report.lpBurnedPct > 0 ? `${report.lpBurnedPct}% burnt` : undefined,
    },
    {
      label: 'Ownership',
      value: report.ownerRenounced ? 'Renounced' : 'Active',
      color: report.ownerRenounced ? 'var(--fd-green)' : 'var(--amber)',
    },
    {
      label: 'Holders',
      value: report.holders > 0 ? report.holders.toLocaleString() : '—',
      color: 'var(--fd-white)',
      sub: report.topHolderPct > 0 ? `top wallet ${report.topHolderPct.toFixed(1)}%` : undefined,
    },
    {
      label: 'Pair Age',
      value: report.pairAgeDays != null ? `${report.pairAgeDays}d` : '—',
      color: report.pairAgeDays == null ? 'var(--text-muted)'
           : report.pairAgeDays < 14 ? 'var(--amber)' : 'var(--fd-green)',
    },
  ]) : []

  return (
    <div className="step-panel">

      {/* ── Input ── */}
      <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg,#0a1929,#071525)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: 'var(--fd-cyan-ghost)',
            border: '0.5px solid var(--fd-border-cyan)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'var(--fd-cyan)',
          }}><Icon name="shield" size={17} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Token Security Scanner</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              EVM, Solana and Sui — the network is detected automatically
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="field-input"
            style={{ flex: 1, minWidth: 240, fontFamily: 'var(--fd-font-mono)', fontSize: 13 }}
            placeholder="EVM 0x… · Solana mint · Sui coin type"
            value={address}
            onChange={e => { setAddress(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && !busy && run()}
            aria-label="Token contract address"
          />
          <button className="btn-primary" onClick={run} disabled={busy || !valid}
            style={{
              padding: '10px 20px', whiteSpace: 'nowrap', minWidth: 108,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              opacity: busy || !valid ? 0.55 : 1,
            }}>
            {busy ? 'Working…' : <><Icon name="search" size={15} />Scan</>}
          </button>
        </div>

        {busy && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: 'var(--fd-cyan)' }}>
            <span className="spinner" />{status}
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 12, padding: '10px 13px', borderRadius: 8, fontSize: 12.5, lineHeight: 1.6,
            background: 'rgba(255,82,82,0.07)', border: '0.5px solid rgba(255,82,82,0.25)',
            color: 'var(--red)', display: 'flex', gap: 9,
          }}>
            <Icon name="alert" size={15} style={{ marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Multi-chain notice */}
        {candidates.length > 1 && phase === 'done' && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              This address exists on {candidates.length} networks — showing the one with the most liquidity.
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {candidates.map(c => {
                const on = activeChain === c.chainId
                return (
                  <button key={c.chainId} onClick={() => !on && switchChain(c.chainId)} disabled={busy}
                    style={{
                      padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      border: `0.5px solid ${on ? 'var(--fd-cyan)' : 'var(--border)'}`,
                      background: on ? 'var(--fd-cyan-ghost)' : 'transparent',
                      color: on ? 'var(--fd-cyan)' : 'var(--text-muted)',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                    <ChainIcon chainId={c.chainId} size={14} />
                    {SUPPORTED_CHAINS.find(s => s.id === c.chainId)?.short ?? c.chainId}
                    {c.hasLiquidity && c.liquidityUsd > 0 && (
                      <span style={{ fontFamily: 'var(--fd-font-mono)', opacity: 0.75 }}>
                        ${Math.round(c.liquidityUsd).toLocaleString()}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {report && phase === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Hero ── */}
          <header className="scan-hero" style={{
            ['--scan-color' as any]: vColor,
            ['--scan-tint'  as any]: `${vRaw}1A`,
            ['--scan-edge'  as any]: `${vRaw}55`,
            ['--scan-glow'  as any]: `${vRaw}1F`,
          }}>
            <ScoreRing score={report.score} color={vColor} />
            <div style={{ minWidth: 0 }}>
              <div className="scan-hero__name">
                <TokenAvatar
                  src={report.logoUrl}
                  symbol={report.symbol}
                  name={report.name}
                  size={38}
                  ring={`${vRaw}55`}
                />
                <h2>{report.name}</h2>
                <span className="scan-ticker">{report.symbol}</span>
              </div>

              <div className="scan-verdict">
                <span className="scan-verdict__dot" />
                {report.verdict}
              </div>

              <p className="scan-meta">
                <ChainIcon chainId={report.chainId} size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                <strong>{CHAIN_NAME[report.chainId]}</strong> · {report.holders.toLocaleString()} holders
                {report.pairAgeDays != null && <> · {report.pairAgeDays}d old</>}
                <br />
                Weighted across {report.pillars.length} pillars · {report.coverage}% coverage
              </p>

              <div className="scan-addr">
                {report.address}
                {(() => {
                  const url = report.chainId === SOLANA_CHAIN_ID || report.chainId === SUI_CHAIN_ID
                    ? nonEvmTokenUrl(report.chainId, report.address)
                    : explorer ? `${explorer}/token/${report.address}` : ''
                  return url ? <a href={url} target="_blank" rel="noopener">explorer ↗</a> : null
                })()}
              </div>
            </div>
          </header>

          {/* ── Key risks — surfaced before the pillars so nothing important
                 is hidden behind an accordion ── */}
          {topRisks.length > 0 && (
            <section className="scan-risks" style={{
              ['--scan-color' as any]: riskColor,
              ['--scan-tint'  as any]: `${riskRaw}12`,
              ['--scan-edge'  as any]: `${riskRaw}40`,
            }}>
              <h3 className="scan-risks__head" style={{ margin: 0 }}>
                <Icon name="alert" size={16} />
                {failCount > 0
                  ? `${failCount} critical issue${failCount > 1 ? 's' : ''} found`
                  : `${topRisks.length} thing${topRisks.length > 1 ? 's' : ''} to check`}
              </h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {topRisks.map((f, i) => (
                  <li key={i} className="scan-risk">
                    <span style={{ color: STATE_COLOR[f.state], marginTop: 1, flexShrink: 0 }}>
                      <Icon name={STATE_ICON[f.state]} size={14} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="scan-risk__label">{f.label}</div>
                      {f.detail && <div className="scan-risk__detail">{f.detail}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── At a glance ── */}
          <section>
            <div className="scan-section-label">At a glance</div>
            <div className="scan-stats">
              {stats.map(st => (
                <div key={st.label} className="scan-stat">
                  <div className="scan-stat__label">{st.label}</div>
                  <div className="scan-stat__value" style={{ color: st.color }}>{st.value}</div>
                  {st.sub && <div className="scan-stat__sub">{st.sub}</div>}
                </div>
              ))}
            </div>
          </section>

          {/* Coverage caveat */}
          {report.coverage < 100 && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.6,
              background: 'rgba(255,176,32,0.06)', border: '1px solid rgba(255,176,32,0.22)',
              color: 'rgba(255,255,255,0.72)', display: 'flex', gap: 9,
            }}>
              <Icon name="info" size={15} style={{ color: 'var(--amber)', marginTop: 1 }} />
              <span>
                Only <strong>{report.coverage}%</strong> of the scoring weight could be assessed on this
                network — pillars marked <em>not assessed</em> were excluded rather than assumed safe.
              </span>
            </div>
          )}

          {/* ── Pillars — worst first ── */}
          <section>
            <div className="scan-section-label">Full breakdown</div>
            <div className="scan-pillars">
              {orderedPillars.map(p => (
                <PillarCard key={p.key} p={p} defaultOpen={p.covered && p.score < 80} />
              ))}
            </div>
          </section>

          {/* Share */}
          <div className="card" style={{ background: 'linear-gradient(135deg,#0a1929,#071525)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="image" size={16} style={{ color: 'var(--fd-cyan)' }} />Share this scan
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Branded 1200×675 image with the score, verdict, taxes, liquidity and every pillar.
                  Sized for X, Telegram and Discord previews.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={saveCard} disabled={cardBusy !== null}
                  style={{ fontSize: 13, padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  {cardBusy === 'png' ? 'Rendering…' : <><Icon name="download" size={15} />Download PNG</>}
                </button>
                <button className="btn-ghost" onClick={clipCard} disabled={cardBusy !== null}
                  style={{ fontSize: 13, padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  {cardBusy === 'copy' ? 'Copying…' : <><Icon name="copy" size={15} />Copy image</>}
                </button>
              </div>
            </div>
            {cardNotice && (
              <div style={{
                marginTop: 12, fontSize: 12, lineHeight: 1.6,
                color: /failed|blocks/.test(cardNotice) ? 'var(--amber)' : 'var(--fd-green)',
              }}>{cardNotice}</div>
            )}
            {report.score < 55 && (
              <div style={{
                marginTop: 12, padding: '9px 13px', borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
                background: 'rgba(255,82,82,0.07)', border: '0.5px solid rgba(255,82,82,0.22)',
                color: 'rgba(255,255,255,0.7)',
              }}>
                This token scored <strong style={{ color: 'var(--red)' }}>{report.score}/100</strong> — the
                image will show the risks it failed. Useful as a warning, not a promotion.
              </div>
            )}
          </div>

          {/* Sources */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['GoPlus Security', 'Honeypot.is', 'DexScreener'].map(s => (
              <span key={s} style={{
                fontSize: 10, color: 'var(--text-muted)', padding: '3px 10px',
                border: '0.5px solid var(--border)', borderRadius: 20,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                <Icon name="zap" size={10} />{s}
              </span>
            ))}
            <button onClick={() => { setReport(null); setPhase('idle'); setCandidates([]) }}
              style={{
                fontSize: 10, color: 'var(--text-muted)', padding: '3px 10px',
                border: '0.5px solid var(--border)', borderRadius: 20,
                background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
              <Icon name="x" size={10} />Clear
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {phase === 'idle' && !report && !error && (
        <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--text-muted)' }}>
          <Icon name="shield" size={40} style={{ margin: '0 auto 12px', opacity: 0.35 }} />
          <div style={{ fontSize: 13 }}>Paste any token address to run a full security audit.</div>
          <div style={{ fontSize: 11, marginTop: 6 }}>
            EVM chains, Solana mints and Sui coin types — detected automatically from the address.
          </div>
        </div>
      )}
    </div>
  )
}
