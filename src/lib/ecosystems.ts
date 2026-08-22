/**
 * ecosystems.ts — tells EVM, Solana and Sui addresses apart, and gives the
 * non-EVM chains an id the rest of the app can carry around.
 *
 * The scanner's plumbing (ScanReport, ChainIcon, CHAIN_NAME, share card) is all
 * keyed by a numeric chain id. Rather than thread an `ecosystem` field through
 * every one of those, Solana and Sui get synthetic ids from their SLIP-44 coin
 * types — 501 and 784 — neither of which collides with any EVM chain we support.
 */

export type Ecosystem = 'evm' | 'solana' | 'sui'

export const SOLANA_CHAIN_ID = 501
export const SUI_CHAIN_ID    = 784

export const NON_EVM_IDS = [SOLANA_CHAIN_ID, SUI_CHAIN_ID]

export function ecosystemOf(chainId: number): Ecosystem {
  if (chainId === SOLANA_CHAIN_ID) return 'solana'
  if (chainId === SUI_CHAIN_ID)    return 'sui'
  return 'evm'
}

// ── Address shapes ────────────────────────────────────────────────────────────
/** EVM: 0x + 40 hex. */
const EVM_RE    = /^0x[0-9a-fA-F]{40}$/
/** Sui object/package: 0x + up to 64 hex, optionally ::module::TYPE for a coin. */
const SUI_RE    = /^0x[0-9a-fA-F]{1,64}(::[A-Za-z_][\w]*){0,2}$/
/** Solana: base58, 32–44 chars. Excludes 0, O, I and l by construction. */
const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/**
 * Work out which ecosystem an input belongs to.
 *
 * Order matters: an EVM address is also a valid short Sui hex string, so EVM is
 * tested first. A Sui coin type carries `::module::TYPE`, and a bare 64-hex
 * value is far longer than any EVM address, so the two never genuinely collide.
 */
export function detectEcosystem(input: string): Ecosystem | null {
  const s = input.trim()
  if (!s) return null
  if (EVM_RE.test(s)) return 'evm'
  if (s.includes('::') || (s.startsWith('0x') && s.length > 42)) {
    return SUI_RE.test(s) ? 'sui' : null
  }
  if (!s.startsWith('0x') && SOLANA_RE.test(s)) return 'solana'
  return null
}

/** Human-readable hint shown when an address matches nothing. */
export const ADDRESS_HINT =
  'Paste an EVM address (0x…40 hex), a Solana mint (base58), or a Sui coin type (0x…::module::TYPE).'

/**
 * Solana RPCs, in preference order.
 * api.mainnet-beta.solana.com returns 403 to browsers and Ankr requires a key,
 * so publicnode leads.
 */
export const SOLANA_RPC_LIST = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
]

/** DexScreener slugs for the non-EVM chains. */
export const NON_EVM_DEX_SLUG: Record<number, string> = {
  [SOLANA_CHAIN_ID]: 'solana',
  [SUI_CHAIN_ID]:    'sui',
}

export const NON_EVM_EXPLORER: Record<number, string> = {
  [SOLANA_CHAIN_ID]: 'https://solscan.io',
  [SUI_CHAIN_ID]:    'https://suivision.xyz',
}

/** Explorer URL for a token on a non-EVM chain. */
export function nonEvmTokenUrl(chainId: number, address: string): string {
  if (chainId === SOLANA_CHAIN_ID) return `https://solscan.io/token/${address}`
  if (chainId === SUI_CHAIN_ID)    return `https://suivision.xyz/coin/${encodeURIComponent(address)}`
  return ''
}
