import type { OracleEvent } from '../../lib/store'

interface EventFeedProps {
  events: OracleEvent[]
  onRetry?: (event: OracleEvent) => void
}

const TYPE_COLOR: Record<OracleEvent['type'], string> = {
  swap: 'var(--green)',
  disburse: 'var(--blue)',
  deposit: 'var(--gold)',
  error: 'var(--red)',
}

const TYPE_ICON: Record<OracleEvent['type'], string> = {
  swap: '⇄',
  disburse: '→',
  deposit: '↓',
  error: '✕',
}

function shortAddr(addr: string) {
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
}

function timeAgo(ts: number) {
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

export function EventFeed({ events, onRetry }: EventFeedProps) {
  if (events.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No oracle events yet. Events will appear here as holders migrate.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {events.map(ev => (
        <div key={ev.id} className="event-row">
          {/* Icon */}
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: `${TYPE_COLOR[ev.type]}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, color: TYPE_COLOR[ev.type],
            flexShrink: 0,
          }}>
            {TYPE_ICON[ev.type]}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
              {ev.type}
              {' '}
              <span style={{ fontFamily: "'Space Mono',monospace", color: 'var(--text-muted)', fontSize: 11 }}>
                {shortAddr(ev.address)}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {Number(ev.amount).toLocaleString()} tokens · {timeAgo(ev.timestamp)}
            </div>
          </div>

          {/* Status / retry */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {ev.status === 'ok' && (
              <span className="pill pill-ok" style={{ fontSize: 10 }}>OK</span>
            )}
            {ev.status === 'pending' && (
              <span className="pill pill-gold" style={{ fontSize: 10 }}>pending</span>
            )}
            {ev.status === 'failed' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="pill pill-warn" style={{ fontSize: 10 }}>failed</span>
                {onRetry && (
                  <button
                    className="btn-ghost"
                    style={{ padding: '2px 8px', fontSize: 10 }}
                    onClick={() => onRetry(ev)}
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
