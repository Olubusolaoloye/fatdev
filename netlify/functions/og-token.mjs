/**
 * og-token — the 1200×630 preview image for a shared token link.
 *
 * Wired in public/_redirects:  /og/token/*  → /.netlify/functions/og-token?address=:splat
 *
 * Drawn with satori (layout → SVG) and resvg (SVG → PNG). Fonts and the FatDev
 * mark are fetched from the site itself, so the function bundles no assets.
 */
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import {
  cleanAddress, shortAddr, fetchTokenStats, tierFor, TIER, parseChain, chainName,
} from '../lib/token.mjs'

const GOLD = '#FFD700', CREAM = '#FFF8E7', MUTED = 'rgba(255,248,231,0.6)', BG = '#130400'

let assets = null
async function loadAssets(origin) {
  if (assets) return assets
  const get = async p => Buffer.from(await (await fetch(new URL(p, origin))).arrayBuffer())
  const [g400, g700, m700, logo] = await Promise.all([
    get('/fonts/space-grotesk-400.woff'), get('/fonts/space-grotesk-700.woff'),
    get('/fonts/space-mono-700.woff'), get('/logo.png').catch(() => null),
  ])
  assets = {
    fonts: [
      { name: 'Grotesk', data: g400, weight: 400, style: 'normal' },
      { name: 'Grotesk', data: g700, weight: 700, style: 'normal' },
      { name: 'Mono', data: m700, weight: 700, style: 'normal' },
    ],
    logo: logo ? `data:image/png;base64,${logo.toString('base64')}` : null,
  }
  return assets
}

/**
 * Token artwork as a data URI. Remote, so bounded: https only, 2.5s, 1.5 MB,
 * and only formats the renderer decodes. Any failure falls back to a monogram.
 */
