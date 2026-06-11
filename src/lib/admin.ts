/**
 * admin.ts — admin-only Supabase queries.
 * Uses supabaseAdmin (service role key) — bypasses RLS.
 * Called only from the password-protected AdminDashboard.
 */
import { supabaseAdmin } from './supabase'
import type { DbUser, DbDeploy, DbPayment, TierPrices } from './supabase'

// ── Users ─────────────────────────────────────────────────────────────────────
export async function adminGetAllUsers(): Promise<DbUser[]> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function adminGetUser(wallet: string): Promise<DbUser | null> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('wallet', wallet.toLowerCase())
    .single()
  return data
}

export async function adminUpdateUserTier(wallet: string, tier: DbUser['tier'], deploysLimit: number) {
  const { error } = await supabaseAdmin
    .from('users')
    .update({ tier, deploys_limit: deploysLimit })
    .eq('wallet', wallet.toLowerCase())
  if (error) throw error
}

// ── Deploys ───────────────────────────────────────────────────────────────────
export async function adminGetAllDeploys(): Promise<DbDeploy[]> {
  const { data, error } = await supabaseAdmin
    .from('deploys')
    .select('*')
    .order('deployed_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function adminGetDeploysByWallet(wallet: string): Promise<DbDeploy[]> {
  const { data, error } = await supabaseAdmin
    .from('deploys')
    .select('*')
    .eq('wallet', wallet.toLowerCase())
    .order('deployed_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ── Payments ──────────────────────────────────────────────────────────────────
export async function adminGetAllPayments(): Promise<DbPayment[]> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function adminGetPaymentsByWallet(wallet: string): Promise<DbPayment[]> {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('wallet', wallet.toLowerCase())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ── App config ────────────────────────────────────────────────────────────────
export async function adminGetAllConfig(): Promise<Record<string, any>> {
  const { data, error } = await supabaseAdmin
    .from('app_config')
    .select('*')
  if (error) throw error
  const map: Record<string, any> = {}
  for (const row of data ?? []) map[row.key] = row.value
  return map
}

export async function adminSetConfig(key: string, value: any) {
  const { error } = await supabaseAdmin
    .from('app_config')
    .upsert({ key, value }, { onConflict: 'key' })
  if (error) throw error
}

export async function adminSetMaintenanceMode(enabled: boolean, message?: string) {
  await adminSetConfig('maintenance_mode', enabled)
  if (message !== undefined) await adminSetConfig('maintenance_message', message)
}

export async function adminSetTierPrices(prices: TierPrices) {
  await adminSetConfig('tier_prices', prices)
}

// ── Analytics aggregates ──────────────────────────────────────────────────────
export async function adminGetStats() {
  const [users, deploys, payments] = await Promise.all([
    adminGetAllUsers(),
    adminGetAllDeploys(),
    adminGetAllPayments(),
  ])

  const totalRevenue = payments.reduce((sum, p) => sum + (p.amount_usd ?? 0), 0)
  const paidUsers    = users.filter(u => u.tier !== 'free').length
  const activeUsers  = users.filter(u => u.deploys_used > 0).length

  const tierCounts: Record<string, number> = { free: 0, starter: 0, pro: 0, elite: 0 }
  users.forEach(u => { tierCounts[u.tier] = (tierCounts[u.tier] ?? 0) + 1 })

  const chainCounts: Record<number, number> = {}
  deploys.forEach(d => { chainCounts[d.chain_id] = (chainCounts[d.chain_id] ?? 0) + 1 })

  return { users, deploys, payments, totalRevenue, paidUsers, activeUsers, tierCounts, chainCounts }
}
