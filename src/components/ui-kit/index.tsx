import React, { useState } from 'react'

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({
  children, onClick, disabled = false,
  variant = 'primary', style,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  style?: React.CSSProperties
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    fontFamily: 'var(--fd-font-display)', fontSize: 14, fontWeight: 600,
    padding: '10px 22px', borderRadius: 'var(--fd-radius)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    border: 'none', outline: 'none',
    transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease, opacity 150ms ease',
    whiteSpace: 'nowrap',
  }

  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: 'var(--fd-cyan)',        color: 'var(--fd-void)',  border: 'none' },
    secondary: { background: 'transparent',            color: 'var(--fd-cyan)',  border: '1px solid var(--fd-border-cyan)' },
    ghost:     { background: 'transparent',            color: 'var(--fd-ghost)', border: 'none' },
    danger:    { background: 'transparent',            color: '#FF6B6B',         border: '1px solid rgba(255,80,80,0.3)' },
  }

  const hover: Record<string, React.CSSProperties> = {
    primary:   { background: 'var(--fd-cyan-dim)' },
    secondary: { background: 'var(--fd-cyan-ghost)' },
    ghost:     { color: 'var(--fd-white)' },
    danger:    { background: 'rgba(255,80,80,0.08)' },
  }

  const [hovered, setHovered] = useState(false)
  const merged: React.CSSProperties = {
    ...base,
    ...variants[variant],
    ...(hovered && !disabled ? hover[variant] : {}),
    ...style,
  }

  return (
    <button
      style={merged}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      {children}
    </button>
  )
}

// ── Pill / Badge ──────────────────────────────────────────────────────────────
// Props kept identical to old Pill; gold→cyan, ok→green, warn→default/red
export function Pill({ ok, label, gold }: { ok?: boolean; label: string; gold?: boolean }) {
  type V = 'cyan' | 'green' | 'red' | 'default'
  const variant: V = gold ? 'cyan' : ok === true ? 'green' : ok === false ? 'red' : 'default'

  const styles: Record<V, React.CSSProperties> = {
    cyan:    { background: 'var(--fd-cyan-ghost)',   color: 'var(--fd-cyan)',   border: '1px solid var(--fd-border-cyan)'  },
    green:   { background: 'var(--fd-green-ghost)',  color: 'var(--fd-green)',  border: '1px solid var(--fd-border-green)' },
    red:     { background: 'rgba(255,80,80,0.10)',   color: '#FF6B6B',          border: '1px solid rgba(255,80,80,0.25)'  },
    default: { background: 'var(--fd-slate)',        color: 'var(--fd-ghost)',  border: 'none'                            },
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20,
      fontFamily: 'var(--fd-font-mono)', fontSize: 11, letterSpacing: '0.06em',
      ...styles[variant],
    }}>
      {ok !== undefined && (ok ? '✓ ' : '✗ ')}{label}
    </span>
  )
}

// Also export as Badge for new code
export function Badge({ children, variant = 'default' }: {
  children: React.ReactNode
  variant?: 'default' | 'cyan' | 'green' | 'purple'
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: 'var(--fd-slate)',        color: 'var(--fd-ghost)',   border: 'none' },
    cyan:    { background: 'var(--fd-cyan-ghost)',   color: 'var(--fd-cyan)',    border: '1px solid var(--fd-border-cyan)'  },
    green:   { background: 'var(--fd-green-ghost)',  color: 'var(--fd-green)',   border: '1px solid var(--fd-border-green)' },
    purple:  { background: 'var(--fd-purple-ghost)', color: 'var(--fd-purple)',  border: 'none' },
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20,
      fontFamily: 'var(--fd-font-mono)', fontSize: 11, letterSpacing: '0.06em',
      ...styles[variant],
    }}>
      {children}
    </span>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────
