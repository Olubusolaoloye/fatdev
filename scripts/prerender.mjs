/**
 * prerender.mjs — writes a static HTML file per route after `vite build`.
 *
 * Why this exists
 * ---------------
 * The app is a client-rendered SPA behind a catch-all redirect, so every URL
 * returned the same index.html. Two consequences:
 *
 *   - Every route shared one title and description. Google collapses
 *     near-duplicates, so /pricing and /tools/security-scanner were competing
 *     as copies of the homepage instead of ranking for their own queries.
 *
 *   - Social crawlers (X, Telegram, Discord, LinkedIn, Slack) do not execute
 *     JavaScript at all. They read the raw HTML, so every shared link showed
 *     the same generic card — when it showed one, since og:image was a
 *     relative path and those crawlers require absolute URLs.
 *
 * This does not server-render React. It takes the built index.html and, per
 * route, rewrites the head and injects a <noscript> summary. That is enough for
 * correct SERP snippets, correct social cards, and a crawlable text and link
 * skeleton, without adding a headless browser to the build.
 *
 * Netlify serves a matching static file before consulting _redirects, so
 * /pricing/index.html wins over the SPA fallback while client-side routing
 * still works for in-app navigation.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const SITE_URL = (process.env.VITE_APP_URL ?? 'https://fatdev.org').replace(/\/$/, '')

if (!existsSync(join(dist, 'index.html'))) {
  console.error('prerender: dist/index.html not found — run `vite build` first.')
  process.exit(1)
}

// The route table lives in TypeScript for the app's benefit. Rather than add a
// build step to import it, it is parsed out of the source so there is still
// exactly one place to edit routes.
const seoSrc = readFileSync(join(root, 'src/lib/seo.ts'), 'utf8')

function parseRoutes(src) {
  const block = src.slice(src.indexOf('export const ROUTES'), src.indexOf('export const ROUTE_BY_PATH'))
  const routes = []
  for (const chunk of block.split(/\n\s*\{\s*\n?/).slice(1)) {
    const path = /path:\s*'([^']+)'/.exec(chunk)?.[1]
    if (!path) continue
    const title = /title:\s*'((?:[^'\\]|\\.)*)'/.exec(chunk)?.[1]
    // Descriptions are written as concatenated string literals for line length.
    const descBlock = /description:\s*([\s\S]*?),\n\s*(?:priority|noindex|image|\})/.exec(chunk)?.[1] ?? ''
    const description = [...descBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]).join('')
    routes.push({
      path,
      title: unescape_(title ?? ''),
      description: unescape_(description),
      noindex: /noindex:\s*true/.test(chunk),
      priority: Number(/priority:\s*([\d.]+)/.exec(chunk)?.[1] ?? 0.5),
    })
  }
  return routes
}

const unescape_ = s => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\')

function parseFaq(src) {
  const block = src.slice(src.indexOf('export const FAQ'))
  return [...block.matchAll(/q:\s*'((?:[^'\\]|\\.)*)',\s*\n\s*a:\s*([\s\S]*?),\n\s*\}/g)].map(m => ({
    q: unescape_(m[1]),
    a: unescape_([...m[2].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1]).join('')),
  }))
}

const routes = parseRoutes(seoSrc)
const faq = parseFaq(seoSrc)
const indexed = routes.filter(r => !r.noindex)

if (!routes.length) {
  console.error('prerender: parsed 0 routes from src/lib/seo.ts — refusing to emit a broken build.')
  process.exit(1)
}

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const template = readFileSync(join(dist, 'index.html'), 'utf8')

// ── Structured data, emitted once on the homepage ────────────────────────────
const jsonLd = [
  {
    '@context': 'https://schema.org', '@type': 'Organization',
    name: 'FatDev', url: SITE_URL, logo: `${SITE_URL}/logo.png`,
    description: 'No-code platform for deploying, auditing and launching ERC-20 and BEP-20 tokens across 9 chains.',
  },
  {
    '@context': 'https://schema.org', '@type': 'WebApplication',
    name: 'FatDev', url: SITE_URL,
    applicationCategory: 'FinanceApplication', operatingSystem: 'Any modern browser',
    offers: [
      { '@type': 'Offer', name: 'Token Creator', price: '30', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Security Scan', price: '0', priceCurrency: 'USD' },
    ],
  },
  {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  },
]

function headFor(route) {
  const url = `${SITE_URL}${route.path === '/' ? '' : route.path}`
  const image = `${SITE_URL}/logo-full.png`
  const robots = route.noindex ? 'noindex, follow' : 'index, follow'

  const tags = [
    `<title>${esc(route.title)}</title>`,
    `<meta name="description" content="${esc(route.description)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="FatDev" />`,
    `<meta property="og:title" content="${esc(route.title)}" />`,
    `<meta property="og:description" content="${esc(route.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    // summary_large_image is what turns a shared link into a full-width card
    // on X rather than a thumbnail beside text.
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(route.title)}" />`,
    `<meta name="twitter:description" content="${esc(route.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
  ]
  if (route.path === '/') {
    tags.push(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`)
  }
  return tags.join('\n    ')
}

/**
 * A crawlable text and link skeleton, wrapped in <noscript>.
 *
 * <noscript> is deliberate rather than a hidden div. Serving text to crawlers
 * that a user never sees is cloaking, and Google penalises it. <noscript> is
 * the honest form of the same idea: it is genuinely the no-JavaScript
 * experience, browsers with JS never render it, and crawlers that do not
 * execute scripts still get real text and real internal links.
 */
function noscriptFor(route) {
  const links = indexed
    .filter(r => r.path !== route.path)
    .map(r => `<li><a href="${r.path}">${esc(r.title.split('—')[0].split('|')[0].trim())}</a></li>`)
    .join('')
  const faqHtml = route.path === '/'
    ? `<h2>Frequently asked questions</h2>` +
      faq.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')
    : ''
  return `<noscript>`
    + `<h1>${esc(route.title.split('—')[0].split('|')[0].trim())}</h1>`
    + `<p>${esc(route.description)}</p>`
    + faqHtml
    + `<nav><h2>Explore FatDev</h2><ul>${links}</ul></nav>`
    + `</noscript>`
}

let written = 0
for (const route of routes) {
  let html = template

  // Replace the head's existing title/description/og block wholesale.
  html = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, '')
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
    .replace('</head>', `  ${headFor(route)}\n  </head>`)

  html = html.replace(
    '<div id="root"></div>',
    `${noscriptFor(route)}
    <div id="root"></div>`,
  )

  const outDir = route.path === '/' ? dist : join(dist, route.path)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), html)
  written++
}

// ── sitemap.xml ──────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10)
const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9'
const NL = '\n'
const urls = indexed.map(r => [
  '  <url>',
  `    <loc>${SITE_URL}${r.path === '/' ? '/' : r.path}</loc>`,
  `    <lastmod>${today}</lastmod>`,
  `    <priority>${r.priority.toFixed(1)}</priority>`,
  '  </url>',
].join(NL)).join(NL)

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  `<urlset xmlns="${SITEMAP_NS}">`,
  urls,
  '</urlset>',
  '',
].join(NL)
writeFileSync(join(dist, 'sitemap.xml'), sitemap)

console.log(`prerender: ${written} routes, ${indexed.length} in sitemap.xml`)
