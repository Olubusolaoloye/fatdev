import { http, fallback } from 'wagmi'
import { mainnet, bsc, bscTestnet, arbitrum } from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

export const config = getDefaultConfig({
  appName: 'FatDev',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'fatdev-demo',
  chains: [bsc, mainnet, arbitrum, bscTestnet],
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
  },
})

export const CHAIN_EXPLORERS: Record<number, string> = {
  56:    'https://bscscan.com',
  1:     'https://etherscan.io',
  42161: 'https://arbiscan.io',
  97:    'https://testnet.bscscan.com',
}

// WETH/WBNB address per chain — used as default reward token when none is specified
export const WETH: Record<number, `0x${string}`> = {
  56:    '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
  1:     '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH on Arbitrum
  97:    '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd', // WBNB testnet
}

export const ROUTERS: Record<number, `0x${string}`> = {
  56:    '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  1:     '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  42161: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
  97:    '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
}