export function Toggle({ on, onChange, name, desc }: {
  on: boolean; onChange: (v: boolean) => void; name: string; desc: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${on ? 'var(--fd-border-cyan)' : 'var(--fd-border)'}`,
      borderRadius: 'var(--fd-radius)', padding: '12px 16px',
      gap: 12, transition: 'border-color 200ms ease',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fd-white)' }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--fd-ghost)', marginTop: 3, lineHeight: 1.5 }}>{desc}</div>
      </div>
      <button
        onClick={() => onChange(!on)}
        aria-label={name}
        style={{
          width: 44, height: 24, borderRadius: 12, flexShrink: 0,
          background: on ? 'var(--fd-cyan)' : 'var(--fd-slate)',
          border: 'none', cursor: 'pointer', position: 'relative',
          transition: 'background 200ms ease',
        }}>
        <span style={{
          position: 'absolute', top: 3, left: on ? 23 : 3,
          width: 18, height: 18, borderRadius: '50%',
          background: on ? 'var(--fd-void)' : 'var(--fd-ghost)',
          transition: 'left 200ms ease, background 200ms ease',
          display: 'block',
        }} />
      </button>
    </div>
  )
}

// ── FeeInput ──────────────────────────────────────────────────────────────────
export function FeeInput({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 11, fontWeight: 600, color: 'var(--fd-ghost)',
        letterSpacing: '0.08em', textTransform: 'uppercase',
        fontFamily: 'var(--fd-font-mono)',
      }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type="number" min={0} max={2499} step={50} value={value}
          onChange={e => onChange(Math.max(0, Math.min(2499, +e.target.value)))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            background: 'var(--fd-slate)',
            border: `1px solid ${focused ? 'var(--fd-cyan)' : 'var(--fd-border)'}`,
            borderRadius: 'var(--fd-radius)',
            padding: '10px 52px 10px 14px',
            color: 'var(--fd-white)',
            fontFamily: 'var(--fd-font-mono)',
            fontSize: 14, textAlign: 'right',
            outline: 'none',
            transition: 'border-color 150ms ease',
          }} />
        <span style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: 11, color: 'var(--fd-cyan)', pointerEvents: 'none',
          fontFamily: 'var(--fd-font-mono)',
        }}>{(value / 100).toFixed(2)}%</span>
      </div>
    </div>
  )
}

// ── TaxBar ────────────────────────────────────────────────────────────────────
export function TaxBar({ val }: { val: number }) {
  const fill = val > 2400 ? '#FF6B6B' : val > 2000 ? '#FFB800' : 'var(--fd-cyan)'
  return (
    <div style={{
      height: 6, background: 'var(--fd-slate)', borderRadius: 3, overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', borderRadius: 3,
        width: `${Math.min(val / 25, 100)}%`,
        background: fill,
        transition: 'width 200ms ease, background 200ms ease',
      }} />
    </div>
  )
}

// ── StatusBox ─────────────────────────────────────────────────────────────────
export function StatusBox({ msg, type }: { msg: string; type: 'info' | 'ok' | 'err' }) {
  const map = {
    ok:   { border: 'var(--fd-green)',   bg: 'var(--fd-green-ghost)', icon: '✓', color: 'var(--fd-green)'  },
    err:  { border: '#FF6B6B',           bg: 'rgba(255,80,80,0.08)', icon: '✗', color: '#FF6B6B'           },
    info: { border: 'var(--fd-cyan)',    bg: 'var(--fd-cyan-ghost)',  icon: '·', color: 'var(--fd-cyan)'   },
  }[type]

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px',
      borderRadius: `0 var(--fd-radius-sm) var(--fd-radius-sm) 0`,
      borderLeft: `3px solid ${map.border}`,
      background: map.bg,
      fontSize: 13, color: map.color,
      marginTop: 12, lineHeight: 1.6,
    }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>{map.icon}</span>
      <span>{msg}</span>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{
      width: 28, height: 28,
      border: '2px solid var(--fd-border)',
      borderTopColor: 'var(--fd-cyan)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      margin: '12px auto',
    }} />
  )
}

// ── FieldGroup ────────────────────────────────────────────────────────────────
export function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 11, fontWeight: 600,
        color: 'var(--fd-ghost)',
        letterSpacing: '0.08em', textTransform: 'uppercase',
        fontFamily: 'var(--fd-font-mono)',
      }}>{label}</label>
      {children}
    </div>
  )
}

// ── SumTile ───────────────────────────────────────────────────────────────────
export function SumTile({ val, label }: { val: React.ReactNode; label: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0',
      borderBottom: '1px solid var(--fd-border)',
    }}>
      <span style={{
        fontSize: 11, fontFamily: 'var(--fd-font-mono)',
        color: 'var(--fd-ghost)', letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>{label}</span>
      <span style={{
        fontSize: 15, fontWeight: 500, color: 'var(--fd-white)',
        fontFamily: 'var(--fd-font-mono)',
      }}>{val}</span>
    </div>
  )
}

// ── CodeBlock ─────────────────────────────────────────────────────────────────
export function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  const colored = text
    .replace(/\/\/ .+/g, m => `<span style="color:var(--fd-hint)">${m}</span>`)
    .replace(/= (true|false)/g, (_, v) => `= <span style="color:var(--fd-cyan)">${v}</span>`)
    .replace(/= "([^"]*)"/g, (_, v) => `= <span style="color:var(--fd-green)">"${v}"</span>`)
    .replace(/= (\d[\d]*)/g, (_, v) => `= <span style="color:#FFB800">${v}</span>`)
    .replace(/^(\[\d+\])\s+(\w+)/gm, (_, idx, name) =>
      `<span style="color:var(--fd-hint)">${idx}</span> <span style="color:var(--fd-ghost)">${name}</span>`)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={copy}
        style={{
          position: 'absolute', top: 10, right: 10,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: copied ? 'var(--fd-green)' : 'var(--fd-ghost)',
          fontSize: 12, fontFamily: 'var(--fd-font-mono)',
          padding: '2px 8px', borderRadius: 4,
          transition: 'color 150ms ease',
          zIndex: 1,
        }}
        title="Copy">
        {copied ? '✓ copied' : '⎘ copy'}
      </button>
      <div
        style={{
          background: 'var(--fd-void)',
          border: '1px solid var(--fd-border)',
          borderRadius: 'var(--fd-radius)',
          padding: '16px', paddingRight: 80,
          fontFamily: 'var(--fd-font-mono)', fontSize: 12,
          color: 'var(--fd-green)', lineHeight: 1.8,
          maxHeight: 280, overflowY: 'auto', overflowX: 'auto',
          whiteSpace: 'pre',
        }}
        dangerouslySetInnerHTML={{ __html: colored }}
      />
    </div>
  )
}
