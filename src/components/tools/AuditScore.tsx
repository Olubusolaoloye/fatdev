import { useState, useRef } from 'react'
import { useAccount, usePublicClient, useChainId } from 'wagmi'
import { useStore } from '../../lib/store'
import { CHAIN_EXPLORERS } from '../../lib/wagmi'
import { ERC20_APPROVE_ABI } from '../../lib/airdrop'
import { Spinner } from '../ui-kit'

// ── Scoring helpers ───────────────────────────────────────────────────────────

type CheckResult = { label: string; detail: string; score: number; max: number; pass: boolean; warn?: boolean }
type Section     = { title: string; icon: string; checks: CheckResult[] }

function taxScore(label: string, total: number): CheckResult {
  const pass = total < 2500
  const warn = total >= 1500
  const pts  = total < 500 ? 15 : total < 1000 ? 12 : total < 1500 ? 9 : total < 2000 ? 5 : total < 2500 ? 2 : 0
  return {
    label:  `${label} tax ${(total / 100).toFixed(2)}%`,
    detail: total < 500  ? 'Excellent — very low tax, highly appealing to buyers'
          : total < 1000 ? 'Good — moderate tax acceptable for most projects'
          : total < 1500 ? 'Elevated — may deter buyers; consider reducing'
          : total < 2500 ? 'High — risk flag for many bot filters and aggregators'
          : 'Exceeds 25% — reverts on deployment',
    score: pts, max: 15, pass, warn,
  }
}

// Manual config form state shape
type ManualCfg = {
  name: string; symbol: string; decimals: number; totalSupply: number
  buyTax: number; sellTax: number
  taxLocked: boolean; antiSync: boolean; killBlock: boolean; walletLimit: boolean
  fundDiffFromReceive: boolean
}

