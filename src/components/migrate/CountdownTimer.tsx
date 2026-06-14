import { useEffect, useState } from 'react'

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, '0')
}

function getTimeLeft(targetMs: number) {
  const diff = Math.max(0, targetMs - Date.now())
  const totalSecs = Math.floor(diff / 1000)
  const dd = Math.floor(totalSecs / 86400)
  const hh = Math.floor((totalSecs % 86400) / 3600)
  const mm = Math.floor((totalSecs % 3600) / 60)
  const ss = totalSecs % 60
  return { dd, hh, mm, ss, done: diff === 0 }
}

export function CountdownTimer({ targetMs }: { targetMs: number }) {
  const [time, setTime] = useState(() => getTimeLeft(targetMs))

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft(targetMs)), 1000)
    return () => clearInterval(id)
  }, [targetMs])

  if (time.done) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--red)', fontFamily: "'Space Mono',monospace", fontSize: 14, fontWeight: 700 }}>
        Migration window closed
      </div>
    )
  }

  const segments = [
    { label: 'DD', value: pad(time.dd) },
    { label: 'HH', value: pad(time.hh) },
    { label: 'MM', value: pad(time.mm) },
    { label: 'SS', value: pad(time.ss) },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
      {segments.map((s, i) => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="countdown-digit">{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: "'Space Mono',monospace", letterSpacing: '0.1em' }}>
              {s.label}
            </div>
          </div>
          {i < segments.length - 1 && (
            <span style={{ color: 'var(--red)', fontSize: 20, fontWeight: 900, fontFamily: "'Space Mono',monospace", marginBottom: 12 }}>:</span>
          )}
        </div>
      ))}
    </div>
  )
}
