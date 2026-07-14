import type { PropsWithChildren } from 'react'
import { useMemo, useRef } from 'react'
import { useAccount, useWalletClient, usePublicClient, useDisconnect, useSwitchChain, useChainId } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { ChainType } from '@lifi/widget'
import { EthereumContext } from '@lifi/widget-provider'
import type { EthereumProviderContext } from '@lifi/widget-provider'
import {
  isAddress as viemIsAddress,
  createPublicClient,
  http,
  erc20Abi,
  type WalletClient,
} from 'viem'
// Runtime import — StatusManager drives the widget's confirmation + progress UI
import { StatusManager } from '@lifi/sdk'
import type {
  SDKClient,
  StepExecutorOptions,
  ExecutionActionType,
  ExecutionActionStatus,
  LiFiStepExtended,
} from '@lifi/sdk'
import type { Token, TokenAmount } from '@lifi/types'

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

// ── Minimal StepExecutor wired to StatusManager for proper widget UI ──────────

class EVMStepExecutor {
  allowUserInteraction = true
  allowExecution = true

  private wcRef:     { current: WalletClient | null | undefined } = { current: null }
  private switchRef: { current: ((chainId: number) => Promise<void>) | null } = { current: null }

  constructor(private options: StepExecutorOptions) {}

  setInteraction(s?: { allowInteraction?: boolean; allowUpdates?: boolean; allowExecution?: boolean }) {
    if (s?.allowInteraction !== undefined) this.allowUserInteraction = s.allowInteraction
    if (s?.allowExecution   !== undefined) this.allowExecution       = s.allowExecution
  }

  setRefs(wc: WalletClient | null | undefined, sw: (chainId: number) => Promise<void>) {
    this.wcRef.current     = wc
    this.switchRef.current = sw
  }

