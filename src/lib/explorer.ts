const API_KEY = 'BHPP1DMU8YABI4Y9MV7PUGATK49IKR8D3F'
const BASE    = 'https://api.etherscan.io/v2/api'

async function call(chainId: number, params: Record<string, string>) {
  const url = new URL(BASE)
  url.searchParams.set('chainid', String(chainId))
  url.searchParams.set('apikey', API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res  = await fetch(url.toString())
  const json = await res.json()
  if (json.status !== '1') {
    // "No transactions found" is a non-error empty result
    if (json.message?.includes('No transactions') || json.message?.includes('No records')) return []
    throw new Error(json.result || json.message || 'Explorer API error')
  }
  return json.result
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type TokenHolder = {
  TokenHolderAddress: string
  TokenHolderQuantity: string
}

export type TokenTransfer = {
  blockNumber: string
  timeStamp:   string
  hash:        string
  from:        string
  to:          string
  value:       string
  tokenName:   string
  tokenSymbol: string
  tokenDecimal:string
  gasUsed:     string
  gasPrice:    string
  confirmations: string
}

export type TxRecord = {
  hash: string
  timeStamp: string
  from: string
  to: string
  value: string
  isError: string
}

// ── API calls ─────────────────────────────────────────────────────────────────

export function getTokenHolders(contract: string, chainId: number, page = 1): Promise<TokenHolder[]> {
  return call(chainId, {
    module: 'token', action: 'tokenholderlist',
    contractaddress: contract,
    page: String(page), offset: '50',
  })
}

export function getTokenTransfers(contract: string, chainId: number, page = 1): Promise<TokenTransfer[]> {
  return call(chainId, {
    module: 'account', action: 'tokentx',
    contractaddress: contract,
    page: String(page), offset: '100', sort: 'desc',
  })
}

export function getAccountFirstTx(address: string, chainId: number): Promise<TxRecord[]> {
  return call(chainId, {
    module: 'account', action: 'txlist',
    address, page: '1', offset: '1', sort: 'asc',
  })
}

export function getContractABI(address: string, chainId: number): Promise<string> {
  return call(chainId, { module: 'contract', action: 'getabi', address })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatTokenAmount(raw: string, decimals: number, maxDecimals = 4): string {
  const n = Number(BigInt(raw)) / 10 ** decimals
  return n.toLocaleString('en-US', { maximumFractionDigits: maxDecimals })
}

export function pct(holderQty: string, totalSupply: string): string {
  if (!totalSupply || totalSupply === '0') return '—'
  const p = (Number(BigInt(holderQty)) / Number(BigInt(totalSupply))) * 100
  return p.toFixed(2) + '%'
}

export function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export function relTime(ts: string) {
  const diff = Date.now() - Number(ts) * 1000
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 365) return `${d}d ago`
  return `${Math.floor(d / 365)}y ago`
}
