import { useState } from 'react'
import { downloadShareCard, copyShareCard, type ShareCardData, type Tone } from '../../lib/shareCard'
import { CHAIN_NAME, CHAIN_EXPLORERS, SUPPORTED_CHAINS } from '../../lib/wagmi'
import { detectChains, fetchDexPairs, type ChainCandidate } from '../../lib/chainDetect'
import { buildScanReport, type ScanReport, type Pillar, type FindingState } from '../../lib/scanEngine'
import Icon from '../ui-kit/Icon'

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

function PillarCard({ p }: { p: Pillar }) {
  const [open, setOpen] = useState(true)
  const barColor = p.score >= 80 ? 'var(--fd-green)' : p.score >= 50 ? 'var(--amber)' : 'var(--red)'
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', background: 'none', border: 'none', padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12, color: '#fff', textAlign: 'left',
        }}>
        <Icon name={open ? 'eye' : 'eye'} size={0} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{p.title}</span>
            <span style={{
              fontSize: 10, fontFamily: 'var(--fd-font-mono)', color: 'var(--text-muted)',
              border: '0.5px solid var(--border)', borderRadius: 20, padding: '1px 7px',
            }}>weight {Math.round(p.weight * 100)}%</span>
            {!p.covered && (
              <span style={{
                fontSize: 10, fontFamily: 'var(--fd-font-mono)', color: 'var(--text-muted)',
                background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: '1px 7px',
              }}>NOT ASSESSED</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 70, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }}>
            <div style={{
              width: `${p.covered ? p.score : 0}%`, height: '100%', borderRadius: 3,
              background: barColor, transition: 'width 700ms ease',
            }} />
          </div>
          <span style={{
            fontFamily: 'var(--fd-font-mono)', fontSize: 13, fontWeight: 700,
            color: p.covered ? barColor : 'var(--text-muted)', minWidth: 28, textAlign: 'right',
          }}>{p.covered ? p.score : '—'}</span>
          <Icon name="arrowRight" size={14}
            style={{ color: 'var(--text-muted)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 180ms ease' }} />
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {p.findings.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <span style={{ color: STATE_COLOR[f.state], marginTop: 1, flexShrink: 0 }}>
                <Icon name={STATE_ICON[f.state]} size={14} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: f.state === 'unknown' ? 'var(--text-muted)' : '#fff' }}>
                  {f.label}
                </div>
                {f.detail && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 2 }}>
                    {f.detail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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

  const valid = /^0x[0-9a-fA-F]{40}$/.test(address.trim())

  // ── Scan one chain ──────────────────────────────────────────────────────────
  async function scanOn(addr: string, chainId: number) {
    setPhase('scanning')
    setStatus(`Auditing on ${CHAIN_NAME[chainId] ?? `chain ${chainId}`}…`)
    setActiveChain(chainId)

    const [gpRes, hpRes, pairs] = await Promise.all([
      Promise.allSettled([fetchGoPlus(addr, chainId)]).then(r => r[0]),
      Promise.allSettled([fetchHoneypot(addr, chainId)]).then(r => r[0]),
      fetchDexPairs(addr, chainId),
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
    if (!valid) { setError('Enter a valid contract address (0x…)'); return }

    setError(''); setReport(null); setCandidates([]); setCardNotice('')
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
      await scanOn(addr, det.best.chainId)
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
          ? 'No critical risks found across 8 weighted security pillars.'
          : `${failed.length} critical issue${failed.length > 1 ? 's' : ''}: ${failed.slice(0, 2).map(f => f.label).join(', ')}${failed.length > 2 ? '…' : ''}`,
      stats: [
        { label: 'Buy Tax',   value: `${r.buyTax.toFixed(1)}%`,  tone: taxTone(r.buyTax) },
        { label: 'Sell Tax',  value: `${r.sellTax.toFixed(1)}%`, tone: taxTone(r.sellTax) },
        { label: 'Liquidity', value: r.liquidityUsd > 0 ? `$${Math.round(r.liquidityUsd).toLocaleString()}` : 'None',
          tone: r.liquidityUsd > 25_000 ? 'good' : r.liquidityUsd > 0 ? 'warn' : 'bad' },
        { label: 'Ownership', value: r.ownerRenounced ? 'Renounced' : 'Active',
          tone: r.ownerRenounced ? 'good' : 'warn' },
      ],
      highlights: r.pillars.map(p => ({
        label: p.title.replace(' & ', ' + '),
        ok: p.covered && p.score >= 70,
      })),
      contract: r.address,
      sources:  'GoPlus · Honeypot.is · DexScreener',
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
  const explorer = report ? CHAIN_EXPLORERS[report.chainId] : ''

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
              Paste an address — the network is detected automatically
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            className="field-input"
            style={{ flex: 1, minWidth: 240, fontFamily: 'var(--fd-font-mono)', fontSize: 13 }}
            placeholder="0x… contract address"
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Hero */}
          <div className="card" style={{
            background: 'linear-gradient(135deg,#0a1929,#071525)',
            border: `1px solid ${vColor}44`,
            display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap',
          }}>
            <ScoreRing score={report.score} color={vColor} />
            <div style={{ flex: 1, minWidth: 210 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 5, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 22 }}>{report.name}</span>
                <span style={{
                  fontFamily: 'var(--fd-font-mono)', fontSize: 12, color: 'var(--fd-cyan)',
                  padding: '2px 9px', background: 'var(--fd-cyan-ghost)', borderRadius: 6,
                }}>{report.symbol}</span>
              </div>

              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 12,
                padding: '5px 13px', borderRadius: 20,
                background: `${vColor}1A`, border: `1px solid ${vColor}55`,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: vColor }} />
                <span style={{ fontWeight: 800, fontSize: 13, color: vColor, letterSpacing: '0.06em' }}>
                  {report.verdict}
                </span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                Weighted across {report.pillars.length} pillars · {report.coverage}% coverage<br />
                {CHAIN_NAME[report.chainId]} · {report.holders.toLocaleString()} holders
                {report.pairAgeDays != null && ` · ${report.pairAgeDays}d old`}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { l: 'Buy',  v: `${report.buyTax.toFixed(1)}%` },
                  { l: 'Sell', v: `${report.sellTax.toFixed(1)}%` },
                  { l: 'Liq',  v: report.liquidityUsd > 0 ? `$${Math.round(report.liquidityUsd).toLocaleString()}` : '—' },
                  { l: 'Owner', v: report.ownerRenounced ? 'Renounced' : 'Active' },
                ].map(s => (
                  <div key={s.l} style={{
                    padding: '5px 11px', borderRadius: 20,
                    background: 'rgba(255,255,255,0.04)', border: '0.5px solid var(--border)',
                    fontSize: 11,
                  }}>
                    <span style={{ color: 'var(--text-muted)' }}>{s.l}: </span>
                    <span style={{ fontFamily: 'var(--fd-font-mono)', fontWeight: 700 }}>{s.v}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12, fontFamily: 'var(--fd-font-mono)', fontSize: 10.5, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                {report.address}
                {explorer && (
                  <a href={`${explorer}/token/${report.address}`} target="_blank" rel="noopener"
                    style={{ color: 'var(--fd-cyan)', marginLeft: 8, textDecoration: 'none' }}>
                    explorer ↗
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Coverage caveat */}
          {report.coverage < 100 && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 12, lineHeight: 1.6,
              background: 'rgba(255,176,32,0.06)', border: '0.5px solid rgba(255,176,32,0.22)',
              color: 'rgba(255,255,255,0.72)', display: 'flex', gap: 9,
            }}>
              <Icon name="info" size={15} style={{ color: 'var(--amber)', marginTop: 1 }} />
              <span>
                Only <strong>{report.coverage}%</strong> of the scoring weight could be assessed on this
                network — pillars marked <em>not assessed</em> were excluded rather than assumed safe.
                Treat this score as less complete than a 100%-coverage scan.
              </span>
            </div>
          )}

          {/* Pillars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {report.pillars.map(p => <PillarCard key={p.key} p={p} />)}
          </div>

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
          <div style={{ fontSize: 13 }}>Paste any token contract address to run a full security audit.</div>
          <div style={{ fontSize: 11, marginTop: 6 }}>
            The network is detected automatically across all {SUPPORTED_CHAINS.filter(c => !c.testnet).length} supported chains.
          </div>
        </div>
      )}
    </div>
  )
}
