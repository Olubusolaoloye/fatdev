import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount, useWalletClient, usePublicClient, useChainId } from 'wagmi'
import { useStore } from '../../lib/store'
import { deployToken, generateParams } from '../../lib/contracts'
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
  const { cfg, getUserData, addDeploy, setStep } = useStore()

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
  const chainName = { 56: 'BNB Chain', 1: 'Ethereum', 42161: 'Arbitrum One', 97: 'BSC Testnet', 4663: 'Robinhood Chain' }[chainId] ?? `Chain ${chainId}`

  async function doDeploy() {
    if (!walletClient || !publicClient || !address) return
    setDeploying(true); setError(''); setStatus(''); setVerifyState('idle'); setVerifyMsg('')
    try {
      const res = await deployToken(
        {
          name: cfg.name, symbol: cfg.symbol, decimals: cfg.decimals, totalSupply: cfg.totalSupply,
          tokenType: cfg.tokenType,
          fundAddress: cfg.fundAddress as `0x${string}`,
          receiveAddress: cfg.receiveAddress as `0x${string}`,
          teamWallet: (cfg.teamWallet || '') as `0x${string}`,
          buybackWallet: (cfg.buybackWallet || '') as `0x${string}`,
          taxOnTransfer: cfg.taxOnTransfer, taxOnBuy: cfg.taxOnBuy, taxOnSell: cfg.taxOnSell,
          buyTax: cfg.buyTax, sellTax: cfg.sellTax, transferTax: cfg.transferTax,
          mktPct: cfg.mktPct, lpPct: cfg.lpPct, teamPct: cfg.teamPct, buybackPct: cfg.buybackPct, burnPct: cfg.burnPct,
          chainId,
        },
        walletClient as any, publicClient as any, setStatus
      )
      setResult(res)
      // Kick off verification in the background â€” don't await so UI shows immediately
      setVerifyState('pending')
      verifyContract(res.contractAddress, cfg.tokenType, chainId, setVerifyMsg)
        .then(v => { setVerifyState(v.success ? 'ok' : 'fail'); setVerifyMsg(v.message) })
        .catch(e => { setVerifyState('fail'); setVerifyMsg(e.message) })
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
    } catch (e: any) {
      setError(e.message || 'Deploy failed')
    }
    setDeploying(false)
  }

  // â”€â”€ Success state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
              {result.contractAddress} â†—
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
              {result.txHash} â†—
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
                    Verifying source codeâ€¦
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fd-ghost)' }}>{verifyMsg}</div>
                </>
              )}
              {verifyState === 'ok' && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fd-green)', marginBottom: 4 }}>
                    âœ“ Contract verified
                  </div>
                  <a href={`${chainInfo}/address/${result.contractAddress}#code`} target="_blank" rel="noopener"
                    style={{ fontSize: 12, color: 'var(--fd-cyan)', textDecoration: 'none' }}>
                    View verified source on explorer â†’
                  </a>
                </>
              )}
              {verifyState === 'fail' && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#FF6B6B', marginBottom: 4 }}>
                    âœ— Verification failed
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fd-ghost)', marginBottom: 6 }}>{verifyMsg}</div>
                  <div style={{ fontSize: 11, color: 'var(--fd-hint)' }}>
                    Verify manually:{' '}
                    <a href={`${chainInfo}/verifyContract?a=${result.contractAddress}`} target="_blank" rel="noopener"
                      style={{ color: 'var(--fd-cyan)', textDecoration: 'none' }}>
                      {chainInfo}/verifyContract
                    </a>
                    <br />Compiler: 0.8.4 Â· Optimization: Yes Â· Runs: 200
                  </div>
                </>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Btn variant="ghost" onClick={() => { setResult(null); setStatus(''); setError(''); setVerifyState('idle'); setVerifyMsg('') }}>
              Deploy another
            </Btn>
            <Btn variant="primary" onClick={() => setStep(7)}>View dashboard â†’</Btn>
          </div>
        </div>

        {/* Launch sequence */}
        <LiquidityLaunch
          contractAddress={result.contractAddress}
          tokenSymbol={cfg.symbol}
          tokenDecimals={cfg.decimals}
          tokenType={cfg.tokenType}
        />
      </div>
    )
  }

  // â”€â”€ Pre-deploy state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Robinhood Chain gas hint */}
      {chainId === 4663 && (
        <div style={{
          padding: '14px 18px', borderRadius: 'var(--fd-radius-lg)',
          background: 'rgba(0,207,255,0.06)', border: '1px solid rgba(0,207,255,0.2)',
          fontSize: 13, color: 'var(--fd-ghost)', lineHeight: 1.6,
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>⛽</span>
          <div>
            <span style={{ color: 'var(--fd-cyan)', fontWeight: 600 }}>Robinhood Chain uses ETH for gas.</span>{' '}
            Make sure your wallet has ETH on this chain before deploying.{' '}
            <Link to="/bridge" style={{ color: 'var(--fd-cyan)', textDecoration: 'none', fontWeight: 600 }}>
              Bridge ETH here →
            </Link>
          </div>
        </div>
      )}

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
          Deploys your{' '}
          <strong style={{ color: 'var(--fd-white)', textTransform: 'capitalize' }}>Fat{cfg.tokenType}</strong>{' '}
          token to <strong style={{ color: 'var(--fd-white)' }}>{chainName}</strong>{' '}
          via the FatFactory contract.
        </div>

        {/* Summary tiles */}
        <div style={{
          background: 'var(--fd-deep)',
          border: '1px solid var(--fd-border)',
          borderRadius: 'var(--fd-radius)',
          padding: '4px 16px',
          marginBottom: 20,
        }}>
          <SumTile val={cfg.name || 'â€”'} label="Name" />
          <SumTile val={cfg.symbol || 'â€”'} label="Symbol" />
          <SumTile val={chainName} label="Chain" />
          <SumTile val={deploysLeft === Infinity ? 'âˆž' : String(deploysLeft)} label="Deploys left" />
        </div>

        <Btn
          variant="primary"
          onClick={doDeploy}
          disabled={deploying || !canDeploy}
          style={{ width: '100%', justifyContent: 'center', height: 52, fontSize: 16 }}>
          {!canDeploy ? 'No deploys remaining â€” upgrade plan' : deploying ? 'Deployingâ€¦' : `â†‘ Deploy Fat${cfg.tokenType.charAt(0).toUpperCase() + cfg.tokenType.slice(1)} Token`}
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
          ['01', 'Open Remix',       'remix.ethereum.org â†’ paste FatFactory.sol + token contracts'],
          ['02', 'Compiler',         'Solidity 0.8.20 Â· Optimization Â· 200 runs Â· viaIR'],
          ['03', 'Connect wallet',   `MetaMask â†’ switch to ${chainName}`],
          ['04', 'Deploy impls',     'Deploy FatStandard, FatTax, FatDeflationary, FatReflection'],
          ['05', 'Deploy factory',   'Deploy FatFactory with impl addresses + Chainlink feed'],
          ['06', 'Create token',     `Call create${cfg.tokenType.charAt(0).toUpperCase() + cfg.tokenType.slice(1)}Token() with params from Review step`],
          ['07', 'Add liquidity',    'Add token + native to DEX pair'],
          ['08', 'launch()',         'Opens public trading â€” irreversible'],
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

