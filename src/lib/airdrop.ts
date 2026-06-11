import type { WalletClient, PublicClient } from 'viem'

// ── FatAirdrop contract ───────────────────────────────────────────────────────
// Compiled from FatAirdrop.sol — Solidity 0.8.4, optimizer on, 200 runs
// Source: src/contracts/FatAirdrop.sol
export const AIRDROP_BYTECODE = '0x608060405234801561001057600080fd5b50610536806100206000396000f3fe608060405234801561001057600080fd5b506004361061002b5760003560e01c8063025ff12f14610030575b600080fd5b61004361003e366004610401565b610045565b005b82811461008b5760405162461bcd60e51b815260206004820152600f60248201526e0d8cadccee8d040dad2e6dac2e8c6d608b1b60448201526064015b60405180910390fd5b826100c55760405162461bcd60e51b815260206004820152600a602482015269195b5c1d1e481b1a5cdd60b21b6044820152606401610082565b846000805b83811015610116578484828181106100f257634e487b7160e01b600052603260045260246000fd5b905060200201358261010491906104b7565b915061010f816104cf565b90506100ca565b50604051636eb1769f60e11b815233600482015230602482015281906001600160a01b0383169063dd62ed3e9060440160206040518083038186803b15801561015e57600080fd5b505afa158015610172573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610196919061049f565b10156101dd5760405162461bcd60e51b8152602060048201526016602482015275696e73756666696369656e7420616c6c6f77616e636560501b6044820152606401610082565b60005b8581101561032a57826001600160a01b03166323b872dd3389898581811061021857634e487b7160e01b600052603260045260246000fd5b905060200201602081019061022d91906103e0565b88888681811061024d57634e487b7160e01b600052603260045260246000fd5b6040516001600160e01b031960e088901b1681526001600160a01b03958616600482015294909316602485015250602090910201356044820152606401602060405180830381600087803b1580156102a457600080fd5b505af11580156102b8573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906102dc919061047f565b61031a5760405162461bcd60e51b815260206004820152600f60248201526e1d1c985b9cd9995c8819985a5b1959608a1b6044820152606401610082565b610323816104cf565b90506101e0565b50604080518681526020810183905233916001600160a01b038a16917fe94bf5364ee1292cabede8ab439bbac3cc4a725cb08fa81ec1d00a3c87e606e6910160405180910390a350505050505050565b80356001600160a01b038116811461039157600080fd5b919050565b60008083601f8401126103a7578182fd5b50813567ffffffffffffffff8111156103be578182fd5b6020830191508360208260051b85010111156103d957600080fd5b9250929050565b6000602082840312156103f1578081fd5b6103fa8261037a565b9392505050565b600080600080600060608688031215610418578081fd5b6104218661037a565b9450602086013567ffffffffffffffff8082111561043d578283fd5b61044989838a01610396565b90965094506040880135915080821115610461578283fd5b5061046e88828901610396565b969995985093965092949392505050565b600060208284031215610490578081fd5b815180151581146103fa578182fd5b6000602082840312156104b0578081fd5b5051919050565b600082198211156104ca576104ca6104ea565b500190565b60006000198214156104e3576104e36104ea565b5060010190565b634e487b7160e01b600052601160045260246000fdfea2646970667358221220f8386b24ab13bc8d783087eb0b78ea5018c34ade49cceda2b85237570c12d6dc64736f6c63430008040033' as `0x${string}`

export const AIRDROP_ABI = [
  {
    name: 'airdrop',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token',      type: 'address'   },
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts',    type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    name: 'Airdropped',
    type: 'event',
    inputs: [
      { name: 'token',      type: 'address', indexed: true  },
      { name: 'sender',     type: 'address', indexed: true  },
      { name: 'recipients', type: 'uint256', indexed: false },
      { name: 'total',      type: 'uint256', indexed: false },
    ],
  },
] as const

export const ERC20_APPROVE_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

// localStorage key: chainId → deployed FatAirdrop address
const STORAGE_KEY = 'fatdev-airdrop-contracts'

export function getSavedAirdropContract(chainId: number): `0x${string}` | null {
  try {
    const raw  = localStorage.getItem(STORAGE_KEY)
    const map  = raw ? JSON.parse(raw) : {}
    return map[chainId] ?? null
  } catch { return null }
}

export function saveAirdropContract(chainId: number, address: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const map = raw ? JSON.parse(raw) : {}
    map[chainId] = address
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {}
}

// ── Deploy the FatAirdrop contract on the current chain ───────────────────────
export async function deployAirdropContract(
  walletClient: WalletClient,
  publicClient: PublicClient,
  onStatus: (s: string) => void
): Promise<`0x${string}`> {
  onStatus('Deploying FatAirdrop batch contract on this chain (one-time only)…')
  const [account] = await walletClient.getAddresses()
  const gas = await publicClient.estimateGas({ account, data: AIRDROP_BYTECODE })
  const hash = await walletClient.sendTransaction({
    account,
    data: AIRDROP_BYTECODE,
    gas: gas * 120n / 100n,
    chain: walletClient.chain!,
  })
  onStatus('Waiting for deployment confirmation…')
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  const addr = receipt.contractAddress!
  saveAirdropContract(walletClient.chain!.id, addr)
  return addr as `0x${string}`
}

// ── Full batch airdrop: approve → disperse ────────────────────────────────────
export async function executeBatchAirdrop(opts: {
  tokenAddress: `0x${string}`
  airdropContract: `0x${string}`
  recipients: `0x${string}`[]
  amounts: bigint[]
  walletClient: WalletClient
  publicClient: PublicClient
  onStatus: (s: string) => void
}): Promise<{ approveTx: string; airdropTx: string }> {
  const { tokenAddress, airdropContract, recipients, amounts, walletClient, publicClient, onStatus } = opts
  const [account] = await walletClient.getAddresses()
  const total = amounts.reduce((a, b) => a + b, 0n)

  // Step 1 — Approve
  onStatus(`Step 1 of 2 — Approve ${recipients.length} tokens total. Confirm in wallet…`)
  const approveHash = await walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_APPROVE_ABI,
    functionName: 'approve',
    args: [airdropContract, total],
    account,
    chain: walletClient.chain!,
  })
  onStatus('Waiting for approval confirmation…')
  await publicClient.waitForTransactionReceipt({ hash: approveHash })

  // Step 2 — Batch disperse
  onStatus(`Step 2 of 2 — Sending to ${recipients.length} wallets in one transaction. Confirm in wallet…`)
  const airdropHash = await walletClient.writeContract({
    address: airdropContract,
    abi: AIRDROP_ABI,
    functionName: 'airdrop',
    args: [tokenAddress, recipients, amounts],
    account,
    chain: walletClient.chain!,
  })
  onStatus('Waiting for airdrop confirmation…')
  await publicClient.waitForTransactionReceipt({ hash: airdropHash })

  return { approveTx: approveHash, airdropTx: airdropHash }
}