async function fetchLogo(src) {
  if (!src || !/^https:\/\//i.test(src)) return null
  try {
    // DexScreener's image CDN rejects requests without a browser-like
    // user-agent (422), and serves 800px by default — ask for a small one.
    const u = new URL(src)
    if (u.hostname === 'cdn.dexscreener.com') { u.searchParams.set('width', '256'); u.searchParams.set('height', '256') }
    const res = await fetch(u, {
      signal: AbortSignal.timeout(2500),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; FatDevPreview/1.0; +https://fatdev.org)', accept: 'image/png,image/jpeg,image/*;q=0.8' },
    })
    const type = (res.headers.get('content-type') || '').split(';')[0].trim()
    if (!res.ok || !/^image\/(png|jpeg|jpg|gif|webp)$/.test(type)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 1_500_000) return null
    return `data:${type};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

const h = (type, style, ...children) => ({ type, props: { style, children: children.flat().filter(c => c != null && c !== false) } })
const img = (src, style) => ({ type: 'img', props: { src, style } })

function scoreRing(score, color) {
  const r = 110, c = 2 * Math.PI * r, dash = (Math.max(0, Math.min(100, score)) / 100) * c
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260">` +
    `<circle cx="130" cy="130" r="${r}" fill="none" stroke="rgba(255,248,231,0.1)" stroke-width="18"/>` +
    `<circle cx="130" cy="130" r="${r}" fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round" ` +
    `stroke-dasharray="${dash} ${c}" transform="rotate(-90 130 130)"/></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function card({ stats, address, logo, brand }) {
  const tier = stats ? tierFor(stats.last_score, stats.last_verdict) : null
  const t = tier ? TIER[tier] : null
  const symbol = stats?.symbol || ''
  const name = stats?.name || symbol || shortAddr(address)
  const monogram = (symbol || name).replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?'

  const header = h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
    h('div', { display: 'flex', alignItems: 'center', gap: 14 },
      brand && img(brand, { width: 54, height: 54 }),
      h('div', { display: 'flex', fontSize: 34, fontWeight: 700, color: CREAM }, 'Fat', h('span', { color: GOLD }, 'Dev')),
    ),
    h('div', { display: 'flex', fontFamily: 'Mono', fontSize: 20, letterSpacing: 3, color: MUTED }, 'TOKEN SECURITY SCAN'),
  )

  const tokenRow = h('div', { display: 'flex', alignItems: 'center', gap: 22 },
    logo
      ? img(logo, { width: 88, height: 88, borderRadius: 44 })
      : h('div', { display: 'flex', width: 88, height: 88, borderRadius: 44, background: '#2A1606', border: `2px solid ${GOLD}`,
          alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, color: GOLD }, monogram),
    h('div', { display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 560 },
      h('div', { display: 'flex', alignItems: 'center', gap: 14 },
        h('div', { display: 'flex', fontSize: 58, fontWeight: 700, color: CREAM, lineHeight: 1 }, name.length > 18 ? `${name.slice(0, 17)}…` : name),
        symbol && h('div', { display: 'flex', fontFamily: 'Mono', fontSize: 22, color: GOLD, padding: '4px 12px',
          border: `2px solid rgba(255,215,0,0.45)`, borderRadius: 8 }, symbol.slice(0, 10)),
      ),
      h('div', { display: 'flex', fontSize: 26, color: MUTED },
        stats ? `${chainName(stats.chain_id)} · scanned ${Number(stats.scan_count).toLocaleString('en-US')} time${Number(stats.scan_count) === 1 ? '' : 's'}` : 'Not scanned on FatDev yet'),
    ),
  )

  const left = h('div', { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 34, flex: 1 },
    tokenRow,
    t
      ? h('div', { display: 'flex', flexDirection: 'column', gap: 8 },
          h('div', { display: 'flex', fontSize: 64, fontWeight: 700, color: t.color, lineHeight: 1 }, stats.last_verdict || t.label),
          h('div', { display: 'flex', fontSize: 26, color: MUTED }, 'Honeypot · Tax · Liquidity · Ownership · Holders'))
      : h('div', { display: 'flex', flexDirection: 'column', gap: 8 },
          h('div', { display: 'flex', fontSize: 64, fontWeight: 700, color: GOLD, lineHeight: 1 }, 'Is it safe?'),
          h('div', { display: 'flex', fontSize: 26, color: MUTED }, 'Honeypot, tax, liquidity and holder checks in seconds')),
  )

  const right = t
    ? h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 },
        h('div', { display: 'flex', position: 'relative', width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
          img(scoreRing(stats.last_score, t.color), { position: 'absolute', top: 0, left: 0, width: 260, height: 260 }),
          h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center' },
            h('div', { display: 'flex', fontSize: 96, fontWeight: 700, color: t.color, lineHeight: 1 }, String(stats.last_score)),
            h('div', { display: 'flex', fontFamily: 'Mono', fontSize: 22, color: MUTED }, '/ 100')),
        ),
        h('div', { display: 'flex', fontFamily: 'Mono', fontSize: 24, letterSpacing: 4, color: t.color, padding: '6px 22px',
          border: `2px solid ${t.color}`, borderRadius: 30 }, t.label),
      )
    : h('div', { display: 'flex', width: 260, height: 260, borderRadius: 130, border: `18px solid rgba(255,215,0,0.35)`,
        alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700, color: GOLD, textAlign: 'center' }, 'SCAN\nFREE')

  const footer = h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
      paddingTop: 22, borderTop: '2px solid rgba(255,215,0,0.18)' },
    h('div', { display: 'flex', fontSize: 26, color: CREAM }, stats ? 'Tap to run a fresh scan — free, no wallet' : 'Tap to scan it free — no wallet needed'),
    h('div', { display: 'flex', alignItems: 'center', gap: 16 },
      h('div', { display: 'flex', fontSize: 28, fontWeight: 700, color: GOLD }, 'fatdev.org'),
      h('div', { display: 'flex', fontSize: 20, color: MUTED }, 'Powered by $BLIN')),
  )

  return h('div', {
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 1200, height: 630,
      padding: '44px 56px 38px', fontFamily: 'Grotesk', color: CREAM,
      background: `radial-gradient(circle at 85% 20%, ${t ? t.color + '33' : 'rgba(255,215,0,0.18)'} 0%, transparent 55%), linear-gradient(135deg, #1F0B02 0%, ${BG} 60%)`,
    },
    header,
    h('div', { display: 'flex', alignItems: 'center', gap: 40, width: '100%' }, left, right),
    footer,
  )
}

export async function renderPng(origin, address, chain) {
  const [a, stats] = await Promise.all([loadAssets(origin), fetchTokenStats(address, chain)])
  const logo = await fetchLogo(stats?.logo_url)
  const svg = await satori(card({ stats, address, logo, brand: a.logo }), { width: 1200, height: 630, fonts: a.fonts })
  return { png: new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng(), stats }
}

export default async (req) => {
  const url = new URL(req.url)
  const address = cleanAddress(String(url.searchParams.get('address') || '').replace(/\.png$/i, ''))
  const chain = parseChain(url.searchParams.get('chain'))
  if (!address) return new Response('Bad address', { status: 400 })

  try {
    const { png } = await renderPng(url.origin, address, chain)
    return new Response(png, {
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=600',
        'netlify-cdn-cache-control': 'public, s-maxage=900, stale-while-revalidate=3600',
      },
    })
  } catch (e) {
    console.error('og-token render failed', e)
    // Never hand a crawler a broken image: fall back to the site card.
    return Response.redirect(new URL('/logo-full.png', url.origin).toString(), 302)
  }
}
