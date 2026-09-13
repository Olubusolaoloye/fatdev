/**
 * analytics.ts — Cloudflare Web Analytics.
 *
 * Cookieless and privacy-first, so it needs no consent banner. Works on any
 * host (the site is on Netlify) via the beacon script. The beacon follows
 * pushState navigation on its own, so client-side route changes count as page
 * views without extra wiring.
 *
 * Off until VITE_CF_BEACON_TOKEN is set, so local dev never pollutes the stats.
 */
const TOKEN = import.meta.env.VITE_CF_BEACON_TOKEN ?? ''

export function initAnalytics() {
  if (!TOKEN || import.meta.env.DEV) return
  if (document.querySelector('script[data-cf-beacon]')) return
  const s = document.createElement('script')
  s.defer = true
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js'
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN, spa: true }))
  document.head.appendChild(s)
}
