import React from 'react'

// ── Pill ──────────────────────────────────────────────────────────────────────
export function Pill({ ok, label, gold }: { ok?: boolean; label: string; gold?: boolean }) {
  const cls = gold ? 'pill-gold' : ok ? 'pill-ok' : 'pill-warn'
  return <span className={`pill ${cls}`}>{ok !== undefined && (ok ? '✓ ' : '✗ ')}{label}</span>
}

// ── Toggle ────────────────────────────────────────────────────────────────────
export function Toggle({ on, onChange, name, desc }: {
  on: boolean; onChange: (v: boolean) => void; name: string; desc: string
}) {
  return (
    <div className="toggle-wrap">
      <div className="toggle-info">
        <div className="toggle-name">{name}</div>
        <div className="toggle-desc">{desc}</div>
      </div>
      <button className={`toggle-btn ${on ? 'on' : ''}`} onClick={() => onChange(!on)} aria-label={name} />
    </div>
  )
}

// ── FeeInput ──────────────────────────────────────────────────────────────────
export function FeeInput({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <div className="fee-field">
        <input type="number" min={0} max={2499} step={50} value={value}
          onChange={e => onChange(Math.max(0, Math.min(2499, +e.target.value)))}
          className="field-input" style={{ paddingRight: 52 }} />
        <span className="fee-pct">{(value / 100).toFixed(2)}%</span>
      </div>
    </div>
  )
}

// ── TaxBar ────────────────────────────────────────────────────────────────────
export function TaxBar({ val }: { val: number }) {
  const color = val > 2000 ? '#FF5252' : val > 1500 ? '#FFB74D' : '#00E676'
  return (
    <div className="tax-bar-wrap">
      <div className="tax-bar" style={{ width: `${Math.min(val / 25, 1) * 100}%`, background: color }} />
    </div>
  )
}

// ── StatusBox ─────────────────────────────────────────────────────────────────
export function StatusBox({ msg, type }: { msg: string; type: 'info' | 'ok' | 'err' }) {
  const c = { info: '#4A90E2', ok: '#00E676', err: '#FF5252' }[type]
  return (
    <div style={{ padding: '10px 14px', borderRadius: 8, background: `${c}18`, border: `0.5px solid ${c}55`, fontSize: 13, color: c, marginTop: 12 }}>
      {type === 'ok' ? '✓ ' : type === 'err' ? '✗ ' : '⏳ '}{msg}
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner() { return <div className="spinner" /> }

// ── FieldGroup ────────────────────────────────────────────────────────────────
export function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      {children}
    </div>
  )
}

// ── SumTile ───────────────────────────────────────────────────────────────────
export function SumTile({ val, label }: { val: React.ReactNode; label: string }) {
  return (
    <div className="sum-tile">
      <div className="sum-val" style={{ fontSize: 16 }}>{val}</div>
      <div className="sum-label">{label}</div>
    </div>
  )
}

// ── CodeBlock ─────────────────────────────────────────────────────────────────
export function CodeBlock({ text }: { text: string }) {
  const colored = text
    .replace(/\/\/ .+/g, m => `<span style="color:#444">${m}</span>`)
    .replace(/= (true|false)/g, (_, v) => `= <span style="color:#4A90E2">${v}</span>`)
    .replace(/= "([^"]*)"/g, (_, v) => `= <span style="color:#00E676">"${v}"</span>`)
    .replace(/= (\d[\d]*)/g, (_, v) => `= <span style="color:#FFD700">${v}</span>`)
    .replace(/^(\[\d+\])\s+(\w+)/gm, (_, idx, name) => `<span style="color:#555">${idx}</span> <span style="color:#ccc">${name}</span>`)
  return (
    <div className="code-block" style={{ maxHeight: 280, overflowY: 'auto' }}
      dangerouslySetInnerHTML={{ __html: colored }} />
  )
}
