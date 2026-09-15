/**
 * token-page — serves /token/{address} and /tools/security-scanner/{address}.
 *
 * Returns the normal scanner page (so people get the app and the scan runs in
 * their browser) with the <head> rewritten for that token, so a link pasted
 * into X, Telegram or Discord unfurls into a card with its name, score and a
 * generated preview image.
 *
 * Wired in public/_redirects:  /token/*  → /.netlify/functions/token-page?address=:splat
 */
import {
  SITE_URL, cleanAddress, shortAddr, fetchTokenStats, tierFor, TIER, parseChain, chainName, esc,
} from '../lib/token.mjs'

let shell = null   // the built scanner page, cached per warm instance

async function loadShell(origin) {
  if (shell) return shell
  // The prerendered scanner page carries the right script and style tags for
  // this deploy; the homepage is the fallback if prerendering was skipped.
  for (const path of ['/tools/security-scanner/index.html', '/index.html']) {
    try {
      const res = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(3000) })
      if (res.ok) { shell = await res.text(); return shell }
    } catch { /* try the next */ }
  }
  return null
}

/** Replace a tag's content attribute, or add the tag before </head>. */
function setMeta(html, attr, name, value) {
  const re = new RegExp(`<meta\\s+${attr}="${name}"\\s+content="[^"]*"\\s*/?>`, 'i')
  const tag = `<meta ${attr}="${name}" content="${esc(value)}" />`
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`)
}

export default async (req) => {
  const url = new URL(req.url)
  const address = cleanAddress(url.searchParams.get('address'))
  const chain = parseChain(url.searchParams.get('chain'))

  const html = await loadShell(url.origin)
  if (!html) return new Response('Not found', { status: 404 })
  // Anything that is not a token address still gets the app, unmodified.
  if (!address) {
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  }

  const stats = await fetchTokenStats(address, chain)
  const pageUrl = `${SITE_URL}/token/${address}${chain ? `?chain=${chain}` : ''}`
  const image = `${SITE_URL}/og/token/${encodeURIComponent(address)}.png${chain ? `?chain=${chain}` : ''}`

  let title, description
  if (stats) {
    const who = stats.symbol ? `$${stats.symbol}` : (stats.name || shortAddr(address))
    const tier = tierFor(stats.last_score, stats.last_verdict)
    title = stats.last_score != null
      ? `${who} scores ${stats.last_score}/100 (${TIER[tier].label}) · FatDev Scanner`
      : `${who} security scan · FatDev Scanner`
    description =
      `${stats.name || who} on ${chainName(stats.chain_id)}` +
      (stats.last_verdict ? ` — ${stats.last_verdict.toLowerCase()}.` : '.') +
      ' Honeypot, tax, liquidity, ownership and holder checks. Run a fresh scan free, no wallet needed.'
  } else {
    title = `Is ${shortAddr(address)} safe? · FatDev Scanner`
    description =
      'Free token security scan: honeypot simulation, buy and sell tax, liquidity lock, ownership, ' +
      'mint risk and holder concentration — a 0–100 trust score in seconds. No wallet needed.'
  }

  let out = html
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
  out = setMeta(out, 'name', 'description', description)
  out = setMeta(out, 'property', 'og:title', title)
  out = setMeta(out, 'property', 'og:description', description)
  out = setMeta(out, 'property', 'og:url', pageUrl)
  out = setMeta(out, 'property', 'og:image', image)
  out = setMeta(out, 'property', 'og:image:width', '1200')
  out = setMeta(out, 'property', 'og:image:height', '630')
  out = setMeta(out, 'name', 'twitter:card', 'summary_large_image')
  out = setMeta(out, 'name', 'twitter:title', title)
  out = setMeta(out, 'name', 'twitter:description', description)
  out = setMeta(out, 'name', 'twitter:image', image)
  // One canonical per token, so the two URL shapes do not compete in search.
  out = out.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${esc(pageUrl)}" />`)

  return new Response(out, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
      // Edge-cached briefly: scores change as people rescan.
      'netlify-cdn-cache-control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
