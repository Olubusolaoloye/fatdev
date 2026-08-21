import { http, fallback } from 'wagmi'
import {
  mainnet, bsc, bscTestnet, arbitrum, polygon, base, optimism, avalanche,
  linea, mantle, sei, gnosis, cronos, pulsechain, sonic, hyperEvm, monad,
  loop, plasma, stable,
} from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { robinhoodChain } from '../chains/robinhoodChain'

export { robinhoodChain }

export const config = getDefaultConfig({
  appName: 'FatDev',
  appDescription: 'No-code BEP-20 / ERC-20 token deployer — deploy FatToken without writing Solidity.',
  appUrl: import.meta.env.VITE_APP_URL || 'https://fatdev.org',
  appIcon: (import.meta.env.VITE_APP_URL || 'https://fatdev.org') + '/logo.png',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
  chains: [
    bsc, mainnet, arbitrum, base, polygon, optimism, avalanche, linea,
    hyperEvm, sonic, mantle, sei, gnosis, cronos, robinhoodChain, monad,
    pulsechain, plasma, stable, loop,
    bscTestnet,
  ],
  transports: {
    [bsc.id]: fallback([
      http('https://bsc-dataseed.binance.org'),
      http('https://bsc-dataseed1.defibit.io'),
      http('https://bsc-dataseed2.defibit.io'),
      http('https://bsc.publicnode.com'),
      http('https://1rpc.io/bnb'),
    ]),
    [mainnet.id]: fallback([
      http('https://eth.llamarpc.com'),
      http('https://rpc.ankr.com/eth'),
      http('https://1rpc.io/eth'),
      http('https://ethereum.publicnode.com'),
      http('https://cloudflare-eth.com'),
    ]),
    [arbitrum.id]: fallback([
      http('https://arb1.arbitrum.io/rpc'),
      http('https://arbitrum.llamarpc.com'),
      http('https://rpc.ankr.com/arbitrum'),
      http('https://1rpc.io/arb'),
      http('https://arbitrum.publicnode.com'),
    ]),
    [base.id]: fallback([
      http('https://mainnet.base.org'),
      http('https://base.llamarpc.com'),
      http('https://base.publicnode.com'),
    ]),
    [polygon.id]: fallback([
      http('https://polygon-rpc.com'),
      http('https://polygon.llamarpc.com'),
      http('https://polygon-bor.publicnode.com'),
    ]),
    [optimism.id]: fallback([
      http('https://mainnet.optimism.io'),
      http('https://optimism.llamarpc.com'),
      http('https://optimism.publicnode.com'),
    ]),
    [avalanche.id]: fallback([
      http('https://api.avax.network/ext/bc/C/rpc'),
      http('https://avalanche-c-chain.publicnode.com'),
    ]),
    [bscTestnet.id]: fallback([
      http('https://data-seed-prebsc-1-s1.binance.org:8545'),
      http('https://data-seed-prebsc-2-s1.binance.org:8545'),
      http('https://bsc-testnet.publicnode.com'),
    ]),
    [robinhoodChain.id]: http(
      import.meta.env.VITE_ROBINHOOD_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com'
    ),
    // Remaining chains use the default RPC bundled with the viem chain definition
    [linea.id]:     http(),
    [hyperEvm.id]:  http(),
    [sonic.id]:     http(),
    [mantle.id]:    http(),
    [sei.id]:       http(),
    [gnosis.id]:    http(),
    [cronos.id]:    http(),
    [monad.id]:     http(),
    [pulsechain.id]:http(),
    [plasma.id]:    http(),
    [stable.id]:    http(),
    [loop.id]:      http(),
  },
})

/**
 * Plain RPC URL per chain — used for lightweight `eth_getCode` probes during
 * chain auto-detection, where spinning up 20 viem clients would be wasteful.
 */
