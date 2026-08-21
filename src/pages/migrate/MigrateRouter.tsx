import { Routes, Route } from 'react-router-dom'
import { MigrateNav } from '../../components/migrate/MigrateNav'
import Footer from '../../components/Footer'
import ComingSoon from '../../components/ComingSoon'
import { useFeature } from '../../hooks/useAppConfig'
import { MigrateLanding } from './MigrateLanding'
import { MigrateCalculator } from './MigrateCalculator'
import { MigrateCreate } from './MigrateCreate'
import { MigrateDashboard } from './MigrateDashboard'
import { HolderSwap } from './HolderSwap'
import { OraclePanel } from './OraclePanel'
import { SnapshotTool } from './SnapshotTool'

export function MigrateRouter() {
  const { enabled, loading } = useFeature('migrate')

  // Hold the render until real flags arrive so we never flash the live section
  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'var(--fd-void)' }} />
  }

  if (!enabled) {
    return (
      <ComingSoon
        icon="refresh"
        title="Migrate"
        blurb="Token V1 → V2 migration vaults are in final testing. We're making sure every vault is funded, audited, and battle-tested before holders trust it with their bags."
        bullets={[
          'One-click MigrationVault deploy — no Solidity required',
          'Custom V2-per-V1 exchange ratio and migration window',
          'Public self-serve swap page for your holders',
          'Snapshot tool and post-window airdrop for anyone who missed it',
          'Live vault analytics — participation rate, capacity, and disbursals',
        ]}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fd-void)', display: 'flex', flexDirection: 'column' }}>
      <MigrateNav />
      <div style={{ flex: 1 }}>
        <Routes>
          <Route index element={<MigrateLanding />} />
          <Route path="calculator" element={<MigrateCalculator />} />
          <Route path="create" element={<MigrateCreate />} />
          <Route path="dashboard" element={<MigrateDashboard />} />
          <Route path=":id" element={<HolderSwap />} />
          <Route path=":id/oracle" element={<OraclePanel />} />
          <Route path=":id/snapshot" element={<SnapshotTool />} />
        </Routes>
      </div>
      <Footer />
    </div>
  )
}
