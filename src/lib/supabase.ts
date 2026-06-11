import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = import.meta.env.VITE_SUPABASE_URL         ?? ''
const SUPABASE_ANON_KEY    = import.meta.env.VITE_SUPABASE_ANON_KEY    ?? ''
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY ?? ''

/** Regular client — uses anon key, subject to RLS. Used by all user-facing flows. */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Admin client — uses service role key, bypasses RLS.
 * Used ONLY inside the password-protected AdminDashboard.
 * ⚠️  Never expose this key to end-users.
 *     In production, move admin operations to a Supabase Edge Function.
 */
export const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : supabase   // fallback to anon in dev if service key not set

/** Is Supabase configured? (env vars present) */
export const supabaseReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

// ── Database types ────────────────────────────────────────────────────────────

export type DbUser = {
  wallet:          string
  tier:            'free' | 'starter' | 'pro' | 'elite'
  deploys_used:    number
  deploys_limit:   number
  payment_tx_hash: string | null
  payment_token:   string | null
  created_at:      string
  updated_at:      string
}

export type DbDeploy = {
  id:               string
  wallet:           string
  token_name:       string | null
  token_symbol:     string | null
  decimals:         number | null
  contract_address: string | null
  tx_hash:          string | null
  chain_id:         number
  chain_name:       string | null
  deployed_at:      string
  config_snapshot:  any
  verified:         boolean
  created_at:       string
}

export type DbPayment = {
  id:            string
  wallet:        string
  tier:          string
  tx_hash:       string | null
  payment_token: string | null
  amount_usd:    number | null
  chain_id:      number | null
  created_at:    string
}

export type TierPrice = {
  usd:    number
  blin:   number
  native: number
  label:  string
}

export type TierPrices = Record<'starter' | 'pro' | 'elite', TierPrice>

export type AppConfigRow = {
  key:        string
  value:      any
  updated_at: string
}
