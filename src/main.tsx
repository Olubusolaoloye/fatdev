import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { config } from './lib/wagmi'
import App from './App'
import { LandingPage } from './pages/LandingPage'
import { ToolsPage }   from './pages/ToolsPage'
import { MigrateRouter } from './pages/migrate/MigrateRouter'
import { PricingPage }  from './pages/PricingPage'
import '@rainbow-me/rainbowkit/styles.css'

const queryClient = new QueryClient()

const rbkTheme = darkTheme({
  accentColor: '#00CFFF',
  accentColorForeground: '#080C18',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={rbkTheme} modalSize="compact">
            <Routes>
              <Route path="/"          element={<LandingPage />} />
              <Route path="/tools"     element={<ToolsPage />} />
              <Route path="/pricing"   element={<PricingPage />} />
              <Route path="/migrate/*" element={<MigrateRouter />} />
              <Route path="/app/*"     element={<App />} />
              <Route path="/*"         element={<App />} />
            </Routes>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
