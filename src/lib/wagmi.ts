import { http, fallback } from 'wagmi'
import { mainnet, bsc, bscTestnet, arbitrum } from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { robinhoodChain } from '../chains/robinhoodChain'

export { robinhoodChain }

export const config = getDefaultConfig({
  appName: 'FatDev',
  appDescription: 'No-code BEP-20 / ERC-20 token deployer — deploy FatToken without writing Solidity.',
  appUrl: import.meta.env.VITE_APP_URL || 'https://fatdev.io',
  appIcon: (import.meta.env.VITE_APP_URL || 'https://fatdev.io') + '/logo.png',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
  chains: [bsc, mainnet, arbitrum, bscTestnet, robinhoodChain],
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
    [bscTestnet.id]: fallback([
      http('https://data-seed-prebsc-1-s1.binance.org:8545'),
      http('https://data-seed-prebsc-2-s1.binance.org:8545'),
      http('https://data-seed-prebsc-1-s2.binance.org:8545'),
      http('https://bsc-testnet.publicnode.com'),
    ]),
    [robinhoodChain.id]: http(
      import.meta.env.VITE_ROBINHOOD_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com'
    ),
  },
})

export const CHAIN_EXPLORERS: Record<number, string> = {
  56:    'https://bscscan.com',
  1:     'https://etherscan.io',
  42161: 'https://arbiscan.io',
  97:    'https://testnet.bscscan.com',
  4663:  'https://robinhoodchain.blockscout.com',
}

// WETH/WBNB address per chain — used as default reward token when none is specified
export const WETH: Record<number, `0x${string}`> = {
  56:    '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
  1:     '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH on Arbitrum
  97:    '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd', // WBNB testnet
  // Robinhood Chain: native ETH, no wrapped token address needed for deploy flow
}

export const ROUTERS: Record<number, `0x${string}`> = {
  56:    '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap V2
  1:     '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2
  42161: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // SushiSwap Arbitrum
  97:    '0xD99D1c33F9fC3444f8101754aBC46c52416550D1', // PancakeSwap Testnet
}

export const DEX_FACTORIES: Record<number, `0x${string}`> = {
  56:    '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', // PancakeSwap V2 factory
  1:     '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // Uniswap V2 factory
  42161: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4', // SushiSwap factory
  97:    '0x6725F303b657a9451d8BA641348b6761A6CC7a17', // PancakeSwap Testnet factory
}

export const DEX_NAMES: Record<number, string> = {
  56:    'PancakeSwap',
  1:     'Uniswap V2',
  42161: 'SushiSwap',
  97:    'PancakeSwap Testnet',
}
