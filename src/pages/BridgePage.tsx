import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { BridgeSection } from '../features/bridge/BridgeSection'

export function BridgePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--fd-void)', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main style={{ flex: 1, paddingTop: 40 }}>
        <BridgeSection />
      </main>
      <Footer />
    </div>
  )
}
