export type SnapshotHolder = {
  address: string
  v1Balance: string
  v2Allocation: string
}

/**
 * Calculate how many V2 tokens are needed in the vault given a participation rate.
 * @param totalV1Supply  total V1 supply (in token units, not wei)
 * @param ratio          V2 tokens per V1 token (e.g. 1 means 1:1)
 * @param participationPct  expected % of holders who will migrate (1-99)
 */
export function calcVaultNeeded(
  totalV1Supply: number,
  ratio: number,
  participationPct: number,
): number {
  return Math.ceil(totalV1Supply * ratio * (participationPct / 100))
}

/**
 * Format a migration id for display: first 6 chars + … + last 4 chars
 */
export function formatMigrationId(id: string): string {
  if (id.length <= 12) return id
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

/**
 * Split an airdrop list into batches of `batchSize` and return them.
 * The actual on-chain call is handled by the caller.
 */
export function batchAirdrop(
  holders: SnapshotHolder[],
  batchSize = 200,
): SnapshotHolder[][] {
  const batches: SnapshotHolder[][] = []
  for (let i = 0; i < holders.length; i += batchSize) {
    batches.push(holders.slice(i, i + batchSize))
  }
  return batches
}
