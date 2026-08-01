import type { WalletClient, PublicClient } from 'viem'
import { encodeAbiParameters, parseAbiParameters, maxUint256 } from 'viem'
import { MIGRATION_VAULT_BYTECODE, MIGRATION_VAULT_ABI } from './abis'

// ── ERC-20 approve ABI (minimal) ─────────────────────────────────────────────
const ERC20_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function' as const,
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable' as const,
  },
  {
    name: 'allowance',
    type: 'function' as const,
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view' as const,
  },
] as const

// ── ERC-20 metadata ABI (minimal) ────────────────────────────────────────────
const ERC20_META_ABI = [
  { name: 'symbol',   type: 'function' as const, inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' as const },
  { name: 'decimals', type: 'function' as const, inputs: [], outputs: [{ name: '', type: 'uint8' }],  stateMutability: 'view' as const },
  { name: 'balanceOf', type: 'function' as const, inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' as const },
] as const

export type TokenMeta = { symbol: string; decimals: number }

export async function readTokenMeta(
  token: string, publicClient: PublicClient
): Promise<TokenMeta> {
  const addr = token as `0x${string}`
  const [symbol, decimals] = await Promise.all([
    publicClient.readContract({ address: addr, abi: ERC20_META_ABI, functionName: 'symbol' }),
    publicClient.readContract({ address: addr, abi: ERC20_META_ABI, functionName: 'decimals' }),
  ])
  return { symbol: symbol as string, decimals: Number(decimals) }
}

export async function readTokenBalance(
  token: string, holder: string, publicClient: PublicClient
): Promise<bigint> {
  return await publicClient.readContract({
    address: token as `0x${string}`,
    abi: ERC20_META_ABI,
    functionName: 'balanceOf',
    args: [holder as `0x${string}`],
  }) as bigint
}

// ── Live vault stats from chain ──────────────────────────────────────────────
export type LiveVaultStats = {
  vaultBalance: bigint       // V2 remaining in vault
  totalDeposited: bigint     // V2 ever deposited
  totalDisbursed: bigint     // V2 ever paid out
  participantCount: bigint
  windowEnd: bigint          // unix seconds
  isWindowOpen: boolean
  paused: boolean
  stopped: boolean
}

export async function readVaultStats(
  vaultAddress: string, publicClient: PublicClient
): Promise<LiveVaultStats> {
  const vault = vaultAddress as `0x${string}`
  const read = (functionName: string) =>
    publicClient.readContract({ address: vault, abi: MIGRATION_VAULT_ABI, functionName: functionName as any })

  const [vaultBalance, totalDeposited, totalDisbursed, participantCount, windowEnd, isWindowOpen, paused, stopped] =
    await Promise.all([
      read('vaultBalance'), read('totalDeposited'), read('totalDisbursed'),
      read('participantCount'), read('windowEnd'), read('isWindowOpen'),
      read('paused'), read('stopped'),
    ])

  return {
    vaultBalance:     vaultBalance     as bigint,
    totalDeposited:   totalDeposited   as bigint,
    totalDisbursed:   totalDisbursed   as bigint,
    participantCount: participantCount as bigint,
    windowEnd:        windowEnd        as bigint,
    isWindowOpen:     isWindowOpen     as boolean,
    paused:           paused           as boolean,
    stopped:          stopped          as boolean,
  }
}

// ── Deploy a new MigrationVault ──────────────────────────────────────────────

export async function deployVault(
  params: {
    v1Token: string
    v2Token: string
    ratioNumerator: bigint    // V2 units per V1 unit (numerator)
    ratioDenominator: bigint  // denominator (usually 1n for 1:1)
    windowSeconds: bigint
    supplyCap: bigint         // 0n = unlimited
  },
  walletClient: WalletClient,
  publicClient: PublicClient,
  onStatus: (s: string) => void
): Promise<{ contractAddress: string; txHash: string }> {
  const [account] = await walletClient.getAddresses()

  onStatus('Encoding constructor args…')
  const encodedArgs = encodeAbiParameters(
    parseAbiParameters('address, address, uint256, uint256, uint256, uint256'),
    [
      params.v1Token as `0x${string}`,
      params.v2Token as `0x${string}`,
      params.ratioNumerator,
      params.ratioDenominator,
      params.windowSeconds,
      params.supplyCap,
    ]
  )

  const deployData = (MIGRATION_VAULT_BYTECODE + encodedArgs.slice(2)) as `0x${string}`

  onStatus('Estimating gas…')
  const gasEstimate = await publicClient.estimateGas({ account, data: deployData })

  onStatus(`Gas: ~${gasEstimate.toLocaleString()} units. Confirm in wallet…`)
  const hash = await walletClient.sendTransaction({
    account,
    data: deployData,
    gas: (gasEstimate * 120n) / 100n,
    chain: null,
  })

  onStatus('Waiting for confirmation…')
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  const contractAddress = receipt.contractAddress ?? '0x???'

  return { contractAddress, txHash: hash }
}

// ── Approve + deposit V2 tokens into a vault ─────────────────────────────────

export async function depositV2(
  params: { vaultAddress: string; tokenAddress: string; amount: bigint },
  walletClient: WalletClient,
  publicClient: PublicClient,
  onStatus: (s: string) => void
): Promise<string> {
  const [account] = await walletClient.getAddresses()
  const vault   = params.vaultAddress as `0x${string}`
  const token   = params.tokenAddress as `0x${string}`

  // Check existing allowance
  const allowance = await publicClient.readContract({
    address: token,
    abi: ERC20_APPROVE_ABI,
    functionName: 'allowance',
    args: [account, vault],
  })

  if (allowance < params.amount) {
    onStatus('Approving V2 token spend… confirm in wallet')
    const approveHash = await walletClient.writeContract({
      address: token,
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [vault, maxUint256],
      account,
      chain: null,
    })
    await publicClient.waitForTransactionReceipt({ hash: approveHash })
    onStatus('Approved. Depositing V2 tokens… confirm in wallet')
  } else {
    onStatus('Depositing V2 tokens… confirm in wallet')
  }

  const hash = await walletClient.writeContract({
    address: vault,
    abi: MIGRATION_VAULT_ABI,
    functionName: 'deposit',
    args: [params.amount],
    account,
    chain: null,
  })

  onStatus('Waiting for deposit confirmation…')
  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}

// ── Holder: approve + swap V1 for V2 ─────────────────────────────────────────

export async function swapV1(
  params: { vaultAddress: string; v1TokenAddress: string; v1Amount: bigint },
  walletClient: WalletClient,
  publicClient: PublicClient,
  onStatus: (s: string) => void
): Promise<string> {
  const [account] = await walletClient.getAddresses()
  const vault = params.vaultAddress  as `0x${string}`
  const v1    = params.v1TokenAddress as `0x${string}`

  // Approve if needed
  const allowance = await publicClient.readContract({
    address: v1,
    abi: ERC20_APPROVE_ABI,
    functionName: 'allowance',
    args: [account, vault],
  })

  if (allowance < params.v1Amount) {
    onStatus('Approving V1 token spend… confirm in wallet')
    const approveHash = await walletClient.writeContract({
      address: v1,
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [vault, maxUint256],
      account,
      chain: null,
    })
    await publicClient.waitForTransactionReceipt({ hash: approveHash })
    onStatus('Approved. Swapping V1 → V2… confirm in wallet')
  } else {
    onStatus('Swapping V1 → V2… confirm in wallet')
  }

  const hash = await walletClient.writeContract({
    address: vault,
    abi: MIGRATION_VAULT_ABI,
    functionName: 'swap',
    args: [params.v1Amount],
    account,
    chain: null,
  })

  onStatus('Waiting for swap confirmation…')
  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}

// ── Owner controls ────────────────────────────────────────────────────────────

export async function pauseVault(
  vaultAddress: string, walletClient: WalletClient, publicClient: PublicClient
): Promise<string> {
  const [account] = await walletClient.getAddresses()
  const hash = await walletClient.writeContract({
    address: vaultAddress as `0x${string}`,
    abi: MIGRATION_VAULT_ABI,
    functionName: 'pause',
    account,
    chain: null,
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}

export async function unpauseVault(
  vaultAddress: string, walletClient: WalletClient, publicClient: PublicClient
): Promise<string> {
  const [account] = await walletClient.getAddresses()
  const hash = await walletClient.writeContract({
    address: vaultAddress as `0x${string}`,
    abi: MIGRATION_VAULT_ABI,
    functionName: 'unpause',
    account,
    chain: null,
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}

export async function emergencyStopVault(
  vaultAddress: string, walletClient: WalletClient, publicClient: PublicClient
): Promise<string> {
  const [account] = await walletClient.getAddresses()
  const hash = await walletClient.writeContract({
    address: vaultAddress as `0x${string}`,
    abi: MIGRATION_VAULT_ABI,
    functionName: 'emergencyStop',
    account,
    chain: null,
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}

export async function extendWindowVault(
  vaultAddress: string, extraDays: number,
  walletClient: WalletClient, publicClient: PublicClient
): Promise<string> {
  const [account] = await walletClient.getAddresses()
  const hash = await walletClient.writeContract({
    address: vaultAddress as `0x${string}`,
    abi: MIGRATION_VAULT_ABI,
    functionName: 'extendWindow',
    args: [BigInt(extraDays * 86400)],
    account,
    chain: null,
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}

export async function disburseVault(
  params: { vaultAddress: string; to: string; amount: bigint },
  walletClient: WalletClient, publicClient: PublicClient
): Promise<string> {
  const [account] = await walletClient.getAddresses()
  const hash = await walletClient.writeContract({
    address: params.vaultAddress as `0x${string}`,
    abi: MIGRATION_VAULT_ABI,
    functionName: 'disburse',
    args: [params.to as `0x${string}`, params.amount],
    account,
    chain: null,
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}
