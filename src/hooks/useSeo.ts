/**
 * useSeo — keeps <head> in step with the current route.
 *
 * The prerender step bakes correct metadata into the static HTML for each
 * route, which is what crawlers read. This hook covers the other half: once
 * React takes over, navigating client-side changes the URL without reloading,
 * so the title and canonical would otherwise still describe the entry page.
 *
 * That matters beyond crawlers — the tab title and the URL a user copies from
 * the address bar should agree with what they are looking at.
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ROUTE_BY_PATH, absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, type RouteSeo } from '../lib/seo'

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/** Longest matching prefix, so /migrate/anything still resolves to a parent. */
function resolveRoute(pathname: string): RouteSeo | null {
  const clean = pathname.replace(/\/+$/, '') || '/'
  if (ROUTE_BY_PATH[clean]) return ROUTE_BY_PATH[clean]
  const parents = Object.keys(ROUTE_BY_PATH)
    .filter(p => p !== '/' && clean.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)
  return parents.length ? ROUTE_BY_PATH[parents[0]] : null
}

export function useSeo() {
  const { pathname } = useLocation()

  useEffect(() => {
    const route = resolveRoute(pathname)
    const clean = pathname.replace(/\/+$/, '') || '/'

    const title = route?.title ?? `${SITE_NAME} — Your Genesis Stack`
    const description = route?.description ?? ''
    const image = absoluteUrl(route?.image ?? DEFAULT_OG_IMAGE)
    const url = absoluteUrl(clean)

    document.title = title
    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description)
      setMeta('meta[property="og:description"]', 'property', 'og:description', description)
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)
    }
    setMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title)
    setMeta('meta[property="og:url"]', 'property', 'og:url', url)
    setMeta('meta[property="og:image"]', 'property', 'og:image', image)
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image)
    setLink('canonical', url)

    // Unknown or app-only routes must not be indexed. An SPA answers 200 for
    // every path, so without this a mistyped URL becomes a soft 404 that Google
    // treats as a thin duplicate of the homepage.
    const robots = !route || route.noindex ? 'noindex, follow' : 'index, follow'
    setMeta('meta[name="robots"]', 'name', 'robots', robots)
  }, [pathname])
}