  async executeStep(client: SDKClient, step: LiFiStepExtended): Promise<LiFiStepExtended> {
    const wc = this.wcRef.current
    if (!wc?.account) throw new Error('Wallet not connected')

    // StatusManager drives widget confirmation modals + progress steps.
    // Vite deduplicates @lifi/sdk so this shares executionState with the widget.
    const sm = new StatusManager(this.options.routeId)

    // Safe wrappers — if SM throws we degrade gracefully (execution still works)
    const smInit   = () => { try { sm.initializeExecution(step) } catch {} }
    const smAction = (type: ExecutionActionType, chainId: number, status: ExecutionActionStatus) =>
      { try { sm.initializeAction({ step, type, chainId, status }) } catch {} }
    const smUpdate = (type: ExecutionActionType, status: ExecutionActionStatus, params?: Record<string, unknown>) =>
      { try { sm.updateAction(step, type, status, params as any) } catch {} }
    const smDone   = () => { try { sm.updateExecution(step, { status: 'DONE'   }) } catch {} }
    const smFail   = (message: string) => {
      try { sm.updateExecution(step, { status: 'FAILED', error: { code: 'EXECUTION_ERROR', message } } as any) } catch {}
    }

    smInit()

    const fromChainId: number = step.action.fromChainId
    const toChainId:   number = step.action.toChainId
    const isBridge            = fromChainId !== toChainId
    const mainActionType: ExecutionActionType = isBridge ? 'CROSS_CHAIN' : 'SWAP'

    // Get RPC for source chain
    let rpcUrl: string
    try {
      const urls = await client.getRpcUrlsByChainId(fromChainId)
      rpcUrl = urls[0]
    } catch {
      smFail('Could not resolve RPC for source chain')
      throw new Error('Could not resolve RPC for source chain')
    }
    const pub = createPublicClient({ transport: http(rpcUrl) })

    // ── 1. Get transaction data from LI.FI API ───────────────────────────────
    const apiUrl = (client as any).config?.apiUrl ?? 'https://li.quest/v1'
    const txRes  = await fetch(`${apiUrl}/advanced/stepTransaction`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...step, execution: undefined }),
    })
    if (!txRes.ok) {
      const msg = `LI.FI API error: ${txRes.status}`
      smFail(msg)
      throw new Error(msg)
    }
    const txStep = await txRes.json()
    const txReq  = txStep.transactionRequest
    if (!txReq?.to || !txReq?.data) {
      smFail('No transaction request returned')
      throw new Error('No transaction request returned')
    }
    step.transactionRequest = txReq

    // ── 2. Switch to source chain ────────────────────────────────────────────
    try {
      await this.switchRef.current!(fromChainId)
    } catch (e: any) {
      smFail(e.message)
      throw e
    }

    // ── 3. ERC20 approval if needed ──────────────────────────────────────────
    const fromToken    = step.action.fromToken
    const approvalAddr = step.estimate?.approvalAddress
    if (fromToken.address.toLowerCase() !== ZERO_ADDR && approvalAddr) {
      try {
        const allowance = await pub.readContract({
          address:      fromToken.address as `0x${string}`,
          abi:          erc20Abi,
          functionName: 'allowance',
          args:         [wc.account.address, approvalAddr as `0x${string}`],
        }) as bigint

        if (allowance < BigInt(step.action.fromAmount)) {
          smAction('SET_ALLOWANCE', fromChainId, 'ACTION_REQUIRED')
          const h = await wc.writeContract({
            address:      fromToken.address as `0x${string}`,
            abi:          erc20Abi,
            functionName: 'approve',
            args:         [approvalAddr as `0x${string}`, BigInt(step.action.fromAmount)],
            chain:        null,
            account:      wc.account,
          })
          smUpdate('SET_ALLOWANCE', 'PENDING', { txHash: h })
          await pub.waitForTransactionReceipt({ hash: h })
          smUpdate('SET_ALLOWANCE', 'DONE', { txHash: h })
        }
      } catch (e: any) {
        smUpdate('SET_ALLOWANCE', 'FAILED')
        smFail(e.message)
        throw e
      }
    }

    // ── 4. Send bridge/swap tx — ACTION_REQUIRED triggers wallet modal ───────
    smAction(mainActionType, fromChainId, 'ACTION_REQUIRED')
    let txHash: `0x${string}`
    try {
      txHash = await wc.sendTransaction({
        to:      txReq.to   as `0x${string}`,
        data:    txReq.data as `0x${string}`,
        value:   txReq.value ? BigInt(txReq.value) : 0n,
        chain:   null,
        account: wc.account,
      })
    } catch (e: any) {
      smUpdate(mainActionType, 'FAILED')
      smFail(e.message)
      throw e
    }

    smUpdate(mainActionType, 'PENDING', { txHash })

    // ── 5. Wait for source-chain confirmation ────────────────────────────────
    try {
      await pub.waitForTransactionReceipt({ hash: txHash })
    } catch (e: any) {
      smUpdate(mainActionType, 'FAILED', { txHash })
      smFail(e.message)
      throw e
    }
    smUpdate(mainActionType, 'DONE', { txHash })

    // ── 6. Wait for destination chain (bridges only) ─────────────────────────
    if (isBridge) {
      smAction('RECEIVING_CHAIN', toChainId, 'PENDING')
      const bridge       = step.tool
      const statusParams = new URLSearchParams({
        txHash,
        fromChain: String(fromChainId),
        toChain:   String(toChainId),
        ...(bridge ? { bridge } : {}),
      })
      let done = false
      for (let i = 0; i < 120 && !done; i++) {
        await new Promise(r => setTimeout(r, 5000))
        try {
          const sr = await fetch(`${apiUrl}/status?${statusParams}`)
          if (sr.ok) {
            const s = await sr.json()
            if (s.status === 'DONE') {
              done = true
              smUpdate('RECEIVING_CHAIN', 'DONE', { txHash: s.receiving?.txHash })
              if (step.execution) {
                step.execution.toAmount = s.receiving?.amount
                step.execution.toToken  = s.receiving?.token
              }
            } else if (s.status === 'FAILED') {
              smUpdate('RECEIVING_CHAIN', 'FAILED')
              smFail('Bridge transaction failed on destination chain')
              throw new Error('Bridge transaction failed on destination chain')
            }
          }
        } catch (e: any) {
          if (e?.message?.includes('failed')) { smFail(e.message); throw e }
        }
      }
      if (!done) {
        smUpdate('RECEIVING_CHAIN', 'FAILED')
        smFail('Bridge status timed out after 10 minutes')
        throw new Error('Bridge status timed out after 10 minutes')
      }
    }

    smDone()
    return step
  }
}

