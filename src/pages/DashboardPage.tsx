import Navbar from '../components/Navbar'
import { Step7Dashboard } from '../components/steps/Step7Dashboard'

export function DashboardPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--fd-void)', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main style={{
        flex: 1,
        maxWidth: 680, margin: '0 auto', width: '100%',
        padding: '80px 24px 48px',
        boxSizing: 'border-box',
      }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontFamily: 'var(--fd-font-display)', fontWeight: 700, fontSize: 24,
            color: 'var(--fd-white)', margin: 0, lineHeight: 1.2,
          }}>My Deploys</h1>
          <p style={{ fontSize: 14, color: 'var(--fd-ghost)', marginTop: 6, marginBottom: 0 }}>
            View and manage your deployed tokens
          </p>
        </div>
        <Step7Dashboard />
      </main>
    </div>
  )
}
