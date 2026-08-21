import { useState, useRef } from 'react'
import { useAccount, useWalletClient, usePublicClient, useChainId } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { useStore } from '../../lib/store'
import { CHAIN_EXPLORERS } from '../../lib/wagmi'
import {
  ERC20_APPROVE_ABI,
  deployAirdropContract,
  executeBatchAirdrop,
  getSavedAirdropContract,
  FATDEV_MULTISENDER,
  chargeAirdropFee,
  airdropFeeUsd,
} from '../../lib/airdrop'
import { StatusBox, Spinner } from '../ui-kit'
import Icon from '../ui-kit/Icon'

const CHUNK_SIZE = 150
const WARN_SIZE  = 100

type Row = { address: string; amount: string; valid: boolean; error?: string }
type Phase = 'idle' | 'fee' | 'deploying' | 'approving' | 'sending' | 'done'
type ChunkResult = { approveTx: string; airdropTx: string; recipients: number; total: string }

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

  const [phase,      setPhase]      = useState<Phase>('idle')
  const [status,     setStatus]     = useState('')
  const [chunkLabel, setChunkLabel] = useState('')
  const [error,      setError]      = useState('')
  const [results,    setResults]    = useState<ChunkResult[]>([])

  const fileRef   = useRef<HTMLInputElement>(null)
  const chainInfo = CHAIN_EXPLORERS[chainId] ?? ''
  const validRows = rows.filter(r => r.valid)
  const totalAmt  = validRows.reduce((s, r) => s + Number(r.amount), 0)
  const chunkCount = Math.ceil(validRows.length / CHUNK_SIZE)

  // Shared FatDev contract for this chain (if deployed)
  const sharedContract = FATDEV_MULTISENDER[chainId] ?? null

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
    setCsvText(val); setRows(parseCSV(val)); setResults([]); setError('')
  }
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const reader = new FileReader()
    reader.onload = ev => handleText(ev.target?.result as string)
    reader.readAsText(f)
  }

  // ── Execute — chunked batching ───────────────────────────────────────────────
  async function run() {
    if (!walletClient || !publicClient || !tokenInfo || validRows.length === 0) return
    setError(''); setResults([])

    try {
      // Service fee first — the user is never asked to approve token spend for
      // a run that has not been paid for, and a failure here costs only gas.
      setPhase('fee')
      setChunkLabel('')
      await chargeAirdropFee({
        recipientCount: validRows.length,
        chainId,
        walletClient: walletClient as any,
        publicClient: publicClient as any,
        onStatus: setStatus,
      })

      let airdropContract = getSavedAirdropContract(chainId)
      if (!airdropContract) {
        setPhase('deploying')
        setChunkLabel('')
        airdropContract = await deployAirdropContract(walletClient as any, publicClient as any, chainId, setStatus)
      }

      const chunks: Row[][] = []
      for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
        chunks.push(validRows.slice(i, i + CHUNK_SIZE))
      }

      const allResults: ChunkResult[] = []

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci]
        const label = chunks.length > 1 ? `Batch ${ci + 1} of ${chunks.length} · ` : ''
        setChunkLabel(chunks.length > 1 ? `Batch ${ci + 1} / ${chunks.length}` : '')

        const recipients = chunk.map(r => r.address as `0x${string}`)
        const amounts    = chunk.map(r => parseUnits(r.amount, tokenInfo.decimals))

        setPhase('approving')
        const res = await executeBatchAirdrop({
          tokenAddress:    tokenAddr as `0x${string}`,
          airdropContract,
          recipients,
          amounts,
          walletClient:    walletClient as any,
          publicClient:    publicClient as any,
          onStatus: (s) => {
            setStatus(`${label}${s}`)
            if (s.startsWith('Step 2')) setPhase('sending')
          },
        })

        allResults.push({
          approveTx:  res.approveTx,
          airdropTx:  res.airdropTx,
          recipients: recipients.length,
          total:      formatUnits(amounts.reduce((a, b) => a + b, 0n), tokenInfo.decimals),
        })
      }

      setResults(allResults)
      setPhase('done')
    } catch (e: any) {
      setError(e.shortMessage ?? e.message ?? 'Transaction failed')
      setPhase('idle')
    }
  }

  function exportReceipts() {
    if (!results.length) return
    const lines = ['address,amount', ...validRows.map(r => `${r.address},${r.amount}`), '']
    results.forEach((r, i) => {
      if (results.length > 1) lines.push(`--- Batch ${i + 1} ---`)
      lines.push(`Approve tx,${r.approveTx}`, `Airdrop tx,${r.airdropTx}`, `Recipients,${r.recipients}`, `Total,${r.total} ${tokenInfo?.symbol}`)
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'airdrop-receipt.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const hasEnough = tokenInfo && validRows.length > 0
    ? tokenInfo.balance >= parseUnits(String(totalAmt), tokenInfo.decimals)
    : true
  const isRunning = phase !== 'idle' && phase !== 'done'

  const phaseLabel: Record<Phase, string> = {
    idle:      '',
    fee:       'Paying the service fee…',
    deploying: 'Deploying batch contract (one-time per chain)…',
    approving: 'Approving token spend…',
    sending:   'Sending batch transaction…',
    done:      '',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Shared contract notice (PinkSale model) */}
      {sharedContract ? (
        <div style={{ padding: '14px 16px', borderRadius: 10,
          background: 'rgba(0,230,118,0.06)', border: '0.5px solid rgba(0,230,118,0.25)',
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, color: 'var(--fd-green)', marginBottom: 6,
            display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="check" size={15} />FatDev Multi-Sender Contract
          </div>
          <div style={{ marginBottom: 8 }}>
            This shared contract handles batch sending for all users on this chain.
            You do not need to deploy anything.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)' }}>Contract address:</span>
            <code style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: '#fff',
              background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 5 }}>
              {sharedContract}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(sharedContract)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
                background: 'rgba(0,230,118,0.12)', border: '0.5px solid rgba(0,230,118,0.3)',
                color: 'var(--green)', fontFamily: "'Space Grotesk',sans-serif" }}>
              Copy
            </button>
          </div>
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 7,
            background: 'rgba(255,215,0,0.06)', border: '0.5px solid rgba(255,215,0,0.2)',
            color: 'rgba(255,255,255,0.6)' }}>
            <strong style={{ color: 'var(--gold)' }}>Important:</strong>{' '}
            If your token has anti-bot, fees, or transfer restrictions — exclude the contract above
            from fees, rewards, and max transaction limits before running the airdrop.
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', borderRadius: 10,
          background: 'rgba(74,144,226,0.08)', border: '0.5px solid rgba(74,144,226,0.25)',
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--blue)' }}>Multi-Sender:</strong>{' '}
          A shared FatDev batch contract will be deployed for this chain on first use.
          Lists over {CHUNK_SIZE} wallets split into multiple batches automatically —
          you sign <strong style={{ color: '#fff' }}>2 transactions per batch</strong> (approve + send).
        </div>
      )}

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
          <input className="field-input"
            style={{ flex: 1, fontFamily: "'Space Mono',monospace", fontSize: 12 }}
            placeholder="0x… ERC-20 / BEP-20 token address"
            value={tokenAddr}
            onChange={e => { setTokenAddr(e.target.value); setTokenInfo(null); setTokenError('') }} />
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
              Balance: {Number(formatUnits(tokenInfo.balance, tokenInfo.decimals)).toLocaleString()} {tokenInfo.symbol}
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
          style={{ width: '100%', minHeight: 130,
            background: 'rgba(255,255,255,0.04)', border: '0.5px solid var(--border)',
            borderRadius: 8, color: '#fff', fontFamily: "'Space Mono',monospace",
            fontSize: 12, padding: 12, resize: 'vertical', boxSizing: 'border-box' }}
          placeholder={'0xABC...123, 1000\n0xDEF...456, 2500\n0x789...abc, 500'}
          value={csvText} onChange={e => handleText(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-ghost"
            onClick={() => fileRef.current?.click()}
            style={{ fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="upload" size={13} />Upload CSV</button>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
          {rows.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--green)' }}>{validRows.length}</strong> valid
              {rows.length - validRows.length > 0 && (
                <> · <strong style={{ color: 'var(--red)' }}>{rows.length - validRows.length} invalid</strong></>
              )}
              {tokenInfo && ` · Total: ${totalAmt.toLocaleString()} ${tokenInfo.symbol}`}
            </span>
          )}
        </div>

        {validRows.length > WARN_SIZE && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8,
            background: 'rgba(255,215,0,0.07)', border: '0.5px solid rgba(255,215,0,0.25)',
            fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--fd-cyan)' }}>
              {chunkCount} batches · {validRows.length} wallets
            </strong>
            {' '}— You will sign <strong style={{ color: '#fff' }}>{chunkCount * 2} transactions</strong> total.
          </div>
        )}

        {rows.length > 0 && (
          <div style={{ marginTop: 12, maxHeight: 200, overflowY: 'auto',
            borderRadius: 8, border: '0.5px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['#', 'Address', 'Amount', 'OK'].map((h, i) => (
                    <th key={h} style={{ padding: '5px 10px', fontWeight: 600,
                      color: 'var(--text-muted)', textAlign: i === 2 ? 'right' : i === 3 ? 'center' : 'left' }}>{h}</th>
                  ))}
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
                        ? <Icon name="check" size={13} style={{ color: 'var(--fd-green)', margin: '0 auto' }} />
                        : <Icon name="x" size={13} title={row.error} style={{ color: 'var(--red)', margin: '0 auto' }} />}
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
        <div style={{ fontWeight: 700, marginBottom: 12 }}>3 · Send airdrop</div>

        {tokenInfo && validRows.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))',
            gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Recipients',    value: validRows.length },
              { label: 'Total to send', value: `${totalAmt.toLocaleString()} ${tokenInfo.symbol}` },
              { label: 'Batches',       value: chunkCount },
              { label: 'Service fee',   value: `$${airdropFeeUsd(validRows.length).toFixed(2)}` },
              { label: 'Signatures',    value: chunkCount * 2 + 1 },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'rgba(255,215,0,0.06)', borderRadius: 8,
                padding: '10px 14px', border: '0.5px solid var(--border-strong)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {!tokenInfo && <StatusBox msg="Load a token in step 1 first." type="info" />}
        {tokenInfo && validRows.length === 0 && <StatusBox msg="Add recipients in step 2." type="info" />}
        {tokenInfo && !hasEnough && validRows.length > 0 && (
          <StatusBox msg={`Insufficient balance. Need ${totalAmt.toLocaleString()} but wallet holds ${Number(formatUnits(tokenInfo.balance, tokenInfo.decimals)).toLocaleString()} ${tokenInfo?.symbol}.`} type="err" />
        )}

        {tokenInfo && validRows.length > 0 && (
          <div style={{
            marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: 12,
            background: 'rgba(0,207,255,0.06)', border: '1px solid rgba(0,207,255,0.22)',
            color: 'rgba(255,255,255,0.72)', lineHeight: 1.65,
          }}>
            <strong style={{ color: 'var(--fd-cyan)' }}>
              Service fee ${airdropFeeUsd(validRows.length).toFixed(2)}
            </strong>{' '}
            — $3.00 base + $0.03 per recipient ({validRows.length}). Charged once in this
            chain's native coin at the live USD rate, before any token approval.
          </div>
        )}

        {tokenInfo && hasEnough && validRows.length > 0 && phase === 'idle' && (
          <button className="btn-primary" style={{ width: '100%', padding: 14, fontSize: 15 }} onClick={run}>
            Send to {validRows.length} wallets
            {chunkCount > 1 && ` (${chunkCount} batches)`}
            {' '}— {totalAmt.toLocaleString()} {tokenInfo?.symbol}
          </button>
        )}

        {isRunning && (
          <div>
            {chunkLabel && (
              <div style={{ fontSize: 11, fontFamily: "'Space Mono',monospace",
                color: 'var(--fd-cyan)', marginBottom: 6, letterSpacing: '.05em' }}>
                {chunkLabel}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
              <Spinner />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{phaseLabel[phase]}</span>
            </div>
            <StatusBox msg={status} type="info" />
          </div>
        )}

        {error && <StatusBox msg={error} type="err" />}

        {results.length > 0 && phase === 'done' && (
          <div style={{ borderRadius: 12, border: '0.5px solid rgba(0,230,118,0.3)',
            background: 'rgba(0,230,118,0.06)', padding: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fd-green)', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 9 }}>
              <Icon name="check" size={19} />Airdrop complete!
            </div>
            {results.map((r, i) => (
              <div key={i} style={{ marginBottom: i < results.length - 1 ? 16 : 0 }}>
                {results.length > 1 && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6,
                    fontFamily: "'Space Mono',monospace", letterSpacing: '.08em' }}>
                    BATCH {i + 1} — {r.recipients} wallets · {Number(r.total).toLocaleString()} {tokenInfo?.symbol}
                  </div>
                )}
                <div style={{ fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Approve: </span>
                  <a href={`${chainInfo}/tx/${r.approveTx}`} target="_blank" rel="noopener"
                    style={{ color: 'var(--blue)', fontFamily: "'Space Mono',monospace" }}>
                    {r.approveTx.slice(0, 10)}…{r.approveTx.slice(-6)} ↗
                  </a>
                </div>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Airdrop: </span>
                  <a href={`${chainInfo}/tx/${r.airdropTx}`} target="_blank" rel="noopener"
                    style={{ color: 'var(--green)', fontFamily: "'Space Mono',monospace", fontWeight: 700 }}>
                    {r.airdropTx.slice(0, 10)}…{r.airdropTx.slice(-6)} ↗
                  </a>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={exportReceipts}>↓ Export receipt CSV</button>
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => {
                setResults([]); setPhase('idle'); setCsvText(''); setRows([])
              }}>New airdrop</button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
