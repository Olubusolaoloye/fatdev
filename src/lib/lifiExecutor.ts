/**
 * lifiExecutor.ts — the EVM step executor behind the bridge.
 *
 * Lifted out of the old widget adapter. It still drives the SDK's StatusManager,
 * because that is what populates `step.execution` — which is in turn what
 * `executeRoute`'s updateRouteHook reports to our own progress UI. Nothing here
 * depends on the widget any more.
 */
import { StatusManager } from '@lifi/sdk'
import type {
  SDKClient, StepExecutor, StepExecutorOptions, LiFiStepExtended,
  ExecutionActionType, ExecutionActionStatus,
} from '@lifi/sdk'
import { createPublicClient, http, erc20Abi, type WalletClient } from 'viem'

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

/** How long to wait for funds to land on the destination chain. */
const DEST_POLL_INTERVAL = 5_000
const DEST_POLL_ATTEMPTS = 120   // 10 minutes

export class EVMStepExecutor implements StepExecutor {
  allowUserInteraction = true
  allowExecution = true

  private wc: WalletClient | null | undefined = null
  private switchChain: ((chainId: number) => Promise<void>) | null = null
  private options: StepExecutorOptions

  constructor(options: StepExecutorOptions) { this.options = options }

  setInteraction(s?: { allowInteraction?: boolean; allowUpdates?: boolean; allowExecution?: boolean }) {
    if (s?.allowInteraction !== undefined) this.allowUserInteraction = s.allowInteraction
    if (s?.allowExecution !== undefined) this.allowExecution = s.allowExecution
  }

  setRefs(wc: WalletClient | null | undefined, switchChain: (chainId: number) => Promise<void>) {
    this.wc = wc
    this.switchChain = switchChain
  }

