import { useState } from 'react'
import { useAccount, useWalletClient, usePublicClient, useChainId } from 'wagmi'
import { useStore } from '../../lib/store'
import { deployFatToken, generateParams } from '../../lib/contracts'
import { verifyContract } from '../../lib/verify'
import { CHAIN_EXPLORERS } from '../../lib/wagmi'
import { StatusBox, Spinner, SumTile, Btn } from '../ui-kit'
import Logo from '../ui-kit/Logo'
import { LiquidityLaunch } from './LiquidityLaunch'

type DeployResult = { contractAddress: string; txHash: string; constructorArgs?: string }
type VerifyState = 'idle' | 'pending' | 'ok' | 'fail'

export function Step6Deploy({ onSuccess: _onSuccess }: { onSuccess: () => void }) {
  const { address } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { cfg, getUserData, addDeploy, patchDeploy, setStep } = useStore()

  const [deploying, setDeploying]     = useState(false)
  const [status,   setStatus]         = useState('')
  const [error,    setError]          = useState('')
  const [result,   setResult]         = useState<DeployResult | null>(null)
  const [verifyState, setVerifyState] = useState<VerifyState>('idle')
  const [verifyMsg,   setVerifyMsg]   = useState('')

  const user        = address ? getUserData(address) : null
  const deploysLeft = user ? (user.deploysLimit >= 999 ? Infinity : user.deploysLimit - user.deploysUsed) : 0
  const canDeploy   = deploysLeft > 0 && !!walletClient

  const chainInfo = CHAIN_EXPLORERS[chainId]
  const chainName = { 56: 'BNB Chain', 1: 'Ethereum', 42161: 'Arbitrum One', 97: 'BSC Testnet' }[chainId] ?? `Chain ${chainId}`

  async function doDeploy() {
    if (!walletClient || !publicClient || !address) return
    setDeploying(true); setError(''); setStatus(''); setVerifyState('idle'); setVerifyMsg('')
    try {
      const res = await deployFatToken(
        { ...cfg, fundAddress: cfg.fundAddress as any, receiveAddress: cfg.receiveAddress as any, rewardToken: cfg.rewardToken as any, chainId },
        walletClient as any, publicClient as any, setStatus
      )
      setResult(res)
      if (address) {
        addDeploy(address, {
          id: Date.now().toString(),
          tokenName: cfg.name, tokenSymbol: cfg.symbol,
          decimals: cfg.decimals,
          contractAddress: res.contractAddress, txHash: res.txHash,
          chainId, chainName, deployedAt: new Date().toISOString(),
          configSnapshot: generateParams(cfg, chainId),
          verified: false,
        })
      }
      setVerifyState('pending')
      const vRes = await verifyContract(res.contractAddress, res.constructorArgs, chainId, msg => setVerifyMsg(msg))
      setVerifyState(vRes.success ? 'ok' : 'fail')
      setVerifyMsg(vRes.message)
      if (vRes.success && address) {
        const u = getUserData(address)
        const rec = u.deploys.find(d => d.contractAddress === res.contractAddress)
        if (rec) patchDeploy(address, rec.id, { verified: true })
      }
    } catch (e: any) {
      setError(e.message || 'Deploy failed')
    }
    setDeploying(false)
  }

  // ── Success state ────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Hero success card */}
        <div style={{
          background: 'var(--fd-surface)',
          border: '1px solid var(--fd-border-green)',
          borderRadius: 'var(--fd-radius-lg)',
          padding: '32px 24px',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Logo variant="mark" size={48} />
          </div>
          <h2 style={{
            fontSize: 22, fontWeight: 700,
            color: 'var(--fd-green)',
            fontFamily: 'var(--fd-font-display)',
            marginBottom: 6,
          }}>
            Token deployed!
          </h2>
          <p style={{ fontSize: 14, color: 'var(--fd-ghost)', marginBottom: 24 }}>
            {cfg.name} ({cfg.symbol}) is live on {chainName}
          </p>

          {/* Contract address */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 11, fontFamily: 'var(--fd-font-mono)', color: 'var(--fd-ghost)',
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6,
            }}>Contract address</div>
            <a href={`${chainInfo}/address/${result.contractAddress}`} target="_blank" rel="noopener"
              style={{
                fontFamily: 'var(--fd-font-mono)', fontSize: 12,
                color: 'var(--fd-cyan)', textDecoration: 'none', wordBreak: 'break-all',
              }}>
              {result.contractAddress} ↗
            </a>
          </div>

          {/* Tx hash */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 11, fontFamily: 'var(--fd-font-mono)', color: 'var(--fd-ghost)',
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6,
            }}>Transaction</div>
            <a href={`${chainInfo}/tx/${result.txHash}`} target="_blank" rel="noopener"
              style={{
                fontFamily: 'var(--fd-font-mono)', fontSize: 11,
                color: 'var(--fd-cyan)', textDecoration: 'none', wordBreak: 'break-all',
              }}>
              {result.txHash} ↗
            </a>
          </div>

          {/* Verification status */}
          {verifyState !== 'idle' && (
            <div style={{
              padding: '12px 16px', borderRadius: 'var(--fd-radius)', marginBottom: 24,
              borderLeft: `3px solid ${
                verifyState === 'ok'      ? 'var(--fd-green)' :
                verifyState === 'fail'    ? '#FF6B6B' :
                'var(--fd-cyan)'
              }`,
              background: verifyState === 'ok'      ? 'var(--fd-green-ghost)'  :
                          verifyState === 'fail'    ? 'rgba(255,80,80,0.08)'   :
                          'var(--fd-cyan-ghost)',
              textAlign: 'left',
            }}>
              {verifyState === 'pending' && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fd-cyan)', marginBottom: 4 }}>
                    Verifying source code…
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fd-ghost)' }}>{verifyMsg}</div>
                </>
              )}
              {verifyState === 'ok' && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fd-green)', marginBottom: 4 }}>
                    ✓ Contract verified
                  </div>
                  <a href={`${chainInfo}/address/${result.contractAddress}#code`} target="_blank" rel="noopener"
                    style={{ fontSize: 12, color: 'var(--fd-cyan)', textDecoration: 'none' }}>
                    View verified source on explorer →
                  </a>
                </>
              )}
              {verifyState === 'fail' && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#FF6B6B', marginBottom: 4 }}>
                    ✗ Verification failed
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fd-ghost)', marginBottom: 6 }}>{verifyMsg}</div>
                  <div style={{ fontSize: 11, color: 'var(--fd-hint)' }}>
                    Verify manually:{' '}
                    <a href={`${chainInfo}/verifyContract?a=${result.contractAddress}`} target="_blank" rel="noopener"
                      style={{ color: 'var(--fd-cyan)', textDecoration: 'none' }}>
                      {chainInfo}/verifyContract
                    </a>
                    <br />Compiler: 0.8.4 · Optimization: Yes · Runs: 200
                  </div>
                </>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Btn variant="ghost" onClick={() => { setResult(null); setStatus(''); setError(''); setVerifyState('idle'); setVerifyMsg('') }}>
              Deploy another
            </Btn>
            <Btn variant="primary" onClick={() => setStep(7)}>View dashboard →</Btn>
          </div>
        </div>

        {/* Launch sequence */}
        <LiquidityLaunch
          contractAddress={result.contractAddress}
          tokenSymbol={cfg.symbol}
          tokenDecimals={cfg.decimals}
        />
      </div>
    )
  }

  // ── Pre-deploy state ─────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Deploy card */}
      <div style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        borderRadius: 'var(--fd-radius-lg)',
        padding: '24px',
      }}>
        <div style={{
          fontFamily: 'var(--fd-font-display)', fontWeight: 600, fontSize: 15,
          color: 'var(--fd-white)', marginBottom: 6,
        }}>
          One-click deploy + auto-verify
        </div>
        <div style={{ fontSize: 13, color: 'var(--fd-ghost)', marginBottom: 20, lineHeight: 1.6 }}>
          Deploys FatTokenV6 to{' '}
          <strong style={{ color: 'var(--fd-white)' }}>{chainName}</strong>{' '}
          and automatically submits the source code for verification on the block explorer.
        </div>

        {/* Summary tiles */}
        <div style={{
          background: 'var(--fd-deep)',
          border: '1px solid var(--fd-border)',
          borderRadius: 'var(--fd-radius)',
          padding: '4px 16px',
          marginBottom: 20,
        }}>
          <SumTile val={cfg.name || '—'} label="Name" />
          <SumTile val={cfg.symbol || '—'} label="Symbol" />
          <SumTile val={chainName} label="Chain" />
          <SumTile val={deploysLeft === Infinity ? '∞' : String(deploysLeft)} label="Deploys left" />
        </div>

        <Btn
          variant="primary"
          onClick={doDeploy}
          disabled={deploying || !canDeploy}
          style={{ width: '100%', justifyContent: 'center', height: 52, fontSize: 16 }}>
          {!canDeploy ? 'No deploys remaining — upgrade plan' : deploying ? 'Deploying…' : '↑ Deploy & Verify FatTokenV6'}
        </Btn>

        {deploying && <Spinner />}
        {status && <StatusBox msg={status} type="info" />}
        {error   && <StatusBox msg={error}  type="err" />}
      </div>

      {/* Remix checklist */}
      <div style={{
        background: 'var(--fd-surface)',
        border: '1px solid var(--fd-border)',
        borderRadius: 'var(--fd-radius-lg)',
        padding: '20px',
      }}>
        <div style={{
          fontFamily: 'var(--fd-font-display)', fontWeight: 600, fontSize: 14,
          color: 'var(--fd-white)', marginBottom: 14,
        }}>
          Or deploy manually via Remix
        </div>
        {([
          ['01', 'Open Remix',       'remix.ethereum.org → paste FatTokenV6.sol'],
          ['02', 'Compiler',         'Solidity 0.8.4 · Optimization · 200 runs'],
          ['03', 'Connect wallet',   `MetaMask → switch to ${chainName}`],
          ['04', 'Paste params',     'Use Review step export above'],
          ['05', 'Deploy',           '~2.5M gas on BSC · confirm in wallet'],
          ['06', 'Verify',           'BSCScan → Verify & Publish'],
          ['07', 'startLP()',        'After adding initial liquidity'],
          ['08', 'launch()',         'Opens public trading — no going back'],
          ['09', 'Disable limits',   'disableSwapLimit() · disableWalletLimit() when stable'],
        ] as const).map(([n, t, d]) => (
          <div key={n} style={{
            display: 'flex', gap: 12, padding: '8px 0',
            borderBottom: '1px solid var(--fd-border)',
          }}>
            <span style={{
              fontFamily: 'var(--fd-font-mono)', fontSize: 11,
              color: 'var(--fd-hint)', minWidth: 22,
            }}>{n}</span>
            <span style={{ fontSize: 13, flex: 1, color: 'var(--fd-white)' }}>{t}</span>
            <span style={{
              fontSize: 11, color: 'var(--fd-ghost)', maxWidth: 260, textAlign: 'right',
            }}>{d}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
