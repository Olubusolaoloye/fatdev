/**
 * tools.ts — single source of truth for which tools/sections exist and whether
 * they are visible on the public site.
 *
 * Flags live in Supabase `app_config` under the key `feature_flags`.
 * The AdminDashboard "Features" tab writes them; the public site reads them.
 * Anything toggled off disappears from the site entirely (card, route, and nav).
 */
import type { IconName } from '../components/ui-kit/Icon'

export type FeatureKey =
  | 'scanner'
  | 'social'
  | 'analytics'
  | 'audit'
  | 'airdrop'
  | 'migrate'
  | 'bridge'

export type FeatureFlags = Record<FeatureKey, boolean>

export type FeatureMeta = {
  key: FeatureKey
  icon: IconName
  title: string
  desc: string
  /** 'tool' entries render as cards on /tools; 'section' entries are whole routes */
  kind: 'tool' | 'section'
  badge?: string
  free?: boolean
  /** Shown in admin when the feature is off but not yet built out */
  comingSoon?: boolean
}

/**
 * The registry. Adding a tool here makes it appear on /tools AND in the admin
 * toggle list automatically — no other file needs to change.
 */
export const FEATURE_REGISTRY: FeatureMeta[] = [
  {
    key: 'scanner', kind: 'tool', icon: 'scan', title: 'Security Scanner', free: true,
    desc: 'Full on-chain audit — honeypot, blacklist, tax sim, LP lock, and a live 0–100 trust score.',
    badge: 'Free',
  },
  {
    key: 'social', kind: 'tool', icon: 'megaphone', title: 'Social & Community', free: true,
    desc: 'Announcement templates for Telegram, X, and Discord. Pre-filled with your tokenomics.',
    badge: 'Free',
  },
  {
    key: 'analytics', kind: 'tool', icon: 'chart', title: 'Holder Analytics', free: true,
    desc: 'Top holders, large buys/sells, bot detection by wallet age, LP reward history.',
    badge: 'Free',
  },
  {
    key: 'audit', kind: 'tool', icon: 'shield', title: 'Audit Score',
    desc: 'Auto-score your token config: taxes, security flags, verification, ownership. Downloadable PDF report.',
    badge: 'PDF Report',
  },
  {
    key: 'airdrop', kind: 'tool', icon: 'send', title: 'Airdrop Tool',
    desc: 'Batch-send tokens to hundreds of wallets from a CSV. One approve + one disperse transaction.',
  },
  {
    key: 'migrate', kind: 'section', icon: 'refresh', title: 'Migrate',
    desc: 'Token V1 → V2 migration vaults with holder self-serve swap pages.',
    comingSoon: true,
  },
  {
    key: 'bridge', kind: 'section', icon: 'bridge', title: 'Bridge',
    desc: 'Cross-chain token bridging powered by LI.FI.',
  },
]

/**
 * Shipping defaults — used when Supabase is unreachable or the key is unset.
 * Holder Analytics and Migrate ship disabled.
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  scanner:   true,
  social:    true,
  analytics: false,
  audit:     true,
  airdrop:   true,
  migrate:   false,
  bridge:    true,
}

/** Merge stored flags over defaults so new registry entries default correctly. */
export function normalizeFlags(stored: Partial<FeatureFlags> | null | undefined): FeatureFlags {
  return { ...DEFAULT_FEATURE_FLAGS, ...(stored ?? {}) }
}

export const TOOL_FEATURES    = FEATURE_REGISTRY.filter(f => f.kind === 'tool')
export const SECTION_FEATURES = FEATURE_REGISTRY.filter(f => f.kind === 'section')
