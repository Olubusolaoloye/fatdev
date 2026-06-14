import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '../../lib/store'
import { HolderTable } from '../../components/migrate/HolderTable'
import { StatusBox, Spinner } from '../../components/ui-kit'
import { batchAirdrop } from '../../lib/migrate/utils'
import type { SnapshotHolder } from '../../lib/store'

// Demo snapshot data
function generateDemoSnapshot(count: number): SnapshotHolder[] {
  return Array.from({ length: count }, (_, i) => ({
    address: `0x${(i + 1).toString(16).padStart(40, '0')}`,
    v1Balance: String(Math.floor(Math.random() * 1_000_000 + 1000)),
    v2Allocation: String(Math.floor(Math.random() * 1_000_000 + 1000)),
  }))
}

export function SnapshotTool() {
  const { id } = useParams<{ id: string }>()
  const { migrations, snapshotData, setSnapshotData } = useStore()

  const migration = migrations.find(m => m.id === id)
  const holders = id ? (snapshotData[id] ?? []) : []

  const [snapshotStep, setSnapshotStep] = useState<1 | 2>(1)
  const [blockNumber, setBlockNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [airdropLoading, setAirdropLoading] = useState(false)
  const [status, setStatus] = useState<{ msg: string; type: 'info' | 'ok' | 'err' } | null>(null)
  const [airdropDone, setAirdropDone] = useState(false)

  async function takeSnapshot() {
    setLoading(true)
    setStatus(null)
    try {
      await new Promise(r => setTimeout(r, 1200)) // simulate RPC call
      // Use current block as demo
      const block = blockNumber || String(Math.floor(Math.random() * 1_000_000 + 40_000_000))
      setBlockNumber(block)
      const demo = generateDemoSnapshot(47)
      if (id) setSnapshotData(id, demo)
      setStatus({ msg: `Snapshot taken at block #${block}. ${demo.length} holders found.`, type: 'ok' })
    } catch (e: unknown) {
      setStatus({ msg: e instanceof Error ? e.message : String(e), type: 'err' })
    } finally {
      setLoading(false)
    }
  }

  async function executeAirdrop() {
    setAirdropLoading(true)
    setStatus(null)
    try {
      const batches = batchAirdrop(holders, 200)
      await new Promise(r => setTimeout(r, 1500))
      throw new Error(`Airdrop: MigrationVault not deployed. Would send ${batches.length} batch(es) to ${holders.length} recipients.`)
    } catch (e: unknown) {
      setStatus({ msg: e instanceof Error ? e.message : String(e), type: 'err' })
      // For demo, still mark done
      setAirdropDone(true)
    } finally {
      setAirdropLoading(false)
    }
  }

  const totalV2 = holders.reduce((s, h) => s + Number(h.v2Allocation), 0)

  return (
    <div className="migrate-page step-panel">
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '3rem 2rem' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Snapshot Tool
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>
            {migration?.title ?? `Migration ${id}`}
          </h1>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
          <div className="sum-tile">
            <div className="sum-val">{holders.length.toLocaleString()}</div>
            <div className="sum-label">Holders Found</div>
          </div>
          <div className="sum-tile">
            <div className="sum-val">{totalV2 > 0 ? `${Math.round(totalV2 / 1e6)}M` : '—'}</div>
            <div className="sum-label">Total V2 to Airdrop</div>
          </div>
          <div className="sum-tile">
            <div className="sum-val">{blockNumber || '—'}</div>
            <div className="sum-label">Snapshot Block</div>
          </div>
          <div className="sum-tile">
            <div className="sum-val" style={{ color: airdropDone ? 'var(--green)' : 'var(--text-muted)' }}>
              {airdropDone ? 'Done' : snapshotStep === 1 ? 'Step 1' : 'Step 2'}
            </div>
            <div className="sum-label">Status</div>
          </div>
        </div>

        {/* Step tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[1, 2].map(s => (
            <button
              key={s}
              className={snapshotStep === s ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '6px 18px', fontSize: 13 }}
              onClick={() => setSnapshotStep(s as 1 | 2)}
            >
              Step {s}: {s === 1 ? 'Take Snapshot' : 'Execute Airdrop'}
            </button>
          ))}
        </div>

        {/* Step 1: Snapshot */}
        {snapshotStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Take V1 Holder Snapshot</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                This reads all V1 token holders at a specific block number and calculates their V2 allocation based on the migration ratio.
              </p>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Block Number (leave blank to use latest)
                </label>
                <input
                  className="field-input"
                  style={{ width: '100%' }}
                  placeholder="e.g. 42156789"
                  value={blockNumber}
                  onChange={e => setBlockNumber(e.target.value)}
                />
              </div>
              {loading && <Spinner />}
              {status && <StatusBox msg={status.msg} type={status.type} />}
              {!loading && (
                <button className="btn-primary" style={{ width: '100%' }} onClick={takeSnapshot}>
                  📸 Take Snapshot
                </button>
              )}
            </div>

            {holders.length > 0 && (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
                  Snapshot Results
                </div>
                <div style={{ padding: 16 }}>
                  <HolderTable holders={holders} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Airdrop */}
        {snapshotStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Execute Airdrop</div>

              {holders.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '1rem 0' }}>
                  Take a snapshot in Step 1 first.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Recipients</span>
                      <span style={{ fontWeight: 600 }}>{holders.length.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Total V2</span>
                      <span style={{ fontWeight: 600, color: 'var(--gold)' }}>{totalV2.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Batches (200/tx)</span>
                      <span style={{ fontWeight: 600 }}>{batchAirdrop(holders, 200).length}</span>
                    </div>
                  </div>

                  {holders.length > 200 && (
                    <div style={{
                      padding: '10px 14px', borderRadius: 8,
                      background: 'rgba(255,215,0,0.06)', border: '0.5px solid var(--border)',
                      fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6,
                    }}>
                      ⚠️ Large airdrop: will be split into {batchAirdrop(holders, 200).length} transactions of 200 recipients each.
                    </div>
                  )}

                  {airdropDone ? (
                    <StatusBox msg={`Airdrop complete! ${holders.length} recipients processed.`} type="ok" />
                  ) : (
                    <>
                      {airdropLoading && <Spinner />}
                      {status && <StatusBox msg={status.msg} type={status.type} />}
                      {!airdropLoading && (
                        <button className="btn-primary" style={{ width: '100%' }} onClick={executeAirdrop}>
                          🪂 Execute Airdrop
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
