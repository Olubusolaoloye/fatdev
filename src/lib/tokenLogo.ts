/**
 * tokenLogo.ts — token artwork from DexScreener, usable in the DOM, on a
 * canvas, and inside a PDF.
 *
 * DexScreener's CDN sends no `Access-Control-Allow-Origin` header. A plain
 * <img> renders fine, but anything that needs the *pixels* — drawing onto the
 * share card canvas, or embedding in the audit PDF — taints the canvas and makes
 * toBlob/toDataURL throw. `fetch` on the URL is blocked outright.
 *
 * So there are two paths on purpose:
 *   • DOM    → the DexScreener URL directly. Fast, no third party in the way.
 *   • Pixels → routed through images.weserv.nl, which re-serves the image with
 *              CORS headers. Verified drawable and untainted.
 *
 * Not every token has artwork — PancakeSwap has none across all 30 of its
 * DexScreener pairs — so every consumer must handle a null logo. The fallback
 * is a deterministic monogram avatar, coloured from the symbol, so a token with
 * no image still looks deliberate rather than broken.
 */

/** Pull the token's image out of a DexScreener pairs array, if any pair has one. */
export function logoFromPairs(pairs: any[] | undefined | null): string | null {
  if (!pairs?.length) return null
  for (const p of pairs) {
    const url = p?.info?.imageUrl
    if (typeof url === 'string' && url.startsWith('http')) return url
  }
  return null
}

/**
 * Re-serve a remote image with CORS headers so its pixels can be read.
 * Only needed for canvas/PDF — never for a plain <img>.
 */
export function corsSafeUrl(url: string, size = 256): string {
  const stripped = url.replace(/^https?:\/\//, '')
  return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}` +
         `&w=${size}&h=${size}&fit=cover&output=png`
}

/** Deterministic accent colour for a token with no artwork. */
export function monogramColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue} 62% 46%)`
}

/** One or two characters that read cleanly inside a small circle. */
export function monogram(symbol: string, name = ''): string {
  const src = (symbol || name || '?').replace(/[^A-Za-z0-9]/g, '')
  if (!src) return '?'
  return src.length <= 2 ? src.toUpperCase() : src.slice(0, 2).toUpperCase()
}

/**
 * Load a logo in a form whose pixels can be drawn.
 * Resolves null on any failure — a missing image must never block a scan,
 * a share card, or a PDF.
 */
export function loadLogoForPixels(
  url: string | null | undefined,
  size = 256,
  timeoutMs = 6000
): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null)
  return new Promise(resolve => {
    let settled = false
    const done = (v: HTMLImageElement | null) => { if (!settled) { settled = true; resolve(v) } }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => done(img)
    img.onerror = () => done(null)
    setTimeout(() => done(null), timeoutMs)
    img.src = corsSafeUrl(url, size)
  })
}

/** Data URL for jsPDF, which needs base64 rather than an element. */
export async function logoDataUrl(
  url: string | null | undefined,
  size = 128
): Promise<string | null> {
  const img = await loadLogoForPixels(url, size)
  if (!img) return null
  try {
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, size, size)
    return c.toDataURL('image/png')
  } catch {
    return null   // tainted or otherwise unusable
  }
}

/**
 * Draw a circular token avatar on a canvas — the real logo when available,
 * otherwise a coloured monogram. Always renders something.
 */
export function drawTokenAvatar(
  ctx: CanvasRenderingContext2D,
  opts: {
    img: HTMLImageElement | null
    symbol: string
    name?: string
    x: number; y: number; size: number
    /** Ring colour drawn around the avatar */
    ring?: string
    fontFamily?: string
  }
) {
  const { img, symbol, name = '', x, y, size, ring, fontFamily } = opts
  const r = size / 2
  const cx = x + r, cy = y + r

  ctx.save()

  // Clip to a circle so any artwork aspect ratio still reads as a coin
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()

  if (img) {
    ctx.drawImage(img, x, y, size, size)
  } else {
    ctx.fillStyle = monogramColor(symbol || name)
    ctx.fillRect(x, y, size, size)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = `800 ${Math.round(size * 0.42)}px ${fontFamily ?? 'system-ui, sans-serif'}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(monogram(symbol, name), cx, cy + size * 0.02)
  }

  ctx.restore()

  if (ring) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r - 0.75, 0, Math.PI * 2)
    ctx.strokeStyle = ring
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
  }
}
