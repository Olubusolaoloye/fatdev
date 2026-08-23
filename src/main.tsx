import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import { config } from './lib/wagmi'
import { useAppConfig } from './hooks/useAppConfig'
import { MaintenancePage } from './components/MaintenancePage'
import App from './App'
import { LandingPage } from './pages/LandingPage'
import { ToolsPage }   from './pages/ToolsPage'
import { MigrateRouter } from './pages/migrate/MigrateRouter'
import { PricingPage }  from './pages/PricingPage'
import { BridgePage }   from './pages/BridgePage'
import { DashboardPage } from './pages/DashboardPage'
import { initTheme, useTheme } from './hooks/useTheme'
import '@rainbow-me/rainbowkit/styles.css'

initTheme()

const queryClient = new QueryClient()

// The wallet modal is rendered by RainbowKit, outside our stylesheet, so it
// has to be handed the palette explicitly and re-themed when the user toggles.
const rbkOpts = {
  accentColor: '#FFD700',
  accentColorForeground: '#130400',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
} as const

const RBK_DARK  = darkTheme(rbkOpts)
const RBK_LIGHT = lightTheme(rbkOpts)

/** Re-renders the wallet modal's palette when the user flips the theme. */
function ThemedRainbowKit({ children }: { children: React.ReactNode }) {
  const { resolved } = useTheme()
  return (
    <RainbowKitProvider theme={resolved === 'dark' ? RBK_DARK : RBK_LIGHT} modalSize="compact">
      {children}
    </RainbowKitProvider>
  )
}

function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { maintenanceMode, maintenanceMessage, loading } = useAppConfig()
  const params = new URLSearchParams(window.location.search)
  const isBypass = params.get('bypass') === 'fatadmin' || params.get('admin') === '1'

  if (!loading && maintenanceMode && !isBypass) {
    return <MaintenancePage message={maintenanceMessage} />
  }
  return <>{children}</>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <ThemedRainbowKit>
            <MaintenanceGate>
              <Routes>
                <Route path="/"          element={<LandingPage />} />
                <Route path="/tools"       element={<ToolsPage />} />
                <Route path="/tools/:slug" element={<ToolsPage />} />
                <Route path="/pricing"   element={<PricingPage />} />
                <Route path="/migrate/*" element={<MigrateRouter />} />
                <Route path="/bridge"     element={<BridgePage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/app/*"    element={<App />} />
                <Route path="/*"         element={<App />} />
              </Routes>
            </MaintenanceGate>
          </ThemedRainbowKit>
        </QueryClientProvider>
      </WagmiProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
