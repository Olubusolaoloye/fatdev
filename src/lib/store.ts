import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { syncUser, insertDeploy, patchDeployDb, insertPayment } from './db'

// ── Migrate types ─────────────────────────────────────────────────────────────
export type MigrationConfig = {
  id: string
  title: string
  description: string
  v1Token: string
  v2Token: string
  ratio: number
  windowSeconds: number
  cap: string
  oracleMode: boolean
  postWindowEnabled: boolean
  vaultAddress: string | null
  status: 'draft' | 'active' | 'paused' | 'completed' | 'stopped'
  createdAt: string
  owner: string
}

export type VaultStats = {
  migrationId: string
  totalDeposited: string
  totalSwapped: string
  participantCount: number
  vaultBalance: string
  windowEnd: number | null
}

export type OracleEvent = {
  id: string
  migrationId: string
  type: 'swap' | 'disburse' | 'deposit' | 'error'
  txHash: string | null
  address: string
  amount: string
  timestamp: number
  status: 'ok' | 'failed' | 'pending'
}

export type SnapshotHolder = {
  address: string
  v1Balance: string
  v2Allocation: string
}

export type DeployRecord = {
  id: string
  tokenName: string
  tokenSymbol: string
  decimals?: number
  contractAddress: string | null
  txHash: string | null
  chainId: number
  chainName: string
  deployedAt: string
  configSnapshot: string
  verified?: boolean
}

export type UserData = {
  tier: 'free' | 'starter' | 'pro' | 'elite'
  deploysUsed: number
  deploysLimit: number
  paymentTxHash: string | null
  paymentToken: string | null
  deploys: DeployRecord[]
}

export type TokenType = 'standard' | 'tax' | 'deflationary' | 'reflection'

export type TokenConfig = {
  // identity
  name: string; symbol: string; decimals: number; totalSupply: string
  tokenType: TokenType
  description: string; website: string; logoUrl: string
  // addresses
  fundAddress: string      // marketing wallet — receives ETH from tax auto-swap
  receiveAddress: string   // gets 100% of supply at deploy
  teamWallet: string       // team ETH receiver (optional)
  buybackWallet: string    // buyback ETH receiver (optional)
  rewardToken: string      // reflection type: reward token address
  // tax behavior — which transfer types are taxed
  taxOnTransfer: boolean
  taxOnBuy: boolean
  taxOnSell: boolean
  // tax rates (bps, 0–2500 each)
  buyTax: number
  sellTax: number
  transferTax: number
  // tax distribution — must sum to 100
  mktPct: number       // % to marketing wallet (ETH)
  lpPct: number        // % to auto-liquidity
  teamPct: number      // % to team wallet (ETH)
  buybackPct: number   // % to buyback wallet (ETH)
  burnPct: number      // % burned as tokens (deflationary) / reflected (reflection)
  // auto-swap settings
  autoSwap: boolean
  swapThreshold: string
  // limits
  maxBuyAmount: string
  maxWalletAmount: string
}

export const TOKEN_TYPE_PRESETS: Record<TokenType, Partial<TokenConfig>> = {
  standard: {
    tokenType: 'standard',
    taxOnTransfer: false, taxOnBuy: false, taxOnSell: false,
    buyTax: 0, sellTax: 0, transferTax: 0,
    mktPct: 0, lpPct: 0, teamPct: 0, buybackPct: 0, burnPct: 0,
  },
  tax: {
    tokenType: 'tax',
    taxOnTransfer: false, taxOnBuy: true, taxOnSell: true,
    buyTax: 500, sellTax: 500, transferTax: 0,
    mktPct: 60, lpPct: 20, teamPct: 10, buybackPct: 0, burnPct: 10,
  },
  deflationary: {
    tokenType: 'deflationary',
    taxOnTransfer: true, taxOnBuy: true, taxOnSell: true,
    buyTax: 300, sellTax: 500, transferTax: 100,
    mktPct: 20, lpPct: 20, teamPct: 0, buybackPct: 0, burnPct: 60,
  },
  reflection: {
    tokenType: 'reflection',
    taxOnTransfer: true, taxOnBuy: true, taxOnSell: true,
    buyTax: 300, sellTax: 500, transferTax: 100,
    mktPct: 20, lpPct: 20, teamPct: 0, buybackPct: 0, burnPct: 60,
  },
}

export const DEFAULT_CFG: TokenConfig = {
  name: '', symbol: '', decimals: 18, totalSupply: '1000000000',
  tokenType: 'tax',
  description: '', website: '', logoUrl: '',
  fundAddress: '', receiveAddress: '',
  teamWallet: '', buybackWallet: '', rewardToken: '',
  taxOnTransfer: false, taxOnBuy: true, taxOnSell: true,
  buyTax: 500, sellTax: 500, transferTax: 0,
  mktPct: 60, lpPct: 20, teamPct: 10, buybackPct: 0, burnPct: 10,
  autoSwap: true, swapThreshold: '500000',
  maxBuyAmount: '10000000', maxWalletAmount: '20000000',
}

const TIER_LIMITS: Record<string, number> = { free: 0, starter: 1, pro: 3, elite: 999 }

type MigrateStore = {
  migrations: MigrationConfig[]
  activeMigrationId: string | null
  vaultStats: Record<string, VaultStats>
  oracleEvents: Record<string, OracleEvent[]>
  snapshotData: Record<string, SnapshotHolder[]>
  addMigration: (m: MigrationConfig) => void
  updateMigration: (id: string, patch: Partial<MigrationConfig>) => void
  setActiveMigration: (id: string | null) => void
  setVaultStats: (id: string, stats: VaultStats) => void
  addOracleEvent: (id: string, event: OracleEvent) => void
  setSnapshotData: (id: string, holders: SnapshotHolder[]) => void
}

