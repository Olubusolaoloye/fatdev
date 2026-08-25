/**
 * shareCardTemplate.ts — renders the scan data onto full-card template artwork.
 *
 * A "template" is artwork sized to the whole 16:9 card, with the mascot on the
 * left and the rest left open for the data. That is different from the portrait
 * panel art, which only occupies a left column and lets the card draw its own
 * background. The two are told apart by aspect ratio at load time, so a set can
 * be migrated one tier at a time.
 *
 * ── Why the data sits on a panel ─────────────────────────────────────────────
 * The four tier templates are nowhere near equal in brightness. Measured mean
 * luminance of the area the data lands on:
 *
 *     bad      dark red     luma  38   white text 16.1:1  ✓
 *     perfect  dark green   luma  47   white text 14.3:1  ✓
 *     good     mid green    luma  78   white text  8.5:1  ~
 *     fair     snow scene   luma 178   white text  2.1:1  ✗✗
 *
 * So text drawn straight onto the art would be unreadable on half the set, and
 * would silently get worse whenever new art is added. Instead the data sits on
 * a translucent dark panel: contrast is then a property of the panel, not of
 * whatever artwork happens to be behind it, and every tier stays legible. The
 * panel is translucent so each tier's colour still tints through.
 */
import type { ShareCardData, Tone } from './shareCard'
import { drawTokenAvatar } from './tokenLogo'
import { TIER_LABEL, type MascotTier } from './mascots'

/** Landscape art is a full-card template; portrait art is a left-column panel. */
export const TEMPLATE_ASPECT_MIN = 1.4

/**
 * Panel geometry, in 1200x675 card space.
 *
 * The panel is 68% of the card width. The mascots run to roughly x=0.34, so a
 * panel starting at 0.30 laps its trailing edge slightly — which reads as glass
 * over the art rather than a collision, and buys the data real room.
 */
export const TPL = {
  panelX: 360,
  panelW: 816,          // 68% of 1200
  panelY: 26,
  panelH: 623,
  pad: 30,              // inner padding
  radius: 20,
}

type Ctx = CanvasRenderingContext2D

