// Stub contract functions for Migration Protocol
// Replace with real implementations once MigrationVault contract is deployed

export async function deployVault(_params: {
  v1Token: string
  v2Token: string
  ratio: number
  windowSeconds: number
  cap: bigint
  oracleMode: boolean
  postWindowEnabled: boolean
}): Promise<string> {
  console.log('[migrate] deployVault called with', _params)
  throw new Error('MigrationVault contract not yet deployed. Check back soon.')
}

export async function depositV2(_params: {
  vaultAddress: string
  amount: bigint
}): Promise<string> {
  console.log('[migrate] depositV2 called with', _params)
  throw new Error('MigrationVault contract not yet deployed. Check back soon.')
}

export async function swap(_params: {
  vaultAddress: string
  v1Amount: bigint
}): Promise<string> {
  console.log('[migrate] swap called with', _params)
  throw new Error('MigrationVault contract not yet deployed. Check back soon.')
}

export async function disburse(_params: {
  vaultAddress: string
  recipients: string[]
  amounts: bigint[]
}): Promise<string> {
  console.log('[migrate] disburse called with', _params)
  throw new Error('MigrationVault contract not yet deployed. Check back soon.')
}