type AppStore = MigrateStore & {
  // wizard
  step: number
  setStep: (s: number) => void

  // token config
  cfg: TokenConfig
  setCfg: (patch: Partial<TokenConfig>) => void
  resetCfg: () => void

  // per-wallet user data (key = wallet address)
  userData: Record<string, UserData>
  getUserData: (addr: string) => UserData
  upgradeTier: (addr: string, tier: string, txHash: string, token: string) => void
  addDeploy: (addr: string, d: DeployRecord) => void
  patchDeploy: (addr: string, id: string, patch: Partial<DeployRecord>) => void
  /** Merge server-authoritative fields (tier/limits) without overwriting local deploy history */
  mergeUserData: (addr: string, patch: Partial<UserData>) => void

  // tier selection & payment UI
  selectedTier: 'starter' | 'pro' | 'elite'
  setSelectedTier: (t: 'starter' | 'pro' | 'elite') => void
  payMethod: 'blin' | 'native'
  setPayMethod: (m: 'blin' | 'native') => void
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ── Migrate slice ──────────────────────────────────────────────────────
      migrations: [],
      activeMigrationId: null,
      vaultStats: {},
      oracleEvents: {},
      snapshotData: {},
      addMigration: (m) => set(s => ({ migrations: [m, ...s.migrations] })),
      updateMigration: (id, patch) => set(s => ({
        migrations: s.migrations.map(m => m.id === id ? { ...m, ...patch } : m)
      })),
      setActiveMigration: (id) => set({ activeMigrationId: id }),
      setVaultStats: (id, stats) => set(s => ({ vaultStats: { ...s.vaultStats, [id]: stats } })),
      addOracleEvent: (id, event) => set(s => ({
        oracleEvents: { ...s.oracleEvents, [id]: [event, ...(s.oracleEvents[id] ?? [])] }
      })),
      setSnapshotData: (id, holders) => set(s => ({ snapshotData: { ...s.snapshotData, [id]: holders } })),

      // ── Wizard ────────────────────────────────────────────────────────────
      step: 0,
      setStep: (step) => set({ step }),

      cfg: { ...DEFAULT_CFG },
      setCfg: (patch) => set(s => ({ cfg: { ...s.cfg, ...patch } })),
      resetCfg: () => set({ cfg: { ...DEFAULT_CFG } }),

      userData: {},
      getUserData: (addr) => {
        const key = addr.toLowerCase()
        return get().userData[key] ?? {
          tier: 'free', deploysUsed: 0, deploysLimit: 0,
          paymentTxHash: null, paymentToken: null, deploys: [],
        }
      },
      upgradeTier: (addr, tier, txHash, token) => {
        const key = addr.toLowerCase()
        set(s => {
          const existing = s.userData[key]
          const prevRemaining = (existing?.deploysLimit ?? 0) - (existing?.deploysUsed ?? 0)
          const newCredits = TIER_LIMITS[tier] ?? 0
          const newUsed = 0
          const newLimit = Math.max(0, prevRemaining) + newCredits
          const updated: UserData = {
            ...(existing ?? { deploys: [] }),
            tier: tier as UserData['tier'],
            deploysLimit: newLimit,
            deploysUsed: newUsed,
            paymentTxHash: txHash,
            paymentToken: token,
          }
          // Sync to Supabase (fire-and-forget)
          syncUser(key, updated)
          const TIER_PRICE_USD: Record<string, number> = { starter: 49, pro: 149, elite: 399 }
          insertPayment(key, tier, txHash, token, TIER_PRICE_USD[tier] ?? 0, 0)
          return { userData: { ...s.userData, [key]: updated } }
        })
      },
      addDeploy: (addr, d) => {
        const key = addr.toLowerCase()
        set(s => {
          const u = s.userData[key] ?? { tier: 'free', deploysUsed: 0, deploysLimit: 0, paymentTxHash: null, paymentToken: null, deploys: [] }
          const updated = { ...u, deploysUsed: u.deploysUsed + 1, deploys: [d, ...u.deploys] }
          // Sync to Supabase (fire-and-forget)
          insertDeploy(key, d)
          syncUser(key, updated)
          return { userData: { ...s.userData, [key]: updated } }
        })
      },

      patchDeploy: (addr, id, patch) => {
        const key = addr.toLowerCase()
        set(s => {
          const u = s.userData[key]
          if (!u) return s
          // Sync verified flag to Supabase
          if (patch.verified !== undefined) patchDeployDb(id, { verified: patch.verified })
          return {
            userData: {
              ...s.userData,
              [key]: { ...u, deploys: u.deploys.map(d => d.id === id ? { ...d, ...patch } : d) }
            }
          }
        })
      },

      mergeUserData: (addr, patch) => {
        const key = addr.toLowerCase()
        set(s => {
          const existing = s.userData[key] ?? {
            tier: 'free', deploysUsed: 0, deploysLimit: 0,
            paymentTxHash: null, paymentToken: null, deploys: [],
          }
          return { userData: { ...s.userData, [key]: { ...existing, ...patch } } }
        })
      },

      selectedTier: 'pro',
      setSelectedTier: (selectedTier) => set({ selectedTier }),
      payMethod: 'blin',
      setPayMethod: (payMethod) => set({ payMethod }),
    }),
    { name: 'fatdev-store' }
  )
)
