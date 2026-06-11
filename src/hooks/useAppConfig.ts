import { useEffect, useState } from 'react'
import { getAppConfig } from '../lib/db'
import type { TierPrices } from '../lib/supabase'

// ── Defaults (used when Supabase is not configured) ───────────────────────────
export const DEFAULT_PRICES: TierPrices = {
  starter: { usd: 49,  blin: 50000,  native: 0.05, label: '$49'  },
  pro:     { usd: 149, blin: 150000, native: 0.15, label: '$149' },
  elite:   { usd: 399, blin: 400000, native: 0.40, label: '$399' },
}

type AppConfig = {
  maintenanceMode:    boolean
  maintenanceMessage: string
  prices:             TierPrices
  loading:            boolean
}

let cachedConfig: AppConfig | null = null
let fetchPromise: Promise<void> | null = null

/**
 * Reads maintenance_mode, maintenance_message, and tier_prices from Supabase.
 * Results are cached for the page lifetime — only fetched once.
 */
export function useAppConfig(): AppConfig {
  const [config, setConfig] = useState<AppConfig>(
    cachedConfig ?? {
      maintenanceMode:    false,
      maintenanceMessage: 'Scheduled maintenance in progress.',
      prices:             DEFAULT_PRICES,
      loading:            true,
    }
  )

  useEffect(() => {
    if (cachedConfig) {
      setConfig(cachedConfig)
      return
    }
    if (fetchPromise) {
      fetchPromise.then(() => { if (cachedConfig) setConfig(cachedConfig) })
      return
    }

    fetchPromise = (async () => {
      const [maintenance, message, prices] = await Promise.all([
        getAppConfig<boolean>('maintenance_mode',    false),
        getAppConfig<string> ('maintenance_message', 'Scheduled maintenance in progress.'),
        getAppConfig<TierPrices>('tier_prices',      DEFAULT_PRICES),
      ])
      cachedConfig = {
        maintenanceMode:    maintenance,
        maintenanceMessage: message,
        prices:             { ...DEFAULT_PRICES, ...prices },
        loading:            false,
      }
      setConfig(cachedConfig)
    })()
  }, [])

  return config
}

/** Invalidate the cache (call after admin saves config) */
export function invalidateAppConfig() {
  cachedConfig   = null
  fetchPromise   = null
}
