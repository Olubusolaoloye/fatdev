# FatDeploy — Claude Code Guide

No-code SaaS for configuring and deploying `FatTokenV5` BEP-20/ERC-20 tokens without writing Solidity.
Users connect a wallet, pay for a tier, fill out an 8-step wizard, and deploy directly from the browser.

---

## Commands

```bash
pnpm dev        # dev server → http://localhost:5173
pnpm build      # production build → dist/  (also runs tsc)
pnpm lint       # eslint
```

---

## Tech Stack

| Layer | Package | Version |
|---|---|---|
| Framework | React + Vite | 19 / 8 |
| Wallet connect modal | @rainbow-me/rainbowkit | 2 |
| Web3 hooks | wagmi | 3 |
| Low-level EVM | viem | 2 |
| Async/server state | @tanstack/react-query | 5 |
| App state + persistence | zustand | 5 |
| Styling | Tailwind CSS 3.4 + custom CSS variables | — |
| Component primitives | @radix-ui/* (shadcn/ui scaffolded) | various |
| Type checking | TypeScript 6 strict | — |

---

## Project layout

```
src/
├── main.tsx                      # Provider tree entry point
├── App.tsx                       # Root layout, step nav, step rendering, canNext logic
├── index.css                     # All global CSS + custom CSS variables (--gold, --navy, etc.)
│
├── lib/
│   ├── wagmi.ts                  # Chain config, RPC transports, CHAIN_EXPLORERS, ROUTERS
│   ├── contracts.ts              # All on-chain logic: payWithBLIN, payWithNative, deployFatToken, generateParams
│   ├── store.ts                  # Zustand store (wizard step, TokenConfig, per-wallet UserData)
│   └── utils.ts                  # shadcn cn() helper
│
├── components/
│   ├── ui-kit/index.tsx          # Shared primitives: Pill, Toggle, FeeInput, TaxBar, StatusBox, Spinner, FieldGroup, SumTile, CodeBlock
│   ├── steps/
│   │   ├── Step0Connect.tsx      # RainbowKit ConnectButton
│   │   ├── Step1Plan.tsx         # Tier cards + BLIN/native payment
│   │   ├── Step2Identity.tsx     # name, symbol, decimals, addresses, chain selector
│   │   ├── Step3Taxes.tsx        # Buy/sell tax sliders with live bps bars
│   │   ├── Step4Features.tsx     # Anti-bot toggles (10 flags) + numeric params
│   │   ├── Step5Review.tsx       # Constructor param preview, copy/download
│   │   ├── Step6Deploy.tsx       # One-click deploy via viem + Remix checklist fallback
│   │   └── Step7Dashboard.tsx    # Per-wallet deploy history, tier status
│   └── ui/                       # shadcn/ui generated components (accordion, button, etc.)
```

---

## Provider tree (main.tsx)

```
WagmiProvider (config from lib/wagmi.ts)
  └── QueryClientProvider
        └── RainbowKitProvider (theme: darkTheme, accentColor: #FFD700)
              └── App
```

The `config` object is created with `getDefaultConfig` from RainbowKit — this handles both wagmi and WalletConnect setup in one call. **Do not split it into separate `createConfig` + `createWagmiConfig` calls** — RainbowKit v2 requires `getDefaultConfig`.

---

## State management (lib/store.ts)

Single Zustand store, persisted to `localStorage` under key `fatdeploy-store`.

```ts
useStore() → {
  // Wizard
  step: number
  setStep(s: number): void

  // Token configuration (filled across steps 2–4)
  cfg: TokenConfig
  setCfg(patch: Partial<TokenConfig>): void
  resetCfg(): void

  // Per-wallet data — keyed by wallet address (lowercased)
  userData: Record<string, UserData>
  getUserData(addr: string): UserData   // returns default if not found
  upgradeTier(addr, tier, txHash, token): void
  addDeploy(addr, DeployRecord): void

  // Payment UI state
  selectedTier: 'starter' | 'pro' | 'elite'
  setSelectedTier(t): void
  payMethod: 'blin' | 'native'
  setPayMethod(m): void
}
```

`UserData` shape:
```ts
{
  tier: 'free' | 'starter' | 'pro' | 'elite'
  deploysUsed: number
  deploysLimit: number        // 0=free, 1=starter, 3=pro, 999=elite
  paymentTxHash: string | null
  paymentToken: string | null
  deploys: DeployRecord[]     // newest first
}
```

`TokenConfig` has 30 fields covering all FatTokenV5 constructor parameters. `DEFAULT_CFG` in store.ts has the safe defaults.

---

## Chain config (lib/wagmi.ts)

Supported chains: **BSC (56) · Ethereum (1) · Arbitrum One (42161) · BSC Testnet (97)**

```ts
ROUTERS[chainId]         // DEX router address per chain
CHAIN_EXPLORERS[chainId] // Block explorer base URL per chain
```

To add a new chain:
1. Import it from `wagmi/chains`
2. Add it to the `chains` array in `getDefaultConfig`
3. Add a `transport` entry
4. Add entries to `ROUTERS` and `CHAIN_EXPLORERS`

**WalletConnect project ID** is currently set to `'fatdeploy-demo'`. Replace with a real ID from [cloud.walletconnect.com](https://cloud.walletconnect.com) before going live.

---

## On-chain logic (lib/contracts.ts)

### ⚠️ Critical: BLIN payment chain isolation

`$BLIN` (`0xaEFB54306240502c5421Be478fa16aACfA9698A2`) lives on **Ethereum mainnet only**.

The file creates a **dedicated mainnet `PublicClient`** at module level:
```ts
const ethMainnetClient = createPublicClient({
  chain: mainnet,
  transport: http('https://cloudflare-eth.com'),
})
```

**Always use `ethMainnetClient` for BLIN reads — never the wagmi `publicClient` hook.**
The wagmi hook returns a client scoped to the user's currently connected chain. If they are on BSC, a `readContract` call through that client will hit a BSC node which has no code at the BLIN address and will revert with "Internal error".

`payWithBLIN` flow:
1. Reads balance via `ethMainnetClient.readContract` (always mainnet)
2. Calls `walletClient.switchChain({ id: mainnet.id })` to switch the user's wallet
3. Sends `writeContract` with `chain: mainnet` explicitly
4. Waits for receipt via `ethMainnetClient.waitForTransactionReceipt`

### Deploy flow (deployFatToken)

Requires `FAT_BYTECODE` to be populated. Current value is `''` — deploy will throw a clear error until bytecode is added.

Constructor encoding uses `encodeAbiParameters` + `parseAbiParameters` (not `encodeFunctionData` — that function does not support constructors).

```
bytecode + encodeAbiParameters('string[], address[], uint256[], bool[]', [...])
```

The four constructor param arrays map directly to FatTokenV5's constructor signature.

### Before going live — set these 3 constants

```ts
// lib/contracts.ts
export const TREASURY     = '0xYOUR_WALLET'   // receives all payments
export const FAT_BYTECODE = '0x...'            // from Remix compile output

// lib/wagmi.ts
projectId: 'YOUR_WALLETCONNECT_ID'
```

**To get FAT_BYTECODE:**
1. Open [remix.ethereum.org](https://remix.ethereum.org)
2. Paste `FatTokenV5.sol`, set compiler to `0.8.4`, enable optimization, 200 runs
3. Compile → Compilation Details → Bytecode → copy the `object` hex string
4. Prefix with `0x` and paste into `FAT_BYTECODE`

---

## Step-by-step wizard

| Step | Component | canNext condition |
|---|---|---|
| 0 | Step0Connect | auto-advances on wallet connect |
| 1 | Step1Plan | `user.tier !== 'free' && deploysLimit > 0` |
| 2 | Step2Identity | name, symbol, fundAddress, receiveAddress all non-empty |
| 3 | Step3Taxes | buyTotal < 2500 && sellTotal < 2500 |
| 4 | Step4Features | always true |
| 5 | Step5Review | always true |
| 6 | Step6Deploy | no next button (terminal step) |
| 7 | Step7Dashboard | no next button (terminal step) |

`canNext` logic lives in `App.tsx`. Steps auto-mount/unmount based on `step` from the store.

---

## Styling system

All design tokens are CSS custom properties defined in `src/index.css`:

```css
--gold: #FFD700          /* primary accent */
--gold-glow: rgba(255,215,0,0.15)
--navy: #040D18          /* page background */
--navy-card: #0A1929     /* card background */
--border: rgba(255,215,0,0.12)
--border-strong: rgba(255,215,0,0.3)
--text-muted: rgba(255,255,255,0.45)
--text-secondary: rgba(255,255,255,0.7)
--green: #00E676
--red: #FF5252
--blue: #4A90E2
```

Typography: `Syne` (headings/UI) + `Space Mono` (code, addresses, numbers).

Global utility classes (all defined in `index.css`, not Tailwind):
- `.card`, `.card-hover` — card containers
- `.field-group`, `.field-label`, `.field-input` — form fields
- `.toggle-wrap`, `.toggle-btn` — toggle switches
- `.pill`, `.pill-ok`, `.pill-warn`, `.pill-gold` — status badges
- `.btn-primary`, `.btn-ghost` — buttons
- `.step-dot` — wizard progress dots
- `.spinner` — loading spinner
- `.code-block` — monospace param viewer
- `.tax-bar-wrap`, `.tax-bar` — animated tax percentage bar
- `.sum-tile` — stat summary tile
- `.tier-card`, `.tier-badge` — pricing tier cards
- `.step-panel` — fadeIn animation wrapper

Tailwind is available for one-off utilities but the primary design system is the custom CSS variables.

---

## Shared UI components (components/ui-kit/index.tsx)

All exported from a single file. Import pattern:
```ts
import { Pill, Toggle, FeeInput, TaxBar, StatusBox, Spinner, FieldGroup, SumTile, CodeBlock } from '../ui-kit'
```

| Component | Props | Use for |
|---|---|---|
| `Pill` | `ok?: boolean, label, gold?` | Validation badges |
| `Toggle` | `on, onChange, name, desc` | Boolean feature flags |
| `FeeInput` | `label, value, onChange` | Tax bps inputs (0–2499) |
| `TaxBar` | `val` | Animated bps percentage bar |
| `StatusBox` | `msg, type: 'info'|'ok'|'err'` | Async operation feedback |
| `Spinner` | — | Loading state |
| `FieldGroup` | `label, children` | Labelled form field wrapper |
| `SumTile` | `val, label` | Gold stat tile |
| `CodeBlock` | `text` | Syntax-highlighted param block |

---

## FatTokenV5 constructor reference

The contract takes 4 arrays. Full mapping:

```
stringParams[0]  = name
stringParams[1]  = symbol