export const CHAIN_RPC: Record<number, string> = {
  56:    'https://bsc-dataseed.binance.org',
  1:     'https://eth.llamarpc.com',
  42161: 'https://arb1.arbitrum.io/rpc',
  8453:  'https://mainnet.base.org',
  137:   'https://polygon-rpc.com',
  10:    'https://mainnet.optimism.io',
  43114: 'https://api.avax.network/ext/bc/C/rpc',
  59144: linea.rpcUrls.default.http[0],
  999:   hyperEvm.rpcUrls.default.http[0],
  146:   sonic.rpcUrls.default.http[0],
  5000:  mantle.rpcUrls.default.http[0],
  1329:  sei.rpcUrls.default.http[0],
  100:   gnosis.rpcUrls.default.http[0],
  25:    cronos.rpcUrls.default.http[0],
  4663:  import.meta.env.VITE_ROBINHOOD_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com',
  143:   monad.rpcUrls.default.http[0],
  369:   pulsechain.rpcUrls.default.http[0],
  9745:  plasma.rpcUrls.default.http[0],
  988:   stable.rpcUrls.default.http[0],
  15551: loop.rpcUrls.default.http[0],
  97:    'https://bsc-testnet.publicnode.com',
}

/**
 * DexScreener's chain slugs, keyed by our chain id. Used both for market data
 * and as the fast path for chain detection. Chains absent from this map simply
 * fall back to the RPC bytecode probe.
 */
export const DEXSCREENER_SLUG: Record<number, string> = {
  1:     'ethereum',
  56:    'bsc',
  137:   'polygon',
  42161: 'arbitrum',
  8453:  'base',
  10:    'optimism',
  43114: 'avalanche',
  59144: 'linea',
  5000:  'mantle',
  146:   'sonic',
  25:    'cronos',
  100:   'gnosischain',
  369:   'pulsechain',
  1329:  'seiv2',
  999:   'hyperliquid',
}

export const CHAIN_ID_BY_DEX_SLUG: Record<string, number> = Object.fromEntries(
  Object.entries(DEXSCREENER_SLUG).map(([id, slug]) => [slug, Number(id)])
)

// ── Display metadata ──────────────────────────────────────────────────────────
export type ChainMeta = { id: number; label: string; short: string; testnet?: boolean }

export const SUPPORTED_CHAINS: ChainMeta[] = [
  { id: 56,    label: 'BNB Chain',      short: 'BNB'   },
  { id: 1,     label: 'Ethereum',       short: 'ETH'   },
  { id: 42161, label: 'Arbitrum One',   short: 'ARB'   },
  { id: 8453,  label: 'Base',           short: 'BASE'  },
  { id: 137,   label: 'Polygon',        short: 'POL'   },
  { id: 10,    label: 'Optimism',       short: 'OP'    },
  { id: 43114, label: 'Avalanche',      short: 'AVAX'  },
  { id: 59144, label: 'Linea',          short: 'LINEA' },
  { id: 999,   label: 'HyperEVM',       short: 'HYPE'  },
  { id: 146,   label: 'Sonic',          short: 'SONIC' },
  { id: 5000,  label: 'Mantle',         short: 'MNT'   },
  { id: 1329,  label: 'Sei',            short: 'SEI'   },
  { id: 100,   label: 'Gnosis',         short: 'XDAI'  },
  { id: 25,    label: 'Cronos',         short: 'CRO'   },
  { id: 4663,  label: 'Robinhood',      short: 'RH'    },
  { id: 143,   label: 'Monad',          short: 'MON'   },
  { id: 369,   label: 'PulseChain',     short: 'PLS'   },
  { id: 9745,  label: 'Plasma',         short: 'XPL'   },
  { id: 988,   label: 'Stable',         short: 'USDT0' },
  { id: 15551, label: 'LOOP',           short: 'LOOP'  },
  { id: 97,    label: 'BSC Testnet',    short: 'tBNB', testnet: true },
]

export const CHAIN_NAME: Record<number, string> = Object.fromEntries(
  SUPPORTED_CHAINS.map(c => [c.id, c.label])
)

