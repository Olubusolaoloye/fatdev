import { useState } from 'react'
import { useAccount, useWalletClient, usePublicClient, useChainId } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { CHAIN_EXPLORERS, ROUTERS } from '../../lib/wagmi'
import { ERC20_APPROVE_ABI } from '../../lib/airdrop'
import { deployPresale, PRESALE_ABI, nativeCurrency } from '../../lib/presale'
import { StatusBox, Spinner } from '../ui-kit'

type Phase = 'config' | 'deploying' | 'live' | 'managing'

type PresaleState = {
  address:      `0x${string}`
  chainId:      number
  tokenAddr:    string
  tokenSymbol:  string
  hardCap:      string
  softCap:      string
  tokensPerEth: string
  liquidityPct: number
  endTime:      number
  whitelistOnly?: boolean
}

const STORAGE_KEY = 'fatdev-presales'

function getSavedPresales(): PresaleState[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function savePresale(p: PresaleState) {
  const list = getSavedPresales().filter(x => x.address !== p.address)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([p, ...list]))
}

// ── Number inputs with label ──────────────────────────────────────────────────
function NumField({ label, value, onChange, min, max, step, note }:
  { label: string; value: string; onChange: (v: string) => void; min?: number; max?: number; step?: string; note?: string }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <input type="number" className="field-input" value={value}
        min={min} max={max} step={step ?? '1'}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%' }} />
      {note && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{note}</div>}
    </div>
  )
}

