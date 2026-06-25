import { useState, useRef } from 'react'
import { useAccount, useWalletClient, usePublicClient, useChainId } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { useStore } from '../../lib/store'
import { CHAIN_EXPLORERS } from '../../lib/wagmi'
import { ERC20_APPROVE_ABI, deployAirdropContract, executeBatchAirdrop, getSavedAirdropContract } from '../../lib/airdrop'
import { StatusBox, Spinner } from '../ui-kit'

type Row = { address: string; amount: string; valid: boolean; error?: string }

type Phase = 'idle' | 'deploying' | 'approving' | 'sending' | 'done'

type Result = {
  approveTx: string
  airdropTx: string
  recipients: number
  total: string
  symbol: string
}

function parseCSV(raw: string): Row[] {
  return raw.trim().split('\n')
    .map(l => l.trim()).filter(Boolean)
    .map(line => {
      const parts   = line.split(/[,\t ]+/)
      const address = parts[0]?.trim() ?? ''
      const amount  = parts[1]?.trim() ?? ''
      const addrOk  = /^0x[0-9a-fA-F]{40}$/.test(address)
      const amtOk   = !isNaN(Number(amount)) && Number(amount) > 0
      return { address, amount, valid: addrOk && amtOk,
        error: !addrOk ? 'Invalid address' : !amtOk ? 'Invalid amount' : undefined }
    })
}

