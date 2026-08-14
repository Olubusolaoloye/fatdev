/**
 * shareCard.ts — renders a branded 1200×675 PNG summary card on a <canvas>.
 *
 * Drawn explicitly rather than screenshotting the DOM (html2canvas) so output is
 * pixel-deterministic, needs no dependency, and doesn't depend on CSS variables
 * or webfonts resolving the same way inside a cloned document.
 *
 * 1200×675 is 16:9 — X, Telegram, and Discord all preview it inline uncropped.
 *
 * Deliberately renders bad results with the same prominence as good ones: the
 * verdict band changes colour and wording, never size. This is a trust tool.
 */

// ── Canvas geometry (logical px; output is 2× for retina) ─────────────────────
const W = 1200
const H = 675
const SCALE = 2
const PAD = 48

// ── Palette (matches src/index.css design tokens) ─────────────────────────────
const VOID    = '#080C18'
const SURFACE = '#0D1424'
const CYAN    = '#00CFFF'
const GREEN   = '#00E57A'
const RED     = '#FF5252'
const AMBER   = '#FFB020'
const WHITE   = '#EEF2FF'
const GHOST   = '#8A9BC2'
const HAIR    = 'rgba(255,255,255,0.08)'

const DISPLAY = '"Space Grotesk", "Syne", system-ui, -apple-system, sans-serif'
const MONO    = '"JetBrains Mono", "Space Mono", ui-monospace, monospace'

export type Tone = 'good' | 'warn' | 'bad' | 'neutral'

export type ShareCardData = {
  /** Small caps label top-right, e.g. "TOKEN SECURITY SCAN" */
  kicker: string
  /** Token name */
  title: string
  /** Ticker, rendered as a chip */
  symbol: string
  /** e.g. "BNB Chain · 12,480 holders" */
  subtitle: string
  /** 0–100, drives the ring */
  score: number
  /** e.g. "SAFE" / "DANGER" / "GRADE A" */
  verdict: string
  verdictTone: Tone
  /** One-line plain-English summary under the verdict */
  verdictNote: string
  /** Up to 4 tiles */
  stats: { label: string; value: string; tone?: Tone }[]
  /** Pass/fail chips */
  highlights: { label: string; ok: boolean }[]
  /** Contract address, shown bottom-left in mono */
  contract: string
  /** e.g. "GoPlus Security · Honeypot.is" */
  sources: string
}

function toneColor(t: Tone | undefined): string {
  if (t === 'good') return GREEN
  if (t === 'warn') return AMBER
  if (t === 'bad')  return RED
  return WHITE
}

/** ctx.roundRect isn't in older Safari — polyfill the path we need. */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  if (typeof (ctx as any).roundRect === 'function') {
    ;(ctx as any).roundRect(x, y, w, h, rr)
    return
  }
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y,     x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x,     y + h, rr)
  ctx.arcTo(x,     y + h, x,     y,     rr)
  ctx.arcTo(x,     y,     x + w, y,     rr)
  ctx.closePath()
}

/** Truncate to fit maxW, appending an ellipsis. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let s = text
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1)
  return s + '…'
}

/**
 * Set the largest font size from `sizes` (descending) that fits `text` in maxW.
 * Values like "Renounced" would otherwise ellipsise inside a stat tile.
 */
function fitFontSize(
  ctx: CanvasRenderingContext2D, text: string, maxW: number,
  sizes: number[], weight: number, family: string
): void {
  for (const px of sizes) {
    ctx.font = `${weight} ${px}px ${family}`
    if (ctx.measureText(text).width <= maxW) return
  }
  ctx.font = `${weight} ${sizes[sizes.length - 1]}px ${family}`
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, px: string) {
  // Chrome 99+ / Safari 17+. Harmless no-op elsewhere.
  try { (ctx as any).letterSpacing = px } catch { /* unsupported */ }
}

/** Load the brand mark; resolves null if unavailable so we can fall back. */
function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = '/logo.png'          // same-origin — does not taint the canvas
    setTimeout(() => resolve(null), 2000)
  })
}