addressParams[0] = fundAddress        (EOA only — no contracts)
addressParams[1] = currency           (overridden to WETH if currencyIsEth=true)
addressParams[2] = swapRouter         (DEX router — see ROUTERS map)
addressParams[3] = receiveAddress     (gets 100% of supply at deploy)
addressParams[4] = ETH/rewardToken    (token LP holders earn)

numberParams[0]  = decimals
numberParams[1]  = totalSupply        (× 10^decimals)
numberParams[2]  = maxBuyAmount       (× 10^decimals)
numberParams[3]  = unused (0)
numberParams[4]  = maxWalletAmount    (× 10^decimals)
numberParams[5]  = _buyFundFee        (bps, max 2499)
numberParams[6]  = _buyLPFee
numberParams[7]  = _buyRewardFee
numberParams[8]  = buy_burnFee
numberParams[9]  = _sellFundFee
numberParams[10] = _sellLPFee
numberParams[11] = _sellRewardFee
numberParams[12] = sell_burnFee
numberParams[13] = killBatchBlockNumber
numberParams[14] = kb                 (kill blocks — sniper protection)
numberParams[15] = airdropNumbs       (0–3)

boolParams[0]    = enableOffTrade
boolParams[1]    = enableKillBlock
boolParams[2]    = enableRewardList
boolParams[3]    = enableSwapLimit
boolParams[4]    = enableWalletLimit
boolParams[5]    = enableChangeTax    (allows completeCustoms() post-deploy)
boolParams[6]    = currencyIsEth
boolParams[7]    = enableKillBatchBots
boolParams[8]    = enableTransferFee
boolParams[9]    = antiSYNC
```

Contract invariants enforced on-chain:
- `buyFee total (fund+LP+reward+burn) < 2500` — reverts if exceeded
- `sellFee total < 2500`
- `airdropNumbs <= 3`
- `fundAddress` must not be a contract (checked via `isContract`)

Post-deploy launch sequence:
1. Add liquidity to DEX pair
2. Call `startLP()` — enables LP additions
3. Call `launch()` — opens public trading (irreversible)
4. Optionally: `disableSwapLimit()`, `disableWalletLimit()` once volume stabilises
5. If `enableChangeTax=true`: call `completeCustoms([...8 values])` to update fees
6. Call `disableChangeTax()` to lock fees permanently

---

## Common tasks

**Add a new supported chain**
1. `src/lib/wagmi.ts` — add to `chains[]`, add `transport`, add to `ROUTERS`, `CHAIN_EXPLORERS`
2. `src/components/steps/Step2Identity.tsx` — add to the `CHAINS` display array
3. `src/App.tsx` — add to the `chainName` lookup map

**Add a new token config field**
1. Add to `TokenConfig` type in `store.ts`
2. Add default to `DEFAULT_CFG` in `store.ts`
3. Add UI input in the appropriate step (Step2–Step4)
4. Add to `generateParams()` in `contracts.ts`
5. Add to `deployFatToken()` constructor arg arrays if it maps to a contract param

**Add Stripe payments alongside $BLIN**
1. Create `src/lib/stripe.ts` with a `createCheckoutSession(tier)` function
2. Add a `'stripe'` option to `payMethod` type in `store.ts`
3. Add a third payment method button in `Step1Plan.tsx`
4. On Stripe success webhook, call `upgradeTier` via a backend endpoint

**Wire in bytecode for one-click deploy**
1. Compile `FatTokenV5.sol` in Remix (0.8.4, optimisation on, 200 runs)
2. Compilation Details → Bytecode → copy `object` field (hex string)
3. Set `FAT_BYTECODE = '0x' + objectHex` in `src/lib/contracts.ts`
4. Test on BSC Testnet first (chain 97)
