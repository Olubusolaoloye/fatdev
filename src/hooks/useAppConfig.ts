import { useEffect, useState } from 'react'
import { getAppConfig } from '../lib/db'
import { DEFAULT_FEATURE_FLAGS, normalizeFlags, type FeatureFlags, type FeatureKey } from '../lib/tools'


type AppConfig = {
  maintenanceMode:    boolean
  maintenanceMessage: string
  features:           FeatureFlags
  loading:            boolean
}

let cachedConfig: AppConfig | null = null
let fetchPromise: Promise<void> | null = null

/**
 * Reads maintenance_mode, maintenance_message and feature_flags from Supabase.
 * Results are cached for the page lifetime — only fetched once.
 */
export function useAppConfig(): AppConfig {
  const [config, setConfig] = useState<AppConfig>(
    cachedConfig ?? {
      maintenanceMode:    false,
      maintenanceMessage: 'Scheduled maintenance in progress.',
      features:           DEFAULT_FEATURE_FLAGS,
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
      const [maintenance, message, features] = await Promise.all([
        getAppConfig<boolean>('maintenance_mode',    false),
        getAppConfig<string> ('maintenance_message', 'Scheduled maintenance in progress.'),
        getAppConfig<Partial<FeatureFlags>>('feature_flags', DEFAULT_FEATURE_FLAGS),
      ])
      cachedConfig = {
        maintenanceMode:    maintenance,
        maintenanceMessage: message,
        features:           normalizeFlags(features),
        loading:            false,
      }
      setConfig(cachedConfig)
    })()
  }, [])

  return config
}

/**
 * Convenience hook — is a single feature enabled?
 * Returns `enabled` plus `loading` so callers can avoid flashing a disabled
 * page before the real flags arrive from Supabase.
 */
export function useFeature(key: FeatureKey): { enabled: boolean; loading: boolean } {
  const { features, loading } = useAppConfig()
  return { enabled: features[key], loading }
}

/** Invalidate the cache (call after admin saves config) */
export function invalidateAppConfig() {
  cachedConfig   = null
  fetchPromise   = null
}