const DEFAULT_MANUAL: ManualCfg = {
  name: '', symbol: '', decimals: 18, totalSupply: 0,
  buyTax: 0, sellTax: 0,
  taxLocked: false, antiSync: false, killBlock: false, walletLimit: false,
  fundDiffFromReceive: true,
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AuditScore() {
  const { address }  = useAccount()
  const chainId      = useChainId()
  const publicClient = usePublicClient()
  const { cfg, getUserData } = useStore()
  const user    = address ? getUserData(address) : null
  const deploys = user?.deploys ?? []

  // ── Contract address input (primary) ─────────────────────────────────────────
  const [contractInput,  setContractInput]  = useState('')
  const [contractAddr,   setContractAddr]   = useState('')   // confirmed / loaded
  const [loadingToken,   setLoadingToken]   = useState(false)
  const [loadError,      setLoadError]      = useState('')

  // ── Manual override fields (populated from on-chain or edited by user) ────────
  const [manual, setManual] = useState<ManualCfg>(DEFAULT_MANUAL)
  const [useManual, setUseManual] = useState(false)   // false = use wizard cfg

  // ── On-chain checks ───────────────────────────────────────────────────────────
  const [checking,    setChecking]    = useState(false)
  const [onChainData, setOnChainData] = useState<{ verified: boolean; ownerRenounced: boolean; hasLiquidity: boolean } | null>(null)
  const [checkError,  setCheckError]  = useState('')

  const printRef = useRef<HTMLDivElement>(null)

  // ── Load token info from contract address ─────────────────────────────────────
  async function loadContract(addr: string) {
    const clean = addr.trim()
    if (!/^0x[0-9a-fA-F]{40}$/.test(clean)) { setLoadError('Enter a valid 0x contract address'); return }
    if (!publicClient) return
    setLoadingToken(true); setLoadError(''); setOnChainData(null)
    try {
      const [sym, dec] = await Promise.all([
        publicClient.readContract({ address: clean as `0x${string}`, abi: ERC20_APPROVE_ABI, functionName: 'symbol' }),
        publicClient.readContract({ address: clean as `0x${string}`, abi: ERC20_APPROVE_ABI, functionName: 'decimals' }),
      ])
      setContractAddr(clean)
      setManual(m => ({ ...m, symbol: sym as string, decimals: Number(dec), name: sym as string }))
      setUseManual(true)
      // auto-run on-chain checks immediately
      await runOnChainChecks(clean)
    } catch (e: any) {
      setLoadError(e.shortMessage ?? e.message ?? 'Failed to read contract')
    }
    setLoadingToken(false)
  }

  // ── Run on-chain checks for a given address ───────────────────────────────────
  async function runOnChainChecks(addr?: string) {
    const target = addr ?? contractAddr
    if (!target || !publicClient) return
    setChecking(true); setCheckError(''); setOnChainData(null)
    try {
      let ownerRenounced = false
      try {
        const ownerAbi = [{ name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }] as const
        const owner = await publicClient.readContract({ address: target as `0x${string}`, abi: ownerAbi, functionName: 'owner' })
        ownerRenounced = owner === '0x0000000000000000000000000000000000000000'
      } catch { /* no owner() */ }

      let verified = false
      try {
        const r = await fetch(`https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${target}&apikey=BHPP1DMU8YABI4Y9MV7PUGATK49IKR8D3F`)
        const j = await r.json()
        verified = !!(j?.result?.[0]?.SourceCode && j.result[0].SourceCode !== '')
      } catch { /* API error */ }

      let hasLiquidity = false
      try {
        const bal = await publicClient.getBalance({ address: target as `0x${string}` })
        hasLiquidity = bal > 0n
        if (!hasLiquidity) {
          const balAbi = [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'uint256' }] }] as const
          const tb = await publicClient.readContract({ address: target as `0x${string}`, abi: balAbi, functionName: 'balanceOf', args: [target as `0x${string}`] })
          hasLiquidity = (tb as bigint) > 0n
        }
      } catch { /* ignore */ }

      setOnChainData({ verified, ownerRenounced, hasLiquidity })
    } catch (e: any) {
      setCheckError(e.message ?? 'Check failed')
    }
    setChecking(false)
  }

  // ── Pick config source ────────────────────────────────────────────────────────
  // If using manual / custom contract, score from manual fields; otherwise from wizard cfg
  const activeName   = useManual ? manual.name   : cfg.name
  const activeSymbol = useManual ? manual.symbol  : cfg.symbol

  const buyTotal  = useManual
    ? Math.round(manual.buyTax  * 100)
    : cfg.buyFund  + cfg.buyLP  + cfg.buyReward  + cfg.buyBurn
  const sellTotal = useManual
    ? Math.round(manual.sellTax * 100)
    : cfg.sellFund + cfg.sellLP + cfg.sellReward + cfg.sellBurn

  const taxLocked         = useManual ? manual.taxLocked         : !cfg.enableChangeTax
  const antiSync          = useManual ? manual.antiSync          : cfg.antiSYNC
  const killBlock         = useManual ? manual.killBlock         : cfg.enableKillBlock
  const walletLimit       = useManual ? manual.walletLimit       : cfg.enableWalletLimit
  const decimalsVal       = useManual ? manual.decimals          : cfg.decimals
  const supplyVal         = useManual ? manual.totalSupply       : Number(cfg.totalSupply)
  const fundDiffReceive   = useManual ? manual.fundDiffFromReceive
    : cfg.fundAddress.toLowerCase() !== cfg.receiveAddress.toLowerCase()

  // ── Score sections ────────────────────────────────────────────────────────────
  const sections: Section[] = [
    {
      title: 'Tax Configuration', icon: '💸',
      checks: [
        taxScore('Buy',  buyTotal),
        taxScore('Sell', sellTotal),
        {
          label: 'Buy ≤ Sell tax',
          detail: buyTotal <= sellTotal ? 'Buy not higher than sell — buyer-friendly' : 'Buy tax exceeds sell tax — unusual, may concern buyers',
          score: buyTotal <= sellTotal ? 5 : 0, max: 5, pass: buyTotal <= sellTotal,
        },
      ],
    },
    {
      title: 'Security Flags', icon: '🔒',
      checks: [
        {
          label: 'Tax change locked',
          detail: taxLocked ? 'Taxes immutable after deploy. Strong trust signal.' : 'Owner can change taxes post-deploy. Risk flag for buyers.',
          score: taxLocked ? 10 : 0, max: 10, pass: taxLocked, warn: !taxLocked,
        },
        {
          label: 'Anti-SYNC protection',
          detail: antiSync ? 'Protects against SYNC-based price manipulation attacks' : 'antiSYNC disabled — minor attack vector open',
          score: antiSync ? 5 : 2, max: 5, pass: antiSync, warn: !antiSync,
        },
        {
          label: 'Kill block / anti-sniper',
          detail: killBlock ? 'Sniper bot protection active at launch' : 'No sniper protection — bots can buy at block 0',
          score: killBlock ? 5 : 1, max: 5, pass: killBlock, warn: !killBlock,
        },
        {
          label: 'Wallet limit enabled',
          detail: walletLimit ? 'Max wallet limit protects against whale accumulation' : 'No wallet limit — single wallet can buy unlimited tokens',
          score: walletLimit ? 5 : 0, max: 5, pass: walletLimit, warn: !walletLimit,
        },
      ],
    },
    {
      title: 'Token Setup', icon: '⚙️',
      checks: [
        {
          label: 'Standard decimals (18)',
          detail: decimalsVal === 18 ? 'Standard 18 decimals — compatible with all DEXes and tools' : `${decimalsVal} decimals — non-standard, may cause issues with some aggregators`,
          score: decimalsVal === 18 ? 5 : 2, max: 5, pass: decimalsVal === 18, warn: decimalsVal !== 18,
        },
        {
          label: 'Supply configured',
          detail: supplyVal > 0 ? `${supplyVal.toLocaleString()} tokens total supply` : 'Total supply is 0 — check configuration',
          score: supplyVal > 0 ? 5 : 0, max: 5, pass: supplyVal > 0,
        },
        {
          label: 'Addresses distinct',
          detail: fundDiffReceive ? 'Fund ≠ receive address — proper role separation' : 'Fund and receive addresses are the same — consider splitting',
          score: fundDiffReceive ? 5 : 0, max: 5, pass: fundDiffReceive,
        },
      ],
    },
    {
      title: 'Post-Deploy Status', icon: '🚀',
      checks: [
        {
          label: 'Contract verified',
          detail: onChainData?.verified ? 'Source code verified on explorer — full transparency'
            : onChainData === null ? 'Click "Run checks" to verify'
            : 'Source code not verified — buyers cannot read contract',
          score: onChainData?.verified ? 10 : 0, max: 10, pass: onChainData?.verified === true, warn: onChainData?.verified === false,
        },
        {
          label: 'Ownership renounced',
          detail: onChainData?.ownerRenounced ? 'Owner is zero address — fully decentralised'
            : onChainData === null ? 'Click "Run checks" to verify'
            : 'Owner has not renounced — centralisation risk',
          score: onChainData?.ownerRenounced ? 10 : 3, max: 10, pass: onChainData?.ownerRenounced === true, warn: onChainData?.ownerRenounced === false,
        },
      ],
    },
  ]

  const totalScore = sections.flatMap(s => s.checks).reduce((a, c) => a + c.score, 0)
  const maxScore   = sections.flatMap(s => s.checks).reduce((a, c) => a + c.max,   0)
  const pct        = Math.round((totalScore / maxScore) * 100)
  const grade      = pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 55 ? 'C' : 'D'
  const gradeColor = grade === 'A' ? 'var(--green)' : grade === 'B' ? 'var(--fd-cyan)' : grade === 'C' ? '#FF9800' : 'var(--red)'

  function copyShareText() {
    const pass  = sections.flatMap(s => s.checks).filter(c => c.pass).length
    const total = sections.flatMap(s => s.checks).length
    const text = [
      `🛡️ FatDev Audit Score — ${activeName || 'Token'} (${activeSymbol || '—'})`,
      `Grade: ${grade}  |  Score: ${totalScore}/${maxScore} (${pct}%)`,
      `Checks passed: ${pass}/${total}`,
      '',
      ...sections.map(s => `${s.icon} ${s.title}\n` + s.checks.map(c => `  ${c.pass ? '✅' : c.warn ? '⚠️' : '❌'} ${c.label}`).join('\n')),
      '',
      contractAddr ? `Contract: ${contractAddr}` : '',
      `\nGenerated by FatDev — fatdev.io`,
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(text)
  }

  const explorerBase = CHAIN_EXPLORERS[chainId] ?? ''

  // ─────────────────────────────────────────────────────────── RENDER ────────────
  return (
    <div className="step-panel" id="audit-printable" ref={printRef}>
      <style>{`@media print { body > * { display:none!important; } #audit-printable { display:block!important; position:fixed; top:0; left:0; width:100%; } }`}</style>

      {/* ── Contract address input ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Token contract address</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Paste any ERC-20 / BEP-20 contract address to audit it, or use the wizard config below.
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
        {contractAddr && !loadingToken && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="pill pill-ok">✓ Loaded</span>
            {manual.symbol && <span className="pill pill-gold">{manual.symbol}</span>}
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'Space Mono',monospace" }}>
              {contractAddr.slice(0, 10)}…{contractAddr.slice(-8)}
            </span>
          </div>
        )}

        {/* Quick-select from deploys */}
        {deploys.filter(d => d.contractAddress).length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Or pick from your deploys:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {deploys.filter(d => d.contractAddress).map(d => (
                <button key={d.contractAddress} className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={() => {
                    setContractInput(d.contractAddress!)
                    loadContract(d.contractAddress!)
                  }}>
                  {d.tokenSymbol}
                </button>
              ))}
              <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px', opacity: 0.7 }}
                onClick={() => { setContractInput(''); setContractAddr(''); setUseManual(false); setOnChainData(null) }}>
                Use wizard config
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Manual config fields (shown when using custom contract) ── */}
      {useManual && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Config for scoring</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Enter the token's tax and feature settings so the score reflects your actual config. Symbol and decimals were read on-chain.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div className="field-label">Token name</div>
              <input className="field-input" style={{ width: '100%' }} value={manual.name}
                onChange={e => setManual(m => ({ ...m, name: e.target.value }))} />
            </div>
            <div>
              <div className="field-label">Symbol</div>
              <input className="field-input" style={{ width: '100%' }} value={manual.symbol}
                onChange={e => setManual(m => ({ ...m, symbol: e.target.value }))} />
            </div>
            <div>
              <div className="field-label">Buy tax %</div>
              <input type="number" className="field-input" style={{ width: '100%' }} min={0} max={25} step="0.1"
                value={manual.buyTax} onChange={e => setManual(m => ({ ...m, buyTax: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <div className="field-label">Sell tax %</div>
              <input type="number" className="field-input" style={{ width: '100%' }} min={0} max={25} step="0.1"
                value={manual.sellTax} onChange={e => setManual(m => ({ ...m, sellTax: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <div className="field-label">Total supply</div>
              <input type="number" className="field-input" style={{ width: '100%' }} min={0}
                value={manual.totalSupply} onChange={e => setManual(m => ({ ...m, totalSupply: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <div className="field-label">Decimals</div>
              <input type="number" className="field-input" style={{ width: '100%' }} min={0} max={18}
                value={manual.decimals} onChange={e => setManual(m => ({ ...m, decimals: parseInt(e.target.value) || 18 }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { key: 'taxLocked',         label: 'Tax change locked' },
              { key: 'antiSync',          label: 'Anti-SYNC enabled' },
              { key: 'killBlock',         label: 'Kill block / anti-sniper' },
              { key: 'walletLimit',       label: 'Wallet limit enabled' },
              { key: 'fundDiffFromReceive', label: 'Fund ≠ receive address' },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                <div style={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
                  background: (manual as any)[key] ? 'var(--fd-cyan)' : 'rgba(255,255,255,0.1)',
                  position: 'relative', transition: 'background 0.2s' }}
                  onClick={() => setManual(m => ({ ...m, [key]: !(m as any)[key] }))}>
                  <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff',
                    position: 'absolute', top: 2, left: (manual as any)[key] ? 18 : 2, transition: 'left 0.2s' }} />
                </div>
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Score hero ── */}
      <div className="card" style={{ textAlign: 'center', marginBottom: 14, padding: '28px 20px',
        background: 'linear-gradient(135deg,rgba(10,25,41,0.9),rgba(4,13,24,1))',
        border: `1px solid ${gradeColor}40` }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--text-muted)', marginBottom: 8 }}>
          FatDev Audit Score
        </div>
        <div style={{ fontSize: 64, fontWeight: 900, color: gradeColor, lineHeight: 1, marginBottom: 4 }}>{grade}</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>{totalScore} / {maxScore}</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {pct}% — {activeName || 'Token'} ({activeSymbol || '—'})
        </div>
        {contractAddr && (
          <div style={{ marginTop: 8, fontFamily: "'Space Mono',monospace", fontSize: 11, color: 'var(--text-muted)' }}>
            {contractAddr}
          </div>
        )}
        <div style={{ margin: '14px auto 0', maxWidth: 320, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)' }}>
          <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: gradeColor, transition: 'width 0.8s ease' }} />
        </div>
      </div>

      {/* ── On-chain checks ── */}
      <div className="card" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>On-chain checks</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Verification status, owner, and liquidity from the blockchain</div>
        </div>
        {onChainData ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className={`pill ${onChainData.verified ? 'pill-ok' : 'pill-warn'}`}>
              {onChainData.verified ? '✓ Verified' : '✗ Unverified'}
            </span>
            <span className={`pill ${onChainData.ownerRenounced ? 'pill-ok' : 'pill-warn'}`}>
              {onChainData.ownerRenounced ? '✓ Renounced' : '⚠ Owner active'}
            </span>
            <span className={`pill ${onChainData.hasLiquidity ? 'pill-ok' : 'pill-warn'}`}>
              {onChainData.hasLiquidity ? '✓ Liquidity' : '⚠ No liquidity'}
            </span>
            <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={() => runOnChainChecks()}>↻ Recheck</button>
          </div>
        ) : (
          <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }}
            onClick={() => runOnChainChecks()} disabled={checking || (!contractAddr && !address)}>
            {checking ? <Spinner /> : '🔍 Run checks'}
          </button>
        )}
        {checkError && <div style={{ fontSize: 12, color: 'var(--red)', width: '100%' }}>{checkError}</div>}
      </div>

      {/* ── Score sections grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {sections.map(section => {
          const secScore = section.checks.reduce((a, c) => a + c.score, 0)
          const secMax   = section.checks.reduce((a, c) => a + c.max, 0)
          return (
            <div key={section.title} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{section.icon} {section.title}</span>
                <span style={{ fontSize: 12, fontFamily: "'Space Mono',monospace", color: 'var(--fd-cyan)' }}>
                  {secScore}/{secMax}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {section.checks.map(check => (
                  <div key={check.label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                      {check.pass ? '✅' : check.warn ? '⚠️' : '❌'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{check.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{check.detail}</div>
                    </div>
                    <span style={{ fontSize: 10, fontFamily: "'Space Mono',monospace", flexShrink: 0,
                      color: check.score === check.max ? 'var(--green)' : check.score > 0 ? 'var(--fd-cyan)' : 'var(--red)' }}>
                      {check.score}/{check.max}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Disclaimer */}
      <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.03)',
        border: '0.5px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
        ⚠️ This is an automated configuration check, <strong>not a professional security audit</strong>.
        It does not check for logic vulnerabilities, rug-pull mechanisms, or malicious code. Always DYOR.
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn-primary" onClick={copyShareText}>📋 Copy for Telegram / Discord</button>
        <button className="btn-ghost" onClick={() => window.print()}>🖨️ Print / Save as PDF</button>
        {contractAddr && (
          <a href={`${explorerBase}/address/${contractAddr}`} target="_blank" rel="noopener" className="btn-ghost">
            Explorer ↗
          </a>
        )}
      </div>
    </div>
  )
}
