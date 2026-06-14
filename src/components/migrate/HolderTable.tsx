import type { SnapshotHolder } from '../../lib/store'

interface HolderTableProps {
  holders: SnapshotHolder[]
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function HolderTable({ holders }: HolderTableProps) {
  function downloadCSV() {
    const rows = [
      ['Address', 'V1 Balance', 'V2 Allocation'],
      ...holders.map(h => [h.address, h.v1Balance, h.v2Allocation]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'snapshot_holders.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (holders.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No snapshot data. Take a snapshot first.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {holders.length.toLocaleString()} holders
        </span>
        <button className="btn-ghost" style={{ padding: '5px 14px', fontSize: 12 }} onClick={downloadCSV}>
          ⬇ Download CSV
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>#</th>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Address</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>V1 Balance</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>V2 Allocation</th>
            </tr>
          </thead>
          <tbody>
            {holders.map((h, i) => (
              <tr key={h.address} style={{ borderBottom: '0.5px solid var(--border)' }}>
                <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{i + 1}</td>
                <td style={{ padding: '8px 10px', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>
                  {shortAddr(h.address)}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: "'Space Mono',monospace" }}>
                  {Number(h.v1Balance).toLocaleString()}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: "'Space Mono',monospace", color: 'var(--green)' }}>
                  {Number(h.v2Allocation).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
