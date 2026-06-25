import { Routes, Route } from 'react-router-dom'
import { MigrateNav } from '../../components/migrate/MigrateNav'
import { MigrateLanding } from './MigrateLanding'
import { MigrateCalculator } from './MigrateCalculator'
import { MigrateCreate } from './MigrateCreate'
import { MigrateDashboard } from './MigrateDashboard'
import { HolderSwap } from './HolderSwap'
import { OraclePanel } from './OraclePanel'
import { SnapshotTool } from './SnapshotTool'

export function MigrateRouter() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--fd-void)' }}>
      <MigrateNav />
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
  )
}