// ── WagmiLiFiAdapter ──────────────────────────────────────────────────────────

export function WagmiLiFiAdapter({ children }: PropsWithChildren) {
  const { address, isConnected, isConnecting, isReconnecting, status, connector } = useAccount()
  const chainId                = useChainId()
  const { data: walletClient } = useWalletClient()
  const publicClient           = usePublicClient()
  const { disconnect }         = useDisconnect()
  const { switchChainAsync }   = useSwitchChain()
  const { openConnectModal }   = useConnectModal()

  // Refs so executors always see fresh wallet/switch without invalidating the memo
  const wcRef       = useRef(walletClient)
  wcRef.current     = walletClient
  const switchRef   = useRef(switchChainAsync)
  switchRef.current = switchChainAsync

  const contextValue: EthereumProviderContext = useMemo(() => ({
    isEnabled:         true,
    isExternalContext: true,
    isConnected,
    account: {
      address,
      chainId,
      chainType:      ChainType.EVM,
      isConnected,
      isConnecting,
      isReconnecting,
      isDisconnected: !isConnected && !isConnecting && !isReconnecting,
      status,
      connector: connector ? {
        id:          connector.id,
        uid:         connector.uid,
        name:        connector.name,
        displayName: connector.name,
      } : undefined,
    },

    sdkProvider: isConnected ? {
      type: ChainType.EVM,

      isAddress: (addr: string) => viemIsAddress(addr),

      async resolveAddress() { return undefined },

      async getBalance(client: SDKClient, walletAddress: string, tokens: Token[]): Promise<TokenAmount[]> {
        const byChain: Record<number, Token[]> = {}
        for (const t of tokens) {
          ;(byChain[t.chainId] ??= []).push(t)
        }
        const results: TokenAmount[] = []
        for (const [cidStr, chainTokens] of Object.entries(byChain)) {
          const cid = Number(cidStr)
          let rpcUrl: string
          try {
            const urls = await client.getRpcUrlsByChainId(cid)
            rpcUrl = urls[0]
          } catch {
            results.push(...chainTokens.map(t => ({ ...t, amount: 0n })))
            continue
          }
          const pub = createPublicClient({ transport: http(rpcUrl) })
          for (const token of chainTokens) {
            try {
              const amount = token.address.toLowerCase() === ZERO_ADDR
                ? await pub.getBalance({ address: walletAddress as `0x${string}` })
                : await pub.readContract({
                    address:      token.address as `0x${string}`,
                    abi:          erc20Abi,
                    functionName: 'balanceOf',
                    args:         [walletAddress as `0x${string}`],
                  }) as bigint
              results.push({ ...token, amount })
            } catch {
              results.push({ ...token, amount: 0n })
            }
          }
        }
        return results
      },

      async getStepExecutor(options: StepExecutorOptions) {
        const executor = new EVMStepExecutor(options)
        executor.setRefs(
          wcRef.current,
          async (cid) => { await switchRef.current({ chainId: cid }) },
        )
        return executor as any
      },
    } as any : undefined,

    installedWallets: [],
    async connect()    { if (!isConnected && openConnectModal) openConnectModal() },
    async disconnect() { disconnect() },

    async getBytecode(_chainId: number, addr: string) {
      if (!publicClient) return undefined
      try { return await publicClient.getBytecode({ address: addr as `0x${string}` }) as string | undefined }
      catch { return undefined }
    },
    async getTransactionCount(_chainId: number, addr: string) {
      if (!publicClient) return undefined
      try { return await publicClient.getTransactionCount({ address: addr as `0x${string}` }) }
      catch { return undefined }
    },
  }), [
    address, chainId, isConnected, isConnecting, isReconnecting, status,
    connector, publicClient, disconnect, openConnectModal,
  ])

  return (
    <EthereumContext value={contextValue}>
      {children}
    </EthereumContext>
  )
}
