# FatDeploy — No-code FatTokenV5 SaaS

A production-grade React SaaS for configuring and deploying `FatTokenV5` BEP-20/ERC-20 tokens without touching Solidity.

## Tech Stack

| Layer | Package |
|---|---|
| Framework | React 19 + Vite |
| Wallet connect | **RainbowKit** (MetaMask, Coinbase, WalletConnect, Rabby, Brave…) |
| Web3 hooks | **wagmi v3** |
| Low-level EVM | **viem** (replaces ethers for on-chain reads/writes) |
| Server state | **@tanstack/react-query** |
| App state | **Zustand** (persisted to localStorage) |
| Styling | Tailwind CSS + custom CSS vars |
| Types | TypeScript |

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # production build → dist/
```

## To enable one-click deploy

1. Compile `FatTokenV5.sol` in Remix (Solidity 0.8.4, 200-run optimisation)
2. Copy the **bytecode** from Remix → Compilation Details
3. Paste it into `src/lib/contracts.ts`:
   ```ts
   export const FAT_BYTECODE = '0x...' as `0x${string}`
   ```

## To go live

1. Set your treasury wallet in `src/lib/contracts.ts → TREASURY`
2. Get a free WalletConnect Cloud project ID at [cloud.walletconnect.com](https://cloud.walletconnect.com) and set it in `src/lib/wagmi.ts → projectId`
3. `pnpm build` → deploy `dist/` to Netlify / Vercel / any static host

## Wizard steps

| Step | Content |
|---|---|
| 0 | Wallet connect (RainbowKit modal) |
| 1 | Tier selection + on-chain payment ($BLIN or native) |
| 2 | Token identity, addresses, chain selection |
| 3 | Buy/sell taxes with live bps bars + validation |
| 4 | Anti-bot & feature toggles |
| 5 | Constructor params preview + copy/download |
| 6 | One-click deploy via viem `ContractFactory` |
| 7 | Deploy history dashboard |
