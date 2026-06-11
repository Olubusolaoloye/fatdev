import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { config } from './lib/wagmi'
import App from './App'
import '@rainbow-me/rainbowkit/styles.css'

const queryClient = new QueryClient()

const rbkTheme = darkTheme({
  accentColor: '#FFD700',
  accentColorForeground: '#040D18',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rbkTheme} modalSize="compact">
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
