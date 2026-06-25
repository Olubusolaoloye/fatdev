export function MaintenancePage({ message }: { message: string }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--fd-void)', color: 'var(--fd-white)', flexDirection: 'column',
      gap: 0, padding: '2rem', textAlign: 'center',
    }}>
      <div style={{ marginBottom: 32 }}>
        <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="48" cy="48" r="44" stroke="var(--fd-border-cyan)" strokeWidth="1.5" />
          <circle cx="48" cy="48" r="34" stroke="var(--fd-cyan-ghost)" strokeWidth="8" />
          <rect x="38" y="44" width="20" height="14" rx="3" fill="var(--fd-cyan)" />
          <path d="M42 44 C42 38 54 38 54 44" stroke="var(--fd-cyan)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="48" cy="50" r="2.5" fill="var(--fd-void)" />
          <rect x="46.5" y="50" width="3" height="4" rx="1" fill="var(--fd-void)" />
        </svg>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 10px', fontFamily: 'var(--fd-font-display)' }}>
        Under Maintenance
      </h1>
      <p style={{
        fontSize: 14, color: 'var(--fd-ghost)', maxWidth: 420,
        lineHeight: 1.7, margin: '0 0 28px', fontFamily: 'var(--fd-font-display)',
      }}>
        {message}
      </p>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px',
        borderRadius: 40, background: 'var(--fd-cyan-ghost)', border: '1px solid var(--fd-border-cyan)',
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', background: 'var(--fd-cyan)',
          display: 'inline-block', animation: 'pulse 1.8s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 12, color: 'var(--fd-cyan)', fontFamily: 'var(--fd-font-mono)' }}>
          We'll be back shortly
        </span>
      </div>

      <p style={{ marginTop: 36, fontSize: 11, color: 'var(--fd-hint)', fontFamily: 'var(--fd-font-mono)' }}>
        FatDev · fatdev.org
      </p>
    </div>
  )
}