export type TemplateDeps = {
  W: number; H: number; PAD: number
  WHITE: string; GHOST: string; CYAN: string; GREEN: string; RED: string; HAIR: string
  DISPLAY: string; MONO: string
  toneColor: (t: Tone | undefined) => string
  roundRect: (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => void
  fitText: (ctx: Ctx, text: string, maxW: number) => string
  fitFontSize: (ctx: Ctx, text: string, maxW: number, sizes: number[], weight: number, family: string) => void
  setLetterSpacing: (ctx: Ctx, px: string) => void
}

export function renderOnTemplate(
  ctx: Ctx,
  d: ShareCardData,
  art: HTMLImageElement,
  tier: MascotTier,
  vColor: string,
  tokenImg: HTMLImageElement | null,
  logo: HTMLImageElement | null,
  k: TemplateDeps,
): void {
  const { W, H, WHITE, GHOST, CYAN, GREEN, RED, DISPLAY, MONO } = k
  const { toneColor, roundRect, fitText, fitFontSize, setLetterSpacing } = k

  // ── Artwork, full bleed ─────────────────────────────────────────────────────
  const scale = Math.max(W / art.width, H / art.height)
  ctx.drawImage(
    art,
    (W - art.width * scale) / 2, (H - art.height * scale) / 2,
    art.width * scale, art.height * scale,
  )

  // ── Readability panel ───────────────────────────────────────────────────────
  const px = TPL.panelX, pw = TPL.panelW, py = TPL.panelY, ph = TPL.panelH
  const x = px + TPL.pad                    // content left edge
  const cw = pw - TPL.pad * 2               // content width
  const right = x + cw

  ctx.save()
  roundRect(ctx, px, py, pw, ph, TPL.radius)
  ctx.clip()
  // Slightly lighter at the left so the art bleeds in and the panel does not
  // read as a hard-edged box pasted over the scene.
  const g = ctx.createLinearGradient(px, 0, px + pw, 0)
  g.addColorStop(0, 'rgba(10,5,2,0.74)')
  g.addColorStop(0.18, 'rgba(10,5,2,0.88)')
  g.addColorStop(1, 'rgba(10,5,2,0.92)')
  ctx.fillStyle = g
  ctx.fillRect(px, py, pw, ph)
  ctx.restore()

  ctx.strokeStyle = 'rgba(255,215,0,0.22)'
  ctx.lineWidth = 1
  roundRect(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, TPL.radius)
  ctx.stroke()

  // ── Brand row ───────────────────────────────────────────────────────────────
  const y = py + TPL.pad + 4
  const logoSize = 32
  if (logo) ctx.drawImage(logo, x, y - 22, logoSize, logoSize)
  ctx.font = `800 23px ${DISPLAY}`
  ctx.fillStyle = WHITE
  ctx.fillText('Fat', x + logoSize + 10, y)
  const fatW = ctx.measureText('Fat').width
  ctx.fillStyle = CYAN
  ctx.fillText('Dev', x + logoSize + 10 + fatW, y)

  setLetterSpacing(ctx, '2px')
  ctx.textAlign = 'right'
  ctx.font = `700 11px ${MONO}`
  ctx.fillStyle = GHOST
  ctx.fillText(d.kicker.toUpperCase(), right, y - 11)
  ctx.font = `400 11px ${MONO}`
  ctx.fillStyle = 'rgba(200,185,160,0.72)'
  ctx.fillText(
    new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    right, y + 6,
  )
  setLetterSpacing(ctx, '0px')
  ctx.textAlign = 'left'

  // ── Score ring + token identity ─────────────────────────────────────────────
  const R = 62
  const rx = x + R
  const ry = 178
  const pct = Math.max(0, Math.min(100, d.score)) / 100

  ctx.lineWidth = 14
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath(); ctx.arc(rx, ry, R, 0, Math.PI * 2); ctx.stroke()
  if (pct > 0) {
    ctx.save()
    ctx.shadowColor = vColor
    ctx.shadowBlur = 24
    ctx.strokeStyle = vColor
    ctx.beginPath()
    ctx.arc(rx, ry, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct)
    ctx.stroke()
    ctx.restore()
  }
  ctx.textAlign = 'center'
  ctx.font = `800 50px ${DISPLAY}`
  ctx.fillStyle = vColor
  ctx.fillText(String(d.score), rx, ry + 12)
  ctx.font = `700 11px ${MONO}`
  ctx.fillStyle = GHOST
  ctx.fillText('/ 100', rx, ry + 32)
  ctx.textAlign = 'left'

  // Tier wordmark, sitting on its own chip under the ring
  setLetterSpacing(ctx, '2.5px')
  ctx.font = `800 13px ${DISPLAY}`
  const tierW = ctx.measureText(TIER_LABEL[tier]).width + 26
  ctx.fillStyle = vColor + '26'
  roundRect(ctx, rx - tierW / 2, ry + R + 12, tierW, 26, 13); ctx.fill()
  ctx.strokeStyle = vColor + '66'; ctx.lineWidth = 1
  roundRect(ctx, rx - tierW / 2 + 0.5, ry + R + 12.5, tierW - 1, 25, 13); ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = vColor
  ctx.fillText(TIER_LABEL[tier], rx, ry + R + 30)
  setLetterSpacing(ctx, '0px')
  ctx.textAlign = 'left'

  // Token name — the loudest thing on the card after the score
  const nx = rx + R + 26
  const availW = right - nx
  const AV = 44
  drawTokenAvatar(ctx, {
    img: tokenImg, symbol: d.symbol, name: d.title,
    x: nx, y: 118, size: AV, ring: vColor + '77', fontFamily: DISPLAY,
  })

  fitFontSize(ctx, d.title, availW - AV - 16 - 84, [40, 35, 30, 26], 800, DISPLAY)
  ctx.fillStyle = WHITE
  const title = fitText(ctx, d.title, availW - AV - 16 - 84)
  ctx.fillText(title, nx + AV + 16, 152)
  const titleW = ctx.measureText(title).width

  ctx.font = `700 13px ${MONO}`
  const symW = ctx.measureText(d.symbol).width + 20
  const symX = nx + AV + 16 + titleW + 12
  ctx.fillStyle = 'rgba(255,215,0,0.16)'
  roundRect(ctx, symX, 130, symW, 25, 7); ctx.fill()
  ctx.strokeStyle = 'rgba(255,215,0,0.35)'; ctx.lineWidth = 1
  roundRect(ctx, symX + 0.5, 130.5, symW - 1, 24, 7); ctx.stroke()
  ctx.fillStyle = CYAN
  ctx.fillText(d.symbol, symX + 10, 147)

  ctx.font = `400 14px ${DISPLAY}`
  ctx.fillStyle = 'rgba(225,215,195,0.82)'
  ctx.fillText(fitText(ctx, d.subtitle, availW), nx, 178)

  // Verdict — big, coloured, unmissable
  fitFontSize(ctx, d.verdict.toUpperCase(), availW, [30, 26, 23, 20], 800, DISPLAY)
  ctx.fillStyle = vColor
  ctx.fillText(d.verdict.toUpperCase(), nx, 216)

  ctx.font = `400 13px ${DISPLAY}`
  ctx.fillStyle = 'rgba(225,215,195,0.8)'
  ctx.fillText(fitText(ctx, d.verdictNote, availW), nx, 240)

  // ── Stats — four across; 816px of panel makes that comfortable again ────────
  const stats = d.stats.slice(0, 4)
  const gap = 14
  const tw = (cw - gap * (stats.length - 1)) / stats.length
  const th = 102
  const ty = 318
  stats.forEach((st, i) => {
    const sx = x + i * (tw + gap)
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    roundRect(ctx, sx, ty, tw, th, 12); ctx.fill()
    ctx.strokeStyle = 'rgba(255,215,0,0.16)'; ctx.lineWidth = 1
    roundRect(ctx, sx + 0.5, ty + 0.5, tw - 1, th - 1, 12); ctx.stroke()

    setLetterSpacing(ctx, '1.6px')
    ctx.font = `700 10px ${MONO}`
    ctx.fillStyle = 'rgba(200,185,160,0.85)'
    ctx.fillText(st.label.toUpperCase(), sx + 16, ty + 26)
    setLetterSpacing(ctx, '0px')

    ctx.fillStyle = toneColor(st.tone)
    fitFontSize(ctx, st.value, tw - 36, [32, 28, 24, 21, 18], 800, DISPLAY)
    ctx.fillText(fitText(ctx, st.value, tw - 36), sx + 18, ty + 76)
  })

  // ── Pass/fail chips ─────────────────────────────────────────────────────────
  let cx2 = x
  let cy2 = ty + th + 26
  const chipH = 38
  for (const h of d.highlights) {
    ctx.font = `600 14px ${DISPLAY}`
    const label = `${h.ok ? '✓' : '✕'} ${h.label}`
    const wid = ctx.measureText(label).width + 30
    if (cx2 + wid > right) { cx2 = x; cy2 += chipH + 12 }
    if (cy2 + chipH > py + ph - 74) break
    const c = h.ok ? GREEN : RED
    ctx.fillStyle = c + '24'
    roundRect(ctx, cx2, cy2, wid, chipH, 19); ctx.fill()
    ctx.strokeStyle = c + '5C'; ctx.lineWidth = 1
    roundRect(ctx, cx2 + 0.5, cy2 + 0.5, wid - 1, chipH - 1, 19); ctx.stroke()
    ctx.fillStyle = c
    ctx.fillText(label, cx2 + 15, cy2 + 24)
    cx2 += wid + 10
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  const fy = py + ph - 38
  ctx.strokeStyle = 'rgba(255,215,0,0.16)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(x, fy - 16.5); ctx.lineTo(right, fy - 16.5); ctx.stroke()

  if (d.contract) {
    ctx.font = `400 11px ${MONO}`
    ctx.fillStyle = 'rgba(200,185,160,0.8)'
    ctx.fillText(fitText(ctx, d.contract, cw - 190), x, fy + 8)
  }
  ctx.textAlign = 'right'
  ctx.font = `700 17px ${DISPLAY}`
  ctx.fillStyle = CYAN
  ctx.fillText('fatdev.org', right, fy + 4)
  // "Powered by $BLIN" — the ticker carries the brand, so it gets the accent
  // while the lead-in stays quiet. Still right-aligned, so $BLIN is measured
  // first and the lead-in is placed to land immediately before it.
  ctx.font = `700 11px ${DISPLAY}`
  const blinW = ctx.measureText('$BLIN').width
  ctx.fillStyle = CYAN
  ctx.fillText('$BLIN', right, fy + 21)
  ctx.font = `400 11px ${DISPLAY}`
  ctx.fillStyle = 'rgba(200,185,160,0.65)'
  ctx.fillText('Powered by ', right - blinW, fy + 21)
  ctx.textAlign = 'left'
}
