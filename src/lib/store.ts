import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { syncUser, insertDeploy, patchDeployDb, insertPayment } from './db'

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

export type TokenConfig = {
  name: string; symbol: string; decimals: number; totalSupply: string
  fundAddress: string; receiveAddress: string; rewardToken: string
  buyFund: number; buyLP: number; buyReward: number; buyBurn: number
  sellFund: number; sellLP: number; sellReward: number; sellBurn: number
  maxBuyAmount: string; maxWalletAmount: string
  enableChangeTax: boolean; enableKillBlock: boolean; enableSwapLimit: boolean
  enableWalletLimit: boolean; enableRewardList: boolean; enableOffTrade: boolean
  enableKillBatchBots: boolean; enableTransferFee: boolean; antiSYNC: boolean
  currencyIsEth: boolean; kb: number; killBatchBlockNumber: number; airdropNumbs: number
}

export const DEFAULT_CFG: TokenConfig = {
  name: '', symbol: '', decimals: 18, totalSupply: '1000000000',
  fundAddress: '', receiveAddress: '', rewardToken: '',
  buyFund: 200, buyLP: 100, buyReward: 100, buyBurn: 0,
  sellFund: 200, sellLP: 100, sellReward: 100, sellBurn: 0,
  maxBuyAmount: '10000000', maxWalletAmount: '20000000',
  enableChangeTax: true, enableKillBlock: true, enableSwapLimit: true,
  enableWalletLimit: true, enableRewardList: true, enableOffTrade: true,
  enableKillBatchBots: true, enableTransferFee: false, antiSYNC: true,
  currencyIsEth: true, kb: 3, killBatchBlockNumber: 3, airdropNumbs: 1,
}

const TIER_LIMITS: Record<string, number> = { free: 0, starter: 1, pro: 3, elite: 999 }

type AppStore = {
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