// ── Main renderer ─────────────────────────────────────────────────────────────
export async function renderShareCard(d: ShareCardData): Promise<Blob> {
  // Make sure webfonts are ready, otherwise canvas silently falls back to serif
  try { await (document as any).fonts?.ready } catch { /* no font API */ }

  const canvas = document.createElement('canvas')
  canvas.width  = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = 'alphabetic'

  const vColor = toneColor(d.verdictTone)

  // ── Background ──────────────────────────────────────────────────────────────
  ctx.fillStyle = VOID
  ctx.fillRect(0, 0, W, H)

  // Subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.022)'
  ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke()
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke()
  }

  // Verdict-coloured glow behind the ring
  const glow = ctx.createRadialGradient(196, 300, 0, 196, 300, 300)
  glow.addColorStop(0, vColor + '26')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // ── Header ──────────────────────────────────────────────────────────────────
  const logo = await loadLogo()
  const logoSize = 34
  if (logo) {
    ctx.save()
    roundRect(ctx, PAD, PAD - 4, logoSize, logoSize, 9)
    ctx.clip()
    ctx.drawImage(logo, PAD, PAD - 4, logoSize, logoSize)
    ctx.restore()
  } else {
    ctx.fillStyle = CYAN
    roundRect(ctx, PAD, PAD - 4, logoSize, logoSize, 9); ctx.fill()
    ctx.fillStyle = VOID
    ctx.font = `800 20px ${DISPLAY}`
    ctx.textAlign = 'center'
    ctx.fillText('F', PAD + logoSize / 2, PAD + 18)
    ctx.textAlign = 'left'
  }

  ctx.font = `800 23px ${DISPLAY}`
  ctx.fillStyle = WHITE
  ctx.fillText('Fat', PAD + logoSize + 12, PAD + 19)
  const fatW = ctx.measureText('Fat').width
  ctx.fillStyle = CYAN
  ctx.fillText('Dev', PAD + logoSize + 12 + fatW, PAD + 19)

  // Kicker (top right)
  setLetterSpacing(ctx, '2px')
  ctx.font = `700 12px ${MONO}`
  ctx.fillStyle = GHOST
  ctx.textAlign = 'right'
  ctx.fillText(d.kicker.toUpperCase(), W - PAD, PAD + 8)
  ctx.font = `400 11px ${MONO}`
  ctx.fillStyle = 'rgba(138,155,194,0.65)'
  ctx.fillText(
    new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    W - PAD, PAD + 26
  )
  setLetterSpacing(ctx, '0px')
  ctx.textAlign = 'left'

  // Header rule
  ctx.strokeStyle = HAIR
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, 108.5); ctx.lineTo(W - PAD, 108.5); ctx.stroke()

  // ── Score ring ──────────────────────────────────────────────────────────────
  const cx = 196, cy = 300, R = 92
  const pct = Math.max(0, Math.min(100, d.score)) / 100

  ctx.lineWidth = 18
  ctx.lineCap = 'round'

  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()

  if (pct > 0) {
    ctx.save()
    ctx.shadowColor = vColor
    ctx.shadowBlur = 22
    ctx.strokeStyle = vColor
    ctx.beginPath()
    ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct)
    ctx.stroke()
    ctx.restore()
  }

  ctx.textAlign = 'center'
  ctx.font = `800 66px ${DISPLAY}`
  ctx.fillStyle = vColor
  ctx.fillText(String(d.score), cx, cy + 12)
  setLetterSpacing(ctx, '3px')
  ctx.font = `700 13px ${MONO}`
  ctx.fillStyle = GHOST
  ctx.fillText('/ 100', cx, cy + 38)
  setLetterSpacing(ctx, '0px')
  ctx.textAlign = 'left'

  // ── Identity block ──────────────────────────────────────────────────────────
  const tx = 330
  const rightW = W - PAD - tx

  const nameMax = rightW - 130
  fitFontSize(ctx, d.title, nameMax, [46, 40, 34, 29], 800, DISPLAY)
  ctx.fillStyle = WHITE
  const shownName = fitText(ctx, d.title, nameMax)
  ctx.fillText(shownName, tx, 200)
  const nameW = Math.min(ctx.measureText(shownName).width, nameMax)

  // Symbol chip
  if (d.symbol) {
    ctx.font = `700 15px ${MONO}`
    const sw = ctx.measureText(d.symbol).width
    const chipX = tx + nameW + 14
    ctx.fillStyle = 'rgba(0,207,255,0.12)'
    roundRect(ctx, chipX, 176, sw + 22, 30, 8); ctx.fill()
    ctx.strokeStyle = 'rgba(0,207,255,0.3)'; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = CYAN
    ctx.fillText(d.symbol, chipX + 11, 197)
  }

  ctx.font = `400 17px ${DISPLAY}`
  ctx.fillStyle = GHOST
  ctx.fillText(fitText(ctx, d.subtitle, rightW), tx, 230)

  // ── Verdict band ────────────────────────────────────────────────────────────
  const bandY = 254, bandH = 70
  ctx.fillStyle = vColor + '1A'
  roundRect(ctx, tx, bandY, rightW, bandH, 12); ctx.fill()
  ctx.strokeStyle = vColor + '59'; ctx.lineWidth = 1.5; ctx.stroke()

  // Left accent bar
  ctx.fillStyle = vColor
  roundRect(ctx, tx, bandY, 6, bandH, 3); ctx.fill()

  setLetterSpacing(ctx, '2px')
  ctx.font = `800 26px ${DISPLAY}`
  ctx.fillStyle = vColor
  ctx.fillText(d.verdict.toUpperCase(), tx + 24, bandY + 33)
  setLetterSpacing(ctx, '0px')

  ctx.font = `400 14px ${DISPLAY}`
  ctx.fillStyle = 'rgba(238,242,255,0.72)'
  ctx.fillText(fitText(ctx, d.verdictNote, rightW - 48), tx + 24, bandY + 55)

  // ── Stat tiles ──────────────────────────────────────────────────────────────
  const stats = d.stats.slice(0, 4)
  if (stats.length) {
    const gap = 16
    const tileW = (W - PAD * 2 - gap * (stats.length - 1)) / stats.length
    const tileY = 366, tileH = 86

    stats.forEach((s, i) => {
      const x = PAD + i * (tileW + gap)
      ctx.fillStyle = SURFACE
      roundRect(ctx, x, tileY, tileW, tileH, 12); ctx.fill()
      ctx.strokeStyle = HAIR; ctx.lineWidth = 1; ctx.stroke()

      setLetterSpacing(ctx, '1.5px')
      ctx.font = `700 11px ${MONO}`
      ctx.fillStyle = GHOST
      ctx.fillText(s.label.toUpperCase(), x + 18, tileY + 30)
      setLetterSpacing(ctx, '0px')

      fitFontSize(ctx, s.value, tileW - 36, [28, 25, 22, 19], 800, DISPLAY)
      ctx.fillStyle = toneColor(s.tone)
      ctx.fillText(fitText(ctx, s.value, tileW - 36), x + 18, tileY + 66)
    })
  }

  // ── Highlight chips ─────────────────────────────────────────────────────────
  const chips = d.highlights.slice(0, 6)
  if (chips.length) {
    let x = PAD
    const chipY = 484, chipH = 34
    ctx.font = `600 14px ${DISPLAY}`

    for (const c of chips) {
      const col = c.ok ? GREEN : RED
      const label = `${c.ok ? '✓' : '✕'}  ${c.label}`
      const cw = ctx.measureText(label).width + 30
      if (x + cw > W - PAD) break

      ctx.fillStyle = col + '14'
      roundRect(ctx, x, chipY, cw, chipH, 17); ctx.fill()
      ctx.strokeStyle = col + '4D'; ctx.lineWidth = 1; ctx.stroke()

      ctx.fillStyle = col
      ctx.fillText(label, x + 15, chipY + 22)
      x += cw + 10
    }
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  ctx.strokeStyle = HAIR; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, 566.5); ctx.lineTo(W - PAD, 566.5); ctx.stroke()

  if (d.contract) {
    ctx.font = `400 13px ${MONO}`
    ctx.fillStyle = 'rgba(138,155,194,0.8)'
    ctx.fillText(d.contract, PAD, 600)
  }
  if (d.sources) {
    ctx.font = `400 12px ${DISPLAY}`
    ctx.fillStyle = 'rgba(138,155,194,0.55)'
    ctx.fillText(`Data: ${d.sources}`, PAD, 624)
  }

  ctx.textAlign = 'right'
  ctx.font = `700 17px ${DISPLAY}`
  ctx.fillStyle = CYAN
  ctx.fillText('fatdev.org', W - PAD, 600)
  ctx.font = `400 12px ${DISPLAY}`
  ctx.fillStyle = 'rgba(138,155,194,0.55)'
  ctx.fillText('Scan any token free', W - PAD, 622)
  ctx.textAlign = 'left'

  // Bottom accent
  ctx.fillStyle = vColor
  ctx.fillRect(0, H - 5, W, 5)

  // ── Export ──────────────────────────────────────────────────────────────────
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error('Canvas export failed')),
      'image/png'
    )
  })
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

export async function downloadShareCard(d: ShareCardData, filename: string): Promise<void> {
  const blob = await renderShareCard(d)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Copy the PNG straight to the clipboard for pasting into Telegram/X/Discord. */
export async function copyShareCard(d: ShareCardData): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false
  try {
    const blob = await renderShareCard(d)
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}