export function AirdropTool() {
  const { address }    = useAccount()
  const chainId        = useChainId()
  const { data: walletClient } = useWalletClient()
  const publicClient   = usePublicClient()
  const { getUserData } = useStore()
  const deploys        = address ? getUserData(address).deploys : []

  const [tokenAddr,    setTokenAddr]    = useState('')
  const [tokenInfo,    setTokenInfo]    = useState<{ symbol: string; decimals: number; balance: bigint } | null>(null)
  const [loadingToken, setLoadingToken] = useState(false)
  const [tokenError,   setTokenError]   = useState('')

  const [csvText, setCsvText] = useState('')
  const [rows,    setRows]    = useState<Row[]>([])

  const [phase,   setPhase]   = useState<Phase>('idle')
  const [status,  setStatus]  = useState('')
  const [error,   setError]   = useState('')
  const [result,  setResult]  = useState<Result | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const chainInfo  = CHAIN_EXPLORERS[chainId] ?? ''
  const validRows  = rows.filter(r => r.valid)
  const totalAmt   = validRows.reduce((s, r) => s + Number(r.amount), 0)

  // ── Load token info ──────────────────────────────────────────────────────────
  async function loadToken() {
    if (!publicClient || !address || !/^0x[0-9a-fA-F]{40}$/.test(tokenAddr)) {
      setTokenError('Enter a valid contract address'); return
    }
    setLoadingToken(true); setTokenError(''); setTokenInfo(null)
    try {
      const [decimals, symbol, balance] = await Promise.all([
        publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: ERC20_APPROVE_ABI, functionName: 'decimals' }),
        publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: ERC20_APPROVE_ABI, functionName: 'symbol' }),
        publicClient.readContract({ address: tokenAddr as `0x${string}`, abi: ERC20_APPROVE_ABI, functionName: 'balanceOf', args: [address as `0x${string}`] }),
      ])
      setTokenInfo({ decimals: Number(decimals), symbol: symbol as string, balance: balance as bigint })
    } catch (e: any) {
      setTokenError(`Failed: ${e.shortMessage ?? e.message}`)
    }
    setLoadingToken(false)
  }

  // ── CSV handling ─────────────────────────────────────────────────────────────
  function handleText(val: string) {
    setCsvText(val); setRows(parseCSV(val)); setResult(null); setError('')
  }
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const reader = new FileReader()
    reader.onload = ev => handleText(ev.target?.result as string)
    reader.readAsText(f)
  }

  // ── Execute airdrop (2 tx) ───────────────────────────────────────────────────
  async function run() {
    if (!walletClient || !publicClient || !tokenInfo || validRows.length === 0) return
    setError(''); setResult(null)

    try {
      // Resolve or deploy the FatAirdrop contract for this chain
      let airdropContract = getSavedAirdropContract(chainId)
      if (!airdropContract) {
        setPhase('deploying')
        airdropContract = await deployAirdropContract(walletClient as any, publicClient as any, setStatus)
      }

      const recipients = validRows.map(r => r.address as `0x${string}`)
      const amounts    = validRows.map(r => parseUnits(r.amount, tokenInfo.decimals))

      setPhase('approving')
      const res = await executeBatchAirdrop({
        tokenAddress:    tokenAddr as `0x${string}`,
        airdropContract,
        recipients,
        amounts,
        walletClient:    walletClient as any,
        publicClient:    publicClient as any,
        onStatus: (s) => {
          setStatus(s)
          if (s.startsWith('Step 2')) setPhase('sending')
        },
      })

      setResult({
        approveTx:  res.approveTx,
        airdropTx:  res.airdropTx,
        recipients: recipients.length,
        total:      formatUnits(amounts.reduce((a, b) => a + b, 0n), tokenInfo.decimals),
        symbol:     tokenInfo.symbol,
      })
      setPhase('done')
    } catch (e: any) {
      setError(e.shortMessage ?? e.message ?? 'Transaction failed')
      setPhase('idle')
    }
  }

  function exportReceipts() {
    if (!result) return
    const lines = [
      'address,amount',
      ...validRows.map(r => `${r.address},${r.amount}`),
      '',
      `Approve tx,${result.approveTx}`,
      `Airdrop tx,${result.airdropTx}`,
      `Total sent,${result.total} ${result.symbol}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'airdrop-receipt.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const hasEnough  = tokenInfo && validRows.length > 0
    ? tokenInfo.balance >= parseUnits(String(totalAmt), tokenInfo.decimals)
    : true
  const isRunning  = phase !== 'idle' && phase !== 'done'

  // ── Phase label ──────────────────────────────────────────────────────────────
  const phaseLabel: Record<Phase, string> = {
    idle:      '',
    deploying: '📦 Deploying batch contract (one-time)…',
    approving: '✍️  Step 1 / 2 — Approving total amount…',
    sending:   '🚀 Step 2 / 2 — Sending batch transaction…',
    done:      '',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* How it works banner */}
      <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(74,144,226,0.08)',
        border: '0.5px solid rgba(74,144,226,0.25)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--blue)' }}>How it works:</strong>{' '}
        Upload your list → click Execute → sign <strong style={{ color: '#fff' }}>2 transactions</strong>:{' '}
        one approval for the total amount, one batch transfer that sends to all wallets simultaneously.
        The FatAirdrop contract is deployed once per chain and reused for all future airdrops.
      </div>

      {/* 1 — Token */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 12 }}>1 · Select token</div>
        {deploys.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>From your deploys:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {deploys.filter(d => d.contractAddress).map(d => (
                <button key={d.id} className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={() => { setTokenAddr(d.contractAddress!); setTokenInfo(null); setTokenError('') }}>
                  {d.tokenSymbol}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field-input" style={{ flex: 1, fontFamily: "'Space Mono',monospace", fontSize: 12 }}
            placeholder="0x… ERC-20 token address"
            value={tokenAddr} onChange={e => { setTokenAddr(e.target.value); setTokenInfo(null); setTokenError('') }} />
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}
            onClick={loadToken} disabled={loadingToken}>
            {loadingToken ? <Spinner /> : 'Load'}
          </button>
        </div>
        {tokenError && <StatusBox msg={tokenError} type="err" />}
        {tokenInfo && (
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <span className="pill pill-gold">{tokenInfo.symbol}</span>
            <span className="pill">{tokenInfo.decimals} decimals</span>
            <span className={`pill ${hasEnough ? 'pill-ok' : 'pill-warn'}`}>
              Your balance: {Number(formatUnits(tokenInfo.balance, tokenInfo.decimals)).toLocaleString()} {tokenInfo.symbol}
            </span>
          </div>
        )}
      </div>

      {/* 2 — Recipients */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 4 }}>2 · Recipient list</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          One per line: <code style={{ color: 'var(--fd-cyan)' }}>0xAddress, amount</code>
        </div>
        <textarea
          style={{ width: '100%', minHeight: 130, background: 'rgba(255,255,255,0.04)',
            border: '0.5px solid var(--border)', borderRadius: 8, color: '#fff',
            fontFamily: "'Space Mono',monospace", fontSize: 12, padding: 12, resize: 'vertical', boxSizing: 'border-box' }}
          placeholder={'0xABC...123, 1000\n0xDEF...456, 2500\n0x789...abc, 500'}
          value={csvText} onChange={e => handleText(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
          <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }}
            onClick={() => fileRef.current?.click()}>📁 Upload CSV</button>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
          {rows.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--green)' }}>{validRows.length}</strong> valid ·{' '}
              {rows.length - validRows.length > 0 && (
                <strong style={{ color: 'var(--red)' }}>{rows.length - validRows.length} invalid</strong>
              )}
              {tokenInfo && ` · Total: ${totalAmt.toLocaleString()} ${tokenInfo.symbol}`}
            </span>
          )}
        </div>

        {/* Validation table */}
        {rows.length > 0 && (
          <div style={{ marginTop: 12, maxHeight: 200, overflowY: 'auto', borderRadius: 8, border: '0.5px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th style={{ padding: '5px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>#</th>
                  <th style={{ padding: '5px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Address</th>
                  <th style={{ padding: '5px 10px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: '5px 10px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>✓</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 300).map((row, i) => (
                  <tr key={i} style={{ borderTop: '0.5px solid var(--border)', opacity: row.valid ? 1 : 0.5 }}>
                    <td style={{ padding: '4px 10px', color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td style={{ padding: '4px 10px', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{row.address}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'right' }}>{row.amount}</td>
                    <td style={{ padding: '4px 10px', textAlign: 'center' }}>
                      {row.valid
                        ? <span style={{ color: 'var(--green)' }}>✓</span>
                        : <span style={{ color: 'var(--red)', fontSize: 10 }} title={row.error}>✗</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3 — Execute */}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 12 }}>3 · Execute batch airdrop</div>

        {/* Summary box */}
        {tokenInfo && validRows.length > 0 && (
          <div className="grid-3" style={{ gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Recipients', value: validRows.length },
              { label: 'Total to send', value: `${totalAmt.toLocaleString()} ${tokenInfo.symbol}` },
              { label: 'Wallet signatures', value: '2 transactions' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'rgba(255,215,0,0.06)', borderRadius: 8, padding: '10px 14px',
                border: '0.5px solid var(--border-strong)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {!tokenInfo   && <StatusBox msg="Load a token in step 1 first." type="info" />}
        {tokenInfo && validRows.length === 0 && <StatusBox msg="Add recipients in step 2." type="info" />}
        {tokenInfo && !hasEnough && validRows.length > 0 && (
          <StatusBox msg={`Insufficient balance. Need ${totalAmt.toLocaleString()} but have ${Number(formatUnits(tokenInfo.balance, tokenInfo.decimals)).toLocaleString()} ${tokenInfo.symbol}.`} type="err" />
        )}

        {/* Run button */}
        {tokenInfo && hasEnough && validRows.length > 0 && phase === 'idle' && (
          <button className="btn-primary" style={{ width: '100%', padding: 14, fontSize: 15 }} onClick={run}>
            🚀 Airdrop to {validRows.length} wallets — {totalAmt.toLocaleString()} {tokenInfo.symbol}
          </button>
        )}

        {/* Progress */}
        {isRunning && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
              <Spinner />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{phaseLabel[phase]}</span>
            </div>
            <StatusBox msg={status} type="info" />
          </div>
        )}

        {error && <StatusBox msg={error} type="err" />}

        {/* Success */}
        {result && phase === 'done' && (
          <div style={{ borderRadius: 12, border: '0.5px solid rgba(0,230,118,0.3)',
            background: 'rgba(0,230,118,0.06)', padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)', marginBottom: 12 }}>
              ✓ Airdrop complete!
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16, fontSize: 13 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Recipients</div>
                <div style={{ fontWeight: 700 }}>{result.recipients} wallets</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Total sent</div>
                <div style={{ fontWeight: 700, color: 'var(--green)' }}>{Number(result.total).toLocaleString()} {result.symbol}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Approve tx: </span>
              <a href={`${chainInfo}/tx/${result.approveTx}`} target="_blank" rel="noopener"
                style={{ color: 'var(--blue)', fontFamily: "'Space Mono',monospace" }}>
                {result.approveTx.slice(0, 12)}…{result.approveTx.slice(-6)}
              </a>
            </div>
            <div style={{ fontSize: 12, marginBottom: 16 }}>
              <span style={{ color: 'var(--text-muted)' }}>Airdrop tx: </span>
              <a href={`${chainInfo}/tx/${result.airdropTx}`} target="_blank" rel="noopener"
                style={{ color: 'var(--blue)', fontFamily: "'Space Mono',monospace", fontWeight: 700 }}>
                {result.airdropTx.slice(0, 12)}…{result.airdropTx.slice(-6)} ↗
              </a>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={exportReceipts}>↓ Export receipt CSV</button>
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => {
                setResult(null); setPhase('idle'); setCsvText(''); setRows([])
              }}>New airdrop</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
