import Navbar from '../components/Navbar'
import { BridgeSection } from '../features/bridge/BridgeSection'

export function BridgePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--fd-void)' }}>
      <Navbar />
      <main style={{ paddingTop: 40 }}>
        <BridgeSection />
      </main>
    </div>
  )
}