  async executeStep(client: SDKClient, step: LiFiStepExtended): Promise<LiFiStepExtended> {
    const wc = this.wc
    if (!wc?.account) throw new Error('Wallet not connected')

    const sm = new StatusManager(this.options.routeId)
    // StatusManager throwing must never take the transaction down with it — the
    // bridge still works, we just lose a progress tick. The empty catches below
    // are the whole point, so they are exempted rather than filled with noise.
    /* eslint-disable no-empty */
    const smInit = () => { try { sm.initializeExecution(step) } catch {} }
    const smAction = (type: ExecutionActionType, chainId: number, status: ExecutionActionStatus) =>
      { try { sm.initializeAction({ step, type, chainId, status }) } catch {} }
    const smUpdate = (type: ExecutionActionType, status: ExecutionActionStatus, params?: Record<string, unknown>) =>
      { try { sm.updateAction(step, type, status, params as any) } catch {} }
    const smDone = () => { try { sm.updateExecution(step, { status: 'DONE' }) } catch {} }
    const smFail = (message: string) => {
      try { sm.updateExecution(step, { status: 'FAILED', error: { code: 'EXECUTION_ERROR', message } } as any) } catch {}
    }

    /* eslint-enable no-empty */

    smInit()

    const fromChainId = step.action.fromChainId
    const toChainId = step.action.toChainId
    const isBridge = fromChainId !== toChainId
    const mainActionType: ExecutionActionType = isBridge ? 'CROSS_CHAIN' : 'SWAP'

    let rpcUrl: string
    try {
      rpcUrl = (await client.getRpcUrlsByChainId(fromChainId))[0]
    } catch {
      smFail('Could not resolve an RPC for the source chain')
      throw new Error('Could not resolve an RPC for the source chain')
    }
    const pub = createPublicClient({ transport: http(rpcUrl) })
    const apiUrl = client.config?.apiUrl ?? 'https://li.quest/v1'

    // ── 1. Transaction data ──────────────────────────────────────────────────
    const txRes = await fetch(`${apiUrl}/advanced/stepTransaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...step, execution: undefined }),
    })
    if (!txRes.ok) {
      const msg = `LI.FI could not build this transaction (HTTP ${txRes.status})`
      smFail(msg); throw new Error(msg)
    }
    const txStep = await txRes.json()
    const txReq = txStep.transactionRequest
    if (!txReq?.to || !txReq?.data) {
      smFail('No transaction returned for this route')
      throw new Error('No transaction returned for this route')
    }
    step.transactionRequest = txReq

    // ── 2. Source chain ──────────────────────────────────────────────────────
    try {
      await this.switchChain!(fromChainId)
    } catch (e: any) {
      smFail(e.message); throw e
    }

    // ── 3. Allowance ─────────────────────────────────────────────────────────
    const fromToken = step.action.fromToken
    const approvalAddr = step.estimate?.approvalAddress
    if (fromToken.address.toLowerCase() !== ZERO_ADDR && approvalAddr) {
      try {
        const allowance = await pub.readContract({
          address: fromToken.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [wc.account.address, approvalAddr as `0x${string}`],
        }) as bigint

        if (allowance < BigInt(step.action.fromAmount)) {
          smAction('SET_ALLOWANCE', fromChainId, 'ACTION_REQUIRED')
          const h = await wc.writeContract({
            address: fromToken.address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'approve',
            args: [approvalAddr as `0x${string}`, BigInt(step.action.fromAmount)],
            chain: null,
            account: wc.account,
          })
          smUpdate('SET_ALLOWANCE', 'PENDING', { txHash: h })
          await pub.waitForTransactionReceipt({ hash: h })
          smUpdate('SET_ALLOWANCE', 'DONE', { txHash: h })
        }
      } catch (e: any) {
        smUpdate('SET_ALLOWANCE', 'FAILED')
        smFail(e.message); throw e
      }
    }

    // ── 4. Send ──────────────────────────────────────────────────────────────
    smAction(mainActionType, fromChainId, 'ACTION_REQUIRED')
    let txHash: `0x${string}`
    try {
      txHash = await wc.sendTransaction({
        to: txReq.to as `0x${string}`,
        data: txReq.data as `0x${string}`,
        value: txReq.value ? BigInt(txReq.value) : 0n,
        chain: null,
        account: wc.account,
      })
    } catch (e: any) {
      smUpdate(mainActionType, 'FAILED')
      smFail(e.message); throw e
    }
    smUpdate(mainActionType, 'PENDING', { txHash })

    // ── 5. Source confirmation ───────────────────────────────────────────────
    try {
      await pub.waitForTransactionReceipt({ hash: txHash })
    } catch (e: any) {
      smUpdate(mainActionType, 'FAILED', { txHash })
      smFail(e.message); throw e
    }
    smUpdate(mainActionType, 'DONE', { txHash })

    // ── 6. Destination ───────────────────────────────────────────────────────
    if (isBridge) {
      smAction('RECEIVING_CHAIN', toChainId, 'PENDING')
      const statusParams = new URLSearchParams({
        txHash,
        fromChain: String(fromChainId),
        toChain: String(toChainId),
        ...(step.tool ? { bridge: step.tool } : {}),
      })
      let done = false
      for (let i = 0; i < DEST_POLL_ATTEMPTS && !done; i++) {
        await new Promise(r => setTimeout(r, DEST_POLL_INTERVAL))
        const sr = await fetch(`${apiUrl}/status?${statusParams}`).catch(() => null)
        if (!sr?.ok) continue
        const s = await sr.json().catch(() => null)
        if (!s) continue
        if (s.status === 'DONE') {
          done = true
          smUpdate('RECEIVING_CHAIN', 'DONE', { txHash: s.receiving?.txHash })
          if (step.execution) {
            step.execution.toAmount = s.receiving?.amount
            step.execution.toToken = s.receiving?.token
          }
        } else if (s.status === 'FAILED') {
          smUpdate('RECEIVING_CHAIN', 'FAILED')
          smFail('The bridge failed on the destination chain')
          throw new Error('The bridge failed on the destination chain')
        }
      }
      if (!done) {
        smUpdate('RECEIVING_CHAIN', 'FAILED')
        smFail('Timed out waiting for the destination chain. The funds are not lost — check the explorer link.')
        throw new Error('Timed out waiting for the destination chain')
      }
    }

    smDone()
    return step
  }
}
