/**
 * Shared helpers for the token link-preview functions.
 *
 * Social crawlers (X, Telegram, Discord, Slack) do not run JavaScript, so a
 * shared /token/{address} link can only show a real preview if the HTML and
 * the image are produced on the server. The data comes from token_scan_stats —
 * the last result anyone got for that token — so the preview is instant and
 * never runs a scan on a crawler's behalf.
 */

export const SITE_URL = (process.env.VITE_APP_URL || 'https://fatdev.org').replace(/\/$/, '')

const CHAIN_NAME = {
  1: 'Ethereum', 56: 'BNB Chain', 42161: 'Arbitrum One', 8453: 'Base', 137: 'Polygon', 10: 'Optimism',
  43114: 'Avalanche', 59144: 'Linea', 999: 'HyperEVM', 146: 'Sonic', 5000: 'Mantle', 1329: 'Sei',
  100: 'Gnosis', 25: 'Cronos', 4663: 'Robinhood', 143: 'Monad', 369: 'PulseChain', 9745: 'Plasma',
  988: 'Stable', 15551: 'LOOP', 97: 'BSC Testnet', 501: 'Solana', 784: 'Sui',
}
export const chainName = id => CHAIN_NAME[id] ?? `Chain ${id}`

/**
 * Accept only real token address shapes: EVM 0x…, Solana base58 mints and Sui
 * coin types. Everything that reaches HTML or a query goes through this first.
 */
export function cleanAddress(raw) {
  let a = String(raw ?? '').trim()
  try { a = decodeURIComponent(a) } catch { /* keep as-is */ }
  a = a.split(/[?#]/)[0].replace(/\/+$/, '')
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return a.toLowerCase()
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return a
  if (/^0x[0-9a-fA-F]{1,64}::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*$/.test(a)) return a
  return null
}

export const shortAddr = a => (a.length > 16 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)

/** Most-scanned row for this address, or null. Never throws. */
export async function fetchTokenStats(address, chainId) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) return null
  const q = new URLSearchParams({
    select: 'address,chain_id,scan_count,name,symbol,logo_url,last_score,last_verdict,last_scanned_at',
    address: `eq.${address}`,
    order: 'scan_count.desc',
    limit: '1',
  })
  if (chainId) q.set('chain_id', `eq.${chainId}`)
  try {
    const res = await fetch(`${url}/rest/v1/token_scan_stats?${q}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return null
    const rows = await res.json()
    return rows[0] ?? null
  } catch {
    return null
  }
}

/** Same bands as the scanner's share cards (src/lib/mascots.ts). */
export function tierFor(score, verdict) {
  if (score == null) return null
  if (verdict === 'CRITICAL' || verdict === 'HIGH RISK' || score < 52) return 'bad'
  if (score < 65) return 'fair'
  if (score < 90) return 'good'
  return 'perfect'
}

export const TIER = {
  perfect: { label: 'PERFECT', color: '#00E676' },
  good:    { label: 'GOOD',    color: '#00E5B0' },
  fair:    { label: 'FAIR',    color: '#FFB020' },
  bad:     { label: 'BAD',     color: '#FF5252' },
}

export function parseChain(v) {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 && n < 10_000_000 ? n : null
}

export const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