export function PresaleTool() {
  const { address: _addr }       = useAccount()
  const chainId                  = useChainId()
  const currency                 = nativeCurrency(chainId)
  const { data: walletClient }   = useWalletClient()
  const publicClient             = usePublicClient()

  // ── Form state ───────────────────────────────────────────────────────────────
  const [tokenAddr,     setTokenAddr]     = useState('')
  const [tokenSymbol,   setTokenSymbol]   = useState('')
  const [tokenDec,      setTokenDec]      = useState(18)
  const [loadingToken,  setLoadingToken]  = useState(false)
  const [tokenError,    setTokenError]    = useState('')

  const [hardCap,       setHardCap]       = useState('10')
  const [softCap,       setSoftCap]       = useState('5')
  const [tokensPerEth,  setTokensPerEth]  = useState('')
  const [liquidityPct,  setLiquidityPct]  = useState(70)
  const [whitelistOnly, setWhitelistOnly] = useState(false)

  // Start in +1 hour, end in +72 hours
  const now = Math.floor(Date.now() / 1000)
  const [startHours, setStartHours] = useState('1')
  const [durationH,  setDurationH]  = useState('72')

  // ── Deploy state ─────────────────────────────────────────────────────────────
  const [phase,          setPhase]          = useState<Phase>('config')
  const [status,         setStatus]         = useState('')
  const [deployError,    setDeployError]    = useState('')
  const [presaleAddr,    setPresaleAddr]    = useState<`0x${string}` | null>(null)

  // ── Live presale management ───────────────────────────────────────────────────
  const [savedPresales,  setSavedPresales]  = useState<PresaleState[]>(getSavedPresales)
  const [activePresale,  setActivePresale]  = useState<PresaleState | null>(null)
  const [presaleStatus,  setPresaleStatus]  = useState<any>(null)
  const [loadingStatus,  setLoadingStatus]  = useState(false)
  const [actionStatus,   setActionStatus]   = useState('')
  const [actionError,    setActionError]    = useState('')
  const [fundStatus,     setFundStatus]     = useState('')
  const [fundError,      setFundError]      = useState('')
  const [whitelistText,  setWhitelistText]  = useState('')

  // ── Load token ────────────────────────────────────────────────────────────────
  async function loadToken() {
    if (!publicClient || !/^0x[0-9a-fA-F]{40}$/.test(tokenAddr)) { setTokenError('Invalid address'); return }
    setLoadingToken(true); setTokenError('')
    try {
      const [dec, sym] = await Promise.all([
        publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: ERC20_APPROVE_ABI, functionName: 'decimals' }),
        publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: ERC20_APPROVE_ABI, functionName: 'symbol' }),
      ])
      setTokenDec(Number(dec)); setTokenSymbol(sym as string)
    } catch (e: any) { setTokenError(e.shortMessage ?? e.message) }
    setLoadingToken(false)
  }

  // ── Deploy presale ─────────────────────────────────────────────────────────────
  async function deploy() {
    if (!walletClient || !publicClient) return
    if (!tokenAddr || !tokenSymbol) { setDeployError('Load token first'); return }
    if (parseFloat(softCap) > parseFloat(hardCap)) { setDeployError('Soft cap must be ≤ hard cap'); return }
    if (!tokensPerEth || parseFloat(tokensPerEth) <= 0) { setDeployError(`Set tokens per ${currency}`); return }

    setPhase('deploying'); setDeployError('')
    try {
      const startTime = now + parseInt(startHours) * 3600
      const endTime   = startTime + parseInt(durationH) * 3600

      const addr = await deployPresale(
        {
          token:         tokenAddr as `0x${string}`,
          router:        ROUTERS[chainId] as `0x${string}`,
          hardCapNative: hardCap,
          softCapNative: softCap,
          tokensPerNative: tokensPerEth,
          tokenDecimals: tokenDec,
          startTime,
          endTime,
          liquidityPct,
          whitelistOnly,
        },
        walletClient as any,
        publicClient as any,
        setStatus
      )
      setPresaleAddr(addr)
      const newPresale: PresaleState = {
        address: addr, chainId, tokenAddr, tokenSymbol,
        hardCap, softCap, tokensPerEth, liquidityPct, endTime,
      }
      savePresale(newPresale)
      setSavedPresales(getSavedPresales())
      setPhase('live')
    } catch (e: any) {
      setDeployError(e.shortMessage ?? e.message ?? 'Deploy failed')
      setPhase('config')
    }
  }

  // ── Read on-chain presale status ───────────────────────────────────────────────
  async function fetchStatus(p: PresaleState) {
    if (!publicClient) return
    setLoadingStatus(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await publicClient.readContract({
        address: p.address,
        abi: PRESALE_ABI,
        functionName: 'presaleStatus',
      }) as any
      const res: any[] = Array.isArray(raw) ? raw : [raw]
      setPresaleStatus({ status: res[0], raised: res[1], hard: res[2], soft: res[3], endsAt: res[4], isFinalized: res[5], isCancelled: res[6] })
    } catch { /* ignore */ }
    setLoadingStatus(false)
  }

  // ── Fund presale (transfer tokens to presale contract) ─────────────────────────
  async function fundPresale(p: PresaleState) {
    if (!walletClient || !publicClient) return
    setFundError(''); setFundStatus('')
    try {
      // Calculate how many tokens needed:
      // tokens for sale + tokens for LP
      const tpe     = BigInt(Math.floor(parseFloat(p.tokensPerEth) * 10 ** tokenDec))
      const hardBig = parseEther(p.hardCap)
      const tokSale = hardBig * tpe / parseEther('1')
      const tokLP   = (hardBig * BigInt(p.liquidityPct) / 100n) * tpe / parseEther('1')
      const total   = tokSale + tokLP

      setFundStatus('Approving token transfer…')
      const [acct] = await walletClient.getAddresses()
      const appHash = await walletClient.writeContract({
        address: p.tokenAddr as `0x${string}`,
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [p.address, total],
        account: acct,
        chain: walletClient.chain!,
      })
      await publicClient.waitForTransactionReceipt({ hash: appHash })

      setFundStatus('Transferring tokens to presale contract…')
      const txHash = await walletClient.writeContract({
        address: p.tokenAddr as `0x${string}`,
        abi: [{ name: 'transfer', type: 'function', stateMutability: 'nonpayable',
          inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
          outputs: [{ type: 'bool' }] }] as const,
        functionName: 'transfer',
        args: [p.address, total],
        account: acct,
        chain: walletClient.chain!,
      })
      await publicClient.waitForTransactionReceipt({ hash: txHash })
      setFundStatus('✓ Presale funded! Tokens are in the contract.')
    } catch (e: any) {
      setFundError(e.shortMessage ?? e.message ?? 'Failed to fund')
      setFundStatus('')
    }
  }

  // ── Presale actions (finalize / cancel) ───────────────────────────────────────
  async function callPresale(p: PresaleState, fn: 'finalize' | 'cancel') {
    if (!walletClient || !publicClient) return
    setActionError(''); setActionStatus(`Calling ${fn}…`)
    try {
      const [acct] = await walletClient.getAddresses()
      const hash = await walletClient.writeContract({
        address: p.address,
        abi: PRESALE_ABI,
        functionName: fn,
        account: acct,
        chain: walletClient.chain!,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      setActionStatus(`✓ ${fn} successful!`)
      await fetchStatus(p)
    } catch (e: any) {
      setActionError(e.shortMessage ?? e.message ?? 'Transaction failed')
      setActionStatus('')
    }
  }

  async function addWhitelist(p: PresaleState) {
    if (!walletClient || !publicClient || !whitelistText) return
    const addrs = whitelistText.split('\n').map(l => l.trim()).filter(a => /^0x[0-9a-fA-F]{40}$/.test(a))
    if (!addrs.length) { setActionError('No valid addresses'); return }
    setActionError(''); setActionStatus(`Adding ${addrs.length} addresses to whitelist…`)
    try {
      const [acct] = await walletClient.getAddresses()
      const hash = await walletClient.writeContract({
        address: p.address,
        abi: PRESALE_ABI,
        functionName: 'addToWhitelist',
        args: [addrs as `0x${string}`[]],
        account: acct,
        chain: walletClient.chain!,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      setActionStatus(`✓ ${addrs.length} addresses whitelisted`)
    } catch (e: any) {
      setActionError(e.shortMessage ?? e.message ?? 'Failed')
      setActionStatus('')
    }
  }

  const explorer = CHAIN_EXPLORERS[chainId] ?? ''

  // ─────────────────────────────────────────────────────── RENDER ───────────────

  // ── Manage existing presale ────────────────────────────────────────────────────
  if (activePresale) {
    const status_str = presaleStatus?.status ?? '—'
    const raised     = presaleStatus ? formatEther(presaleStatus.raised) : '—'
    const statusColor = status_str === 'LIVE' ? 'var(--green)' : status_str === 'FINALIZED' ? 'var(--blue)'
      : status_str === 'CANCELLED' ? 'var(--red)' : 'var(--text-muted)'

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button className="btn-ghost" style={{ fontSize: 12, alignSelf: 'flex-start' }}
          onClick={() => { setActivePresale(null); setPresaleStatus(null); setFundStatus(''); setFundError('') }}>
          ← Back to presales
        </button>

        {/* Header */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>
                {activePresale.tokenSymbol} Presale
              </div>
              <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: 'var(--text-muted)' }}>
                {activePresale.address}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: 800, color: statusColor, fontSize: 14 }}>{status_str}</span>
              <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => fetchStatus(activePresale)}>
                {loadingStatus ? <Spinner /> : '↻ Refresh'}
              </button>
              <a href={`${CHAIN_EXPLORERS[activePresale.chainId] ?? ''}/address/${activePresale.address}`}
                target="_blank" rel="noopener" className="btn-ghost" style={{ fontSize: 11 }}>Explorer ↗</a>
            </div>
          </div>
        </div>

        {/* Stats */}
        {presaleStatus && (
          <div className="grid-4" style={{ gap: 10 }}>
            {[
              { label: 'Raised', value: `${raised} ${currency}` },
              { label: 'Hard Cap', value: `${activePresale.hardCap} ${currency}` },
              { label: 'Soft Cap', value: `${activePresale.softCap} ${currency}` },
              { label: 'Fill', value: `${Math.min(100, Math.round(parseFloat(raised) / parseFloat(activePresale.hardCap) * 100))}%` },
            ].map(({ label, value }) => (
              <div key={label} className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        {presaleStatus && (
          <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${Math.min(100, Math.round(parseFloat(raised) / parseFloat(activePresale.hardCap) * 100))}%`,
              background: 'linear-gradient(90deg, var(--gold), var(--green))',
            }} />
          </div>
        )}

        {/* Fund presale */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>1. Fund the contract</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            Transfer the exact number of tokens needed for sale + liquidity into the presale contract.
            This sends <strong style={{ color: '#fff' }}>2 transactions</strong>: approve + transfer.
          </div>
          <button className="btn-primary" onClick={() => fundPresale(activePresale)}
            disabled={!!fundStatus || presaleStatus?.isFinalized || presaleStatus?.isCancelled}>
            📦 Fund Presale Contract
          </button>
          {fundStatus && <StatusBox msg={fundStatus} type={fundStatus.startsWith('✓') ? 'ok' : 'info'} />}
          {fundError  && <StatusBox msg={fundError}  type="err" />}
        </div>

        {/* Whitelist */}
        {activePresale.whitelistOnly !== false && (
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>2. Manage whitelist</div>
            <textarea
              className="field-input"
              style={{ width: '100%', minHeight: 90, fontFamily: "'Space Mono',monospace", fontSize: 12,
                resize: 'vertical', marginBottom: 8 }}
              placeholder={'0xABC...123\n0xDEF...456'}
              value={whitelistText} onChange={e => setWhitelistText(e.target.value)}
            />
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => addWhitelist(activePresale)}>
              + Add to whitelist
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            {activePresale.whitelistOnly !== false ? '3.' : '2.'} Owner actions
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => callPresale(activePresale, 'finalize')}
              disabled={presaleStatus?.isFinalized || presaleStatus?.isCancelled}>
              ✅ Finalize (add LP + open claims)
            </button>
            <button className="btn-ghost" style={{ color: 'var(--red)' }}
              onClick={() => callPresale(activePresale, 'cancel')}
              disabled={presaleStatus?.isFinalized || presaleStatus?.isCancelled}>
              ✗ Cancel (enable refunds)
            </button>
          </div>
          {actionStatus && <StatusBox msg={actionStatus} type={actionStatus.startsWith('✓') ? 'ok' : 'info'} />}
          {actionError  && <StatusBox msg={actionError}  type="err" />}
        </div>
      </div>
    )
  }

  // ── Config / deploy ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Existing presales */}
      {savedPresales.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Your presales</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {savedPresales.map(p => (
              <div key={p.address} style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)',
                border: '0.5px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700 }}>{p.tokenSymbol}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, fontFamily: "'Space Mono',monospace" }}>
                    {p.address.slice(0, 10)}…{p.address.slice(-6)}
                  </span>
                </div>
                <span className="pill">{`${p.hardCap} ${nativeCurrency(p.chainId)} cap`}</span>
                <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }}
                  onClick={async () => { setActivePresale(p); await fetchStatus(p) }}>
                  Manage →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New presale form */}
      {phase === 'live' && presaleAddr ? (
        <div style={{ borderRadius: 12, border: '0.5px solid rgba(0,230,118,0.3)',
          background: 'rgba(0,230,118,0.06)', padding: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)', marginBottom: 12 }}>
            ✓ Presale deployed!
          </div>
          <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 12, marginBottom: 16 }}>
            {presaleAddr}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={`${explorer}/address/${presaleAddr}`} target="_blank" rel="noopener"
              className="btn-primary">View on Explorer ↗</a>
            <button className="btn-ghost" onClick={() => {
              const p = savedPresales.find(x => x.address === presaleAddr)
              if (p) { setActivePresale(p); fetchStatus(p) }
            }}>Manage →</button>
            <button className="btn-ghost" onClick={() => {
              setPhase('config'); setPresaleAddr(null); setTokenAddr(''); setTokenSymbol('')
            }}>+ New presale</button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(74,144,226,0.08)',
            border: '0.5px solid rgba(74,144,226,0.25)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
            <strong style={{ color: 'var(--blue)' }}>How it works:</strong>{' '}
            Deploy a FatPresale contract alongside your token. Contributors send <strong style={{ color: '#fff' }}>{currency}</strong> during the window.
            On finalize, the contract <strong style={{ color: '#fff' }}>automatically adds liquidity</strong> to the DEX
            and enables token claims — no PinkSale needed.
          </div>

          {/* Step 1 — Token */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>1 · Token contract address</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Paste the contract address of any ERC-20 / BEP-20 token you want to run a presale for.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="field-input" style={{ flex: 1, fontFamily: "'Space Mono',monospace", fontSize: 12 }}
                placeholder="0x… token contract address"
                value={tokenAddr} onChange={e => { setTokenAddr(e.target.value); setTokenSymbol(''); setTokenDec(18); setTokenError('') }}
                onKeyDown={e => e.key === 'Enter' && loadToken()} />
              <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}
                onClick={loadToken} disabled={loadingToken}>
                {loadingToken ? <Spinner /> : 'Load'}
              </button>
            </div>
            {tokenError  && <StatusBox msg={tokenError}  type="err" />}
            {tokenSymbol && <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <span className="pill pill-ok">{tokenSymbol}</span>
              <span className="pill">{tokenDec} decimals</span>
            </div>}
          </div>

          {/* Step 2 — Caps */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>2 · Caps & pricing</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <NumField label="{`Hard cap (${currency})`}" value={hardCap} onChange={setHardCap} min={0.01} step="0.1"
                note={`Maximum ${currency} to raise`} />
              <NumField label="{`Soft cap (${currency})`}" value={softCap} onChange={setSoftCap} min={0.01} step="0.1"
                note={`Minimum ${currency} — refund if not met`} />
              <NumField label={`Tokens per ${currency} ${tokenSymbol ? `(${tokenSymbol})` : ''}`}
                value={tokensPerEth} onChange={setTokensPerEth} min={1} step="1"
                note={`Whole tokens a contributor gets per 1 ${currency}`} />
              <NumField label="Liquidity %" value={String(liquidityPct)} onChange={v => setLiquidityPct(parseInt(v) || 70)}
                min={30} max={100}
                note={`% of raised ${currency} added to LP on finalize`} />
            </div>
            {tokensPerEth && hardCap && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,215,0,0.06)', border: '0.5px solid var(--border-strong)',
                fontSize: 12, color: 'var(--text-secondary)' }}>
                📊 At hard cap ({hardCap} {currency} raised): <strong style={{ color: '#fff' }}>{(parseFloat(tokensPerEth) * parseFloat(hardCap)).toLocaleString()} {tokenSymbol}</strong> sold +{' '}
                <strong style={{ color: 'var(--gold)' }}>
                  {(parseFloat(tokensPerEth) * parseFloat(hardCap) * liquidityPct / 100).toLocaleString()} {tokenSymbol}
                </strong> in LP.{' '}
                Fund the contract with at least{' '}
                <strong style={{ color: 'var(--green)' }}>
                  {(parseFloat(tokensPerEth) * parseFloat(hardCap) * (1 + liquidityPct / 100)).toLocaleString()} {tokenSymbol}
                </strong>.
              </div>
            )}
          </div>

          {/* Step 3 — Schedule */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>3 · Schedule</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <NumField label="Start (hours from now)" value={startHours} onChange={setStartHours} min={0} max={720}
                note={`Starts ${new Date((now + parseInt(startHours || '0') * 3600) * 1000).toLocaleString()}`} />
              <NumField label="Duration (hours)" value={durationH} onChange={setDurationH} min={1} max={720}
                note={`Ends ${new Date((now + parseInt(startHours || '0') * 3600 + parseInt(durationH || '1') * 3600) * 1000).toLocaleString()}`} />
            </div>
          </div>

          {/* Step 4 — Options */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>4 · Options</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
              <div style={{ width: 40, height: 22, borderRadius: 11,
                background: whitelistOnly ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                onClick={() => setWhitelistOnly(!whitelistOnly)}>
                <div style={{ width: 18, height: 18, borderRadius: 9, background: '#fff',
                  position: 'absolute', top: 2, left: whitelistOnly ? 20 : 2, transition: 'left 0.2s' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Whitelist only</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Only whitelisted wallets can contribute</div>
              </div>
            </label>
          </div>

          {/* Deploy button */}
          {deployError && <StatusBox msg={deployError} type="err" />}
          {phase === 'deploying' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Spinner />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{status}</span>
            </div>
          ) : (
            <button className="btn-primary" style={{ width: '100%', padding: 14, fontSize: 15 }}
              onClick={deploy} disabled={!tokenSymbol || !tokensPerEth}>
              🚀 Deploy Presale Contract
            </button>
          )}
        </div>
      )}
    </div>
  )
}