export const CHAIN_EXPLORERS: Record<number, string> = {
  56:    'https://bscscan.com',
  1:     'https://etherscan.io',
  42161: 'https://arbiscan.io',
  8453:  'https://basescan.org',
  137:   'https://polygonscan.com',
  10:    'https://optimistic.etherscan.io',
  43114: 'https://snowtrace.io',
  59144: 'https://lineascan.build',
  999:   'https://hyperevmscan.io',
  146:   'https://sonicscan.org',
  5000:  'https://mantlescan.xyz',
  1329:  'https://seitrace.com',
  100:   'https://gnosisscan.io',
  25:    'https://cronoscan.com',
  4663:  'https://robinhoodchain.blockscout.com',
  143:   'https://monadexplorer.com',
  369:   'https://scan.pulsechain.com',
  9745:  'https://plasmascan.to',
  988:   'https://stablescan.io',
  15551: 'https://explorer.mainnetloop.com',
  97:    'https://testnet.bscscan.com',
}

// Wrapped native token per chain — default reward token when none is specified
export const WETH: Record<number, `0x${string}`> = {
  56:    '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
  1:     '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
  8453:  '0x4200000000000000000000000000000000000006', // WETH (OP Stack)
  137:   '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
  10:    '0x4200000000000000000000000000000000000006', // WETH (OP Stack)
  43114: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // WAVAX
  100:   '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', // WXDAI
  25:    '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23', // WCRO
  369:   '0xA1077a294dDE1B09bB078844df40758a5D0f9a27', // WPLS
  97:    '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd', // WBNB testnet
}

/**
 * Uniswap-V2-compatible routers, verified per chain.
 *
 * Only chains with a router we have actually confirmed appear here. A wrong
 * router address bricks a launch — the token would point at a contract that
 * cannot create a pair, and LP could never be added. Chains not listed here
 * are still fully scannable and usable for transfers; the deploy step asks the
 * user to supply their preferred router instead of guessing one for them.
 */
export const ROUTERS: Record<number, `0x${string}`> = {
  56:    '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap V2
  1:     '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2
  42161: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // SushiSwap
  8453:  '0x327Df1E6de05895d2ab08513aaDD9313Fe505d86', // BaseSwap
  137:   '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // QuickSwap
  43114: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4', // Trader Joe V1
  100:   '0x1C232F01118CB8B424793ae03F870aa7D0ac7f77', // Honeyswap
  25:    '0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae', // VVS Finance
  369:   '0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02', // PulseX
  97:    '0xD99D1c33F9fC3444f8101754aBC46c52416550D1', // PancakeSwap Testnet
}

export const DEX_FACTORIES: Record<number, `0x${string}`> = {
  56:    '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', // PancakeSwap V2
  1:     '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // Uniswap V2
  42161: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', // SushiSwap
  8453:  '0xFDa619b6d20975be80A10332cD39b9a4b0FAa8BB', // BaseSwap
  137:   '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32', // QuickSwap
  43114: '0x9Ad6C38BE94206cA50bb0d90783181662f0Cfa10', // Trader Joe V1
  100:   '0xA818b4F111Ccac7AA31D0BCc0806d64F2E0737D7', // Honeyswap
  25:    '0x3B44B2a187a7b3824131F8db5a74af6A711d4a5e', // VVS Finance
  369:   '0x1715a3E4A142d8b698131108995174F37aEBA10D', // PulseX
  97:    '0x6725F303b657a9451d8BA641348b6761A6CC7a17', // PancakeSwap Testnet
}

export const DEX_NAMES: Record<number, string> = {
  56:    'PancakeSwap',
  1:     'Uniswap V2',
  42161: 'SushiSwap',
  8453:  'BaseSwap',
  137:   'QuickSwap',
  43114: 'Trader Joe',
  100:   'Honeyswap',
  25:    'VVS Finance',
  369:   'PulseX',
  97:    'PancakeSwap Testnet',
}

/** Chains where one-click deploy works without the user supplying a router. */
export function hasVerifiedRouter(chainId: number): boolean {
  return !!ROUTERS[chainId]
}
