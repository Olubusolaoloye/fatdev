import { useState } from 'react'
import { useAccount, useWalletClient, usePublicClient, useChainId } from 'wagmi'
import { useStore } from '../../lib/store'
import { deployFatToken, generateParams } from '../../lib/contracts'
import { verifyContract } from '../../lib/verify'
import { CHAIN_EXPLORERS } from '../../lib/wagmi'
import { StatusBox, Spinner, SumTile } from '../ui-kit'
import { LiquidityLaunch } from './LiquidityLaunch'

type DeployResult = { contractAddress: string; txHash: string }
type VerifyState = 'idle' | 'pending' | 'ok' | 'fail'

export function Step6Deploy({ onSuccess: _onSuccess }: { onSuccess: () => void }) {
  const { address } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { cfg, getUserData, addDeploy, patchDeploy, setStep } = useStore()

  const [deploying, setDeploying]         = useState(false)
  const [status,   setStatus]             = useState('')
  const [error,    setError]              = useState('')
  const [result,   setResult]             = useState<DeployResult | null>(null)
  const [verifyState, setVerifyState]     = useState<VerifyState>('idle')
  const [verifyMsg,   setVerifyMsg]       = useState('')

  const user       = address ? getUserData(address) : null
  const deploysLeft = user ? (user.deploysLimit >= 999 ? Infinity : user.deploysLimit - user.deploysUsed) : 0
  const canDeploy  = deploysLeft > 0 && !!walletClient

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

      // Auto-verify immediately after deploy
      setVerifyState('pending')
      const vRes = await verifyContract(
        res.contractAddress,
        res.constructorArgs,
        chainId,
        msg => setVerifyMsg(msg)
      )
      setVerifyState(vRes.success ? 'ok' : 'fail')
      setVerifyMsg(vRes.message)
      if (vRes.success && address) {
        patchDeploy(address, Date.now().toString(), { verified: true })
        // patch by contract address since id was set above
        const u = getUserData(address)
        const rec = u.deploys.find(d => d.contractAddress === res.contractAddress)
        if (rec) patchDeploy(address, rec.id, { verified: true })
      }

    } catch (e: any) {
      setError(e.message || 'Deploy failed')
    }
    setDeploying(false)
  }

  if (result) {
    return (
      <div className="step-panel" style={{ textAlign: 'center', padding: '2.5rem 0' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🚀</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{cfg.name} is live!</h2>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Contract address</div>
          <a href={`${chainInfo}/address/${result.contractAddress}`} target="_blank" rel="noopener"
            className="pill pill-gold" style={{ fontFamily: "'Space Mono',monospace", fontSize: 12 }}>
            {result.contractAddress}
          </a>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Transaction</div>
          <a href={`${chainInfo}/tx/${result.txHash}`} target="_blank" rel="noopener"
            style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: 'var(--blue)' }}>
            {result.txHash}
          </a>
        </div>

        {/* Verification status */}
        <div style={{ marginBottom: 24, padding: '12px 20px', borderRadius: 10,
          background: verifyState === 'ok'      ? 'rgba(0,230,118,0.08)'  :
                      verifyState === 'fail'    ? 'rgba(255,82,82,0.08)'  :
                      verifyState === 'pending' ? 'rgba(74,144,226,0.08)' : 'transparent',
          border: `0.5px solid ${
            verifyState === 'ok'      ? 'rgba(0,230,118,0.3)'  :
            verifyState === 'fail'    ? 'rgba(255,82,82,0.3)'  :
            verifyState === 'pending' ? 'rgba(74,144,226,0.3)' : 'transparent'
          }` }}>
          {verifyState === 'pending' && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--blue)' }}>
                ⏳ Verifying source code…
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{verifyMsg}</div>
            </>
          )}
          {verifyState === 'ok' && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: 'var(--green)' }}>
                ✓ Contract verified
              </div>
              <a href={`${chainInfo}/address/${result.contractAddress}#code`} target="_blank" rel="noopener"
                style={{ fontSize: 12, color: 'var(--blue)' }}>
                View verified source on explorer →
              </a>
            </>
          )}
          {verifyState === 'fail' && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--red)' }}>
                ✗ Verification failed
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{verifyMsg}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                You can verify manually:{' '}
                <a href={`${chainInfo}/verifyContract?a=${result.contractAddress}`} target="_blank" rel="noopener"
                  style={{ color: 'var(--blue)' }}>
                  {chainInfo}/verifyContract
                </a>
                <br />Compiler: 0.8.4 · Optimization: Yes · Runs: 200
              </div>
            </>
          )}
          {verifyState === 'idle' && null}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn-ghost" onClick={() => { setResult(null); setStatus(''); setError(''); setVerifyState('idle'); setVerifyMsg('') }}>
            Deploy another
          </button>
          <button className="btn-primary" onClick={() => setStep(7)}>View dashboard →</button>
        </div>

        {/* ── Launch sequence (approve → addLiquidityETH → startLP → launch) ── */}
        <LiquidityLaunch
          contractAddress={result.contractAddress}
          tokenSymbol={cfg.symbol}
          tokenDecimals={cfg.decimals}
        />
      </div>
    )
  }

  return (
    <div className="step-panel">
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>One-click deploy + auto-verify</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Deploys FatTokenV6 to <strong style={{ color: '#fff' }}>{chainName}</strong> and automatically
          submits the source code for verification on the block explorer.
        </div>

        <div className="grid-4" style={{ marginBottom: 16 }}>
          <SumTile val={cfg.name || '—'} label="Name" />
          <SumTile val={cfg.symbol || '—'} label="Symbol" />
          <SumTile val={chainName} label="Chain" />
          <SumTile val={deploysLeft === Infinity ? '∞' : String(deploysLeft)} label="Deploys left" />
        </div>

        <button className="btn-primary" style={{ width: '100%', padding: 14, fontSize: 15 }}
          onClick={doDeploy} disabled={deploying || !canDeploy}>
          {!canDeploy ? 'No deploys remaining — upgrade plan' : deploying ? 'Deploying…' : '🚀 Deploy & Verify FatTokenV6'}
        </button>
        {deploying && <Spinner />}
        {status && <StatusBox msg={status} type="info" />}
        {error && <StatusBox msg={error} type="err" />}
      </div>

      {/* Remix checklist */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Or deploy manually via Remix</div>
        {[
          ['01', 'Open Remix',       'remix.ethereum.org → paste FatTokenV6.sol'],
          ['02', 'Compiler',         'Solidity 0.8.4 · Optimization · 200 runs'],
          ['03', 'Connect wallet',   `MetaMask → switch to ${chainName}`],
          ['04', 'Paste params',     'Use Review step export above'],
          ['05', 'Deploy',           '~2.5M gas on BSC · confirm in wallet'],
          ['06', 'Verify',           'BSCScan → Verify & Publish'],
          ['07', 'startLP()',        'After adding initial liquidity'],
          ['08', 'launch()',         'Opens public trading — no going back'],
          ['09', 'Disable limits',   'disableSwapLimit() · disableWalletLimit() when stable'],
        ].map(([n, t, d]) => (
          <div key={n} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
            <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: 'var(--text-muted)', minWidth: 22 }}>{n}</span>
            <span style={{ fontSize: 13, flex: 1 }}>{t}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 260, textAlign: 'right' }}>{d}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
