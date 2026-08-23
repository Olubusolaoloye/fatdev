import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import ComingSoon from '../components/ComingSoon'
import { BridgeSection } from '../features/bridge/BridgeSection'
import { useFeature } from '../hooks/useAppConfig'

export function BridgePage() {
  const { enabled, loading } = useFeature('bridge')

  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'var(--fd-void)' }} />
  }

  if (!enabled) {
    return (
      <ComingSoon
        icon="bridge"
        title="Bridge"
        blurb="Cross-chain bridging is temporarily unavailable while we upgrade routing and confirmation tracking."
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fd-void)', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main style={{ flex: 1, paddingTop: 'clamp(88px, 10vw, 108px)' }}>
        <BridgeSection />
      </main>
      <Footer />
    </div>
  )
}
