import { useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useStore } from '../../lib/store'
import { CHAIN_EXPLORERS } from '../../lib/wagmi'
import { SumTile, Badge, Btn } from '../ui-kit'
import { LiquidityLaunch } from './LiquidityLaunch'

export function Step7Dashboard() {
  const { address } = useAccount()
  const chainId = useChainId()
  const { getUserData, resetCfg, setStep } = useStore()
  const [expandedLaunch, setExpandedLaunch] = useState<string | null>(null)

  const user        = address ? getUserData(address) : null
  const deploys     = user?.deploys ?? []
  const deploysLeft = user ? (user.deploysLimit >= 999 ? '∞' : user.deploysLimit - user.deploysUsed) : 0

  function newDeploy() {
    resetCfg()
    setStep(2)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats row */}
      <div style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        borderRadius: 'var(--fd-radius-lg)',
        padding: '4px 20px',
      }}>
        <SumTile val={address ? `${address.slice(0,6)}…${address.slice(-4)}` : '—'} label="Wallet" />
        <SumTile val={<span style={{ textTransform: 'uppercase' }}>{user?.tier ?? '—'}</span>} label="Plan" />
        <SumTile val={user?.deploysUsed ?? 0} label="Deploys used" />
        <SumTile val={deploysLeft} label="Deploys left" />
      </div>

      {/* Payment on file */}
      {user?.paymentTxHash && (
        <div style={{
          background: 'var(--fd-surface)',
          border: '1px solid var(--fd-border)',
          borderRadius: 'var(--fd-radius-lg)',
          padding: '16px 20px',
          display: 'flex', gap: 12, alignItems: 'center',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: 'var(--fd-white)',
              fontFamily: 'var(--fd-font-display)', marginBottom: 4,
            }}>Payment on file</div>
            <div style={{
              fontFamily: 'var(--fd-font-mono)', fontSize: 11,
              color: 'var(--fd-ghost)', wordBreak: 'break-all',
            }}>
              {user.paymentTxHash}
            </div>
          </div>
          <Badge variant="green">{user.paymentToken?.toUpperCase()}</Badge>
        </div>
      )}

      {/* Deploy history */}
      <div style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        borderRadius: 'var(--fd-radius-lg)',
        padding: '20px',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 16,
        }}>
          <span style={{
            fontFamily: 'var(--fd-font-display)', fontWeight: 600,
            fontSize: 15, color: 'var(--fd-white)',
          }}>Deploy history</span>
          <span style={{
            fontSize: 11, fontFamily: 'var(--fd-font-mono)',
            color: 'var(--fd-ghost)',
          }}>{deploys.length} total</span>
        </div>

        {deploys.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            color: 'var(--fd-ghost)', fontSize: 13,
          }}>
            No deploys yet.{' '}
            <button
              onClick={newDeploy}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--fd-cyan)', fontSize: 13,
                fontFamily: 'var(--fd-font-display)',
              }}>
              Start →
            </button>
          </div>
        ) : deploys.map(d => (
          <div key={d.id} style={{ borderBottom: '1px solid var(--fd-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', flexWrap: 'wrap' }}>
              {/* Token info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 600, fontSize: 14, color: 'var(--fd-white)',
                  fontFamily: 'var(--fd-font-display)',
                }}>
                  {d.tokenName}{' '}
                  <span style={{ color: 'var(--fd-ghost)', fontWeight: 400 }}>({d.tokenSymbol})</span>
                </div>
                {d.contractAddress && (
                  <div style={{
                    fontFamily: 'var(--fd-font-mono)', fontSize: 11,
                    color: 'var(--fd-hint)', marginTop: 3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {d.contractAddress}
                  </div>
                )}
              </div>

              {/* Chain badge */}
              <Badge variant="default">{d.chainName}</Badge>

              {/* Status badge */}
              <Badge variant="green">deployed</Badge>

              {/* Explorer link */}
              {d.txHash && (
                <a
                  href={`${CHAIN_EXPLORERS[d.chainId]}/tx/${d.txHash}`}
                  target="_blank" rel="noopener"
                  style={{
                    fontSize: 12, color: 'var(--fd-cyan)', textDecoration: 'none',
                    fontFamily: 'var(--fd-font-display)', whiteSpace: 'nowrap',
                  }}>
                  Explorer ↗
                </a>
              )}

              {/* Launch button */}
              {d.contractAddress && d.chainId === chainId && (
                <Btn
                  variant={expandedLaunch === d.id ? 'primary' : 'secondary'}
                  onClick={() => setExpandedLaunch(expandedLaunch === d.id ? null : d.id)}
                  style={{ fontSize: 12, padding: '6px 14px' }}>
                  {expandedLaunch === d.id ? '▲ Close' : '💧 Launch'}
                </Btn>
              )}

              {/* Date */}
              <span style={{
                fontSize: 11, fontFamily: 'var(--fd-font-mono)',
                color: 'var(--fd-hint)',
              }}>
                {new Date(d.deployedAt).toLocaleDateString()}
              </span>
            </div>

            {/* Expanded launch panel */}
            {expandedLaunch === d.id && d.contractAddress && (
              <div style={{ paddingBottom: 16 }}>
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

      {/* Bottom actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Btn variant="primary" onClick={newDeploy} style={{ flex: 1, justifyContent: 'center' }}>
          + New deploy
        </Btn>
        {user?.tier !== 'elite' && (
          <Btn variant="secondary" onClick={() => setStep(1)}>
            Upgrade plan →
          </Btn>
        )}
        <Btn variant="ghost" onClick={() => setStep(8)}>🛠 Tools</Btn>
      </div>
    </div>
  )
}
