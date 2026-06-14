export const MIGRATION_REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000000' // TODO: deploy registry

export const MIGRATION_REGISTRY_ABI = [
  {
    name: 'registerVault',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'vault', type: 'address' }, { name: 'v1Token', type: 'address' }, { name: 'v2Token', type: 'address' }],
    outputs: [],
  },
  {
    name: 'getVault',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'migrationId', type: 'bytes32' }],
    outputs: [{ name: 'vault', type: 'address' }],
  },
] as const

export const MIGRATION_VAULT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'swap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'v1Amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'disburse',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'recipients', type: 'address[]' }, { name: 'amounts', type: 'uint256[]' }],
    outputs: [],
  },
  {
    name: 'pause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'unpause',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'emergencyStop',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'extendWindow',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'extraSeconds', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'vaultBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'ratio',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'windowEnd',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const
