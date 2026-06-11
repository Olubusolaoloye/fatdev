/**
 * db.ts — thin wrappers around Supabase for user-facing writes.
 * All functions fail silently when Supabase is not configured (env vars missing),
 * so the app keeps working as a local-only tool.
 */
import { supabase, supabaseReady } from './supabase'
import type { DeployRecord, UserData } from './store'

// ── Upsert / sync a user row ───────────────────────────────────────────────────
export async function syncUser(wallet: string, data: UserData) {
  if (!supabaseReady) return
  await supabase.from('users').upsert({
    wallet:          wallet.toLowerCase(),
    tier:            data.tier,
    deploys_used:    data.deploysUsed,
    deploys_limit:   data.deploysLimit,
    payment_tx_hash: data.paymentTxHash,
    payment_token:   data.paymentToken,
  }, { onConflict: 'wallet' })
}

// ── Insert a deploy record ────────────────────────────────────────────────────
export async function insertDeploy(wallet: string, d: DeployRecord) {
  if (!supabaseReady) return
  // Ensure the user row exists first
  await supabase.from('users').upsert(
    { wallet: wallet.toLowerCase(), tier: 'free', deploys_used: 0, deploys_limit: 0, payment_tx_hash: null, payment_token: null },
    { onConflict: 'wallet', ignoreDuplicates: true }
  )
  await supabase.from('deploys').upsert({
    id:               d.id,
    wallet:           wallet.toLowerCase(),
    token_name:       d.tokenName,
    token_symbol:     d.tokenSymbol,
    decimals:         d.decimals ?? null,
    contract_address: d.contractAddress,
    tx_hash:          d.txHash,
    chain_id:         d.chainId,
    chain_name:       d.chainName,
    deployed_at:      d.deployedAt,
    config_snapshot:  safeParseSnapshot(d.configSnapshot),
    verified:         d.verified ?? false,
  }, { onConflict: 'id' })
}

// ── Patch a deploy (e.g. verified flag) ──────────────────────────────────────
export async function patchDeployDb(deployId: string, patch: { verified?: boolean; contract_address?: string }) {
  if (!supabaseReady) return
  await supabase.from('deploys').update(patch).eq('id', deployId)
}

// ── Record a payment ──────────────────────────────────────────────────────────
export async function insertPayment(wallet: string, tier: string, txHash: string, paymentToken: string, amountUsd: number, chainId: number) {
  if (!supabaseReady) return
  await supabase.from('payments').insert({
    wallet:        wallet.toLowerCase(),
    tier,
    tx_hash:       txHash,
    payment_token: paymentToken,
    amount_usd:    amountUsd,
    chain_id:      chainId,
  })
}

// ── Read app config (maintenance + prices) ────────────────────────────────────
export async function getAppConfig<T = any>(key: string, fallback: T): Promise<T> {
  if (!supabaseReady) return fallback
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', key)
    .single()
  if (error || !data) return fallback
  return data.value as T
}

function safeParseSnapshot(s: string): any {
  try { return JSON.parse(s) } catch { return null }
}
