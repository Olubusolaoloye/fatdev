/**
 * Bridges the app's existing wagmi/RainbowKit wallet into the LI.FI widget.
 *
 * The LI.FI widget reads wallet state from EthereumContext (from @lifi/widget-provider).
 * By wrapping the widget with this component and providing EthereumContext.Provider,
 * the widget uses the already-connected wagmi account instead of showing its own
 * connect prompt.
 *
 * Key: the same @lifi/widget-provider module is resolved by both this file and the
 * widget internals (pnpm hoists it), so they share the same React context instance.
 */
import type { PropsWithChildren } from 'react'
import { useMemo } from 'react'
import { useAccount, useWalletClient, usePublicClient, useDisconnect, useSwitchChain, useChainId } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { ChainType } from '@lifi/widget'
import { EthereumContext } from '@lifi/widget-provider'
import type { EthereumProviderContext } from '@lifi/widget-provider'

export function WagmiLiFiAdapter({ children }: PropsWithChildren) {
  const { address, isConnected, isConnecting, isReconnecting, status, connector } = useAccount()
  const chainId = useChainId()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const { disconnect } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()
  const { openConnectModal } = useConnectModal()

  const contextValue: EthereumProviderContext = useMemo(() => ({
    isEnabled: true,
    isExternalContext: true,
    isConnected,
    account: {
      address,
      chainId,
      chainType: ChainType.EVM,
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
    sdkProvider: walletClient && publicClient ? {
      get signer() { return walletClient as any },
      // The LI.FI SDK needs a provider that can send transactions.
      // We delegate to viem's walletClient for signing and publicClient for reads.
      async sendTransaction(tx: any) {
        return walletClient.sendTransaction(tx as any)
      },
      async getAddress() {
        return address ?? '0x'
      },
      async switchChain(chainId: number) {
        await switchChainAsync({ chainId })
      },
      async request(args: any) {
        return (walletClient as any).request(args)
      },
    } as any : undefined,
    installedWallets: [],
    async connect() {
      if (!isConnected && openConnectModal) openConnectModal()
    },
    async disconnect() {
      disconnect()
    },
    async getBytecode(_chainId: number, addr: string) {
      if (!publicClient) return undefined
      try {
        return await publicClient.getBytecode({ address: addr as `0x${string}` }) as string | undefined
      } catch { return undefined }
    },
    async getTransactionCount(_chainId: number, addr: string) {
      if (!publicClient) return undefined
      try {
        return await publicClient.getTransactionCount({ address: addr as `0x${string}` })
      } catch { return undefined }
    },
  }), [
    address, chainId, isConnected, isConnecting, isReconnecting, status,
    connector, walletClient, publicClient, disconnect, switchChainAsync, openConnectModal,
  ])

  return (
    <EthereumContext value={contextValue}>
      {children}
    </EthereumContext>
  )
}
