import { useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useStore } from '../../lib/store'
import { CHAIN_EXPLORERS } from '../../lib/wagmi'
import { SumTile } from '../ui-kit'
import { LiquidityLaunch } from './LiquidityLaunch'

export function Step7Dashboard() {
  const { address } = useAccount()
  const chainId = useChainId()
  const { getUserData, resetCfg, setStep } = useStore()
  // Track which deploy row has its launch panel expanded
  const [expandedLaunch, setExpandedLaunch] = useState<string | null>(null)
  const user = address ? getUserData(address) : null
  const deploys = user?.deploys ?? []
  const deploysLeft = user ? (user.deploysLimit >= 999 ? '∞' : user.deploysLimit - user.deploysUsed) : 0

  function newDeploy() {
    resetCfg()
    setStep(2)
  }

  return (
    <div className="step-panel">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <SumTile val={address ? `${address.slice(0,6)}…${address.slice(-4)}` : '—'} label="Wallet" />
        <SumTile val={<span style={{ textTransform: 'uppercase' }}>{user?.tier ?? '—'}</span>} label="Plan" />
        <SumTile val={user?.deploysUsed ?? 0} label="Deploys used" />
        <SumTile val={deploysLeft} label="Deploys left" />
      </div>

      {user?.paymentTxHash && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>💳</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Payment on file</div>
            <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {user.paymentTxHash}
            </div>
          </div>
          <span className="pill pill-ok">{user.paymentToken?.toUpperCase()}</span>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontWeight: 700 }}>Deploy history</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{deploys.length} total</span>
        </div>

        {deploys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>
            No deploys yet.
            <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px', marginLeft: 10 }} onClick={newDeploy}>
              Start →
            </button>
          </div>
        ) : deploys.map(d => (
          <div key={d.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
            {/* ── Deploy row ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {d.tokenName} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({d.tokenSymbol})</span>
                </div>
                {d.contractAddress && (
                  <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {d.contractAddress}
                  </div>
                )}
              </div>
              <span className="pill pill-gold" style={{ fontFamily: "'Space Mono',monospace", fontSize: 10 }}>{d.chainName}</span>
              {d.txHash && (
                <a href={`${CHAIN_EXPLORERS[d.chainId]}/tx/${d.txHash}`} target="_blank" rel="noopener"
                  className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}>
                  Explorer →
                </a>
              )}
              {/* Launch sequence button — only for deployed tokens on connected chain */}
              {d.contractAddress && d.chainId === chainId && (
                <button
                  className={expandedLaunch === d.id ? 'btn-primary' : 'btn-ghost'}
                  style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
                  onClick={() => setExpandedLaunch(expandedLaunch === d.id ? null : d.id)}>
                  {expandedLaunch === d.id ? '▲ Close' : '💧 Launch'}
                </button>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {new Date(d.deployedAt).toLocaleDateString()}
              </span>
            </div>

            {/* ── Expanded launch panel ── */}
            {expandedLaunch === d.id && d.contractAddress && (
              <div style={{ paddingBottom: 12 }}>
                <LiquidityLaunch
                  contractAddress={d.contractAddress}
                  tokenSymbol={d.tokenSymbol}
                  tokenDecimals={d.decimals}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {user?.tier !== 'elite' && (
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => setStep(1)}>
            Upgrade plan →
          </button>
        </div>
      )}
      <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn-primary" onClick={newDeploy}>+ New deploy</button>
        <button className="btn-ghost" onClick={() => setStep(8)}>🛠 Tools →</button>
      </div>
    </div>
  )
}
