import { useEffect, useMemo, useState } from 'react'
import { useAppConfig } from './useAppConfig'
import { fetchTopScanned, buildSpotlight, SCAN_RECORDED, type SpotlightToken } from '../lib/spotlight'

// One fetch shared by the hero list and the scanner carousel, refreshed at most
// once a minute — the ranking does not need to be live to the second.
const TTL = 60_000
let cache: { at: number; windowDays: number; rows: SpotlightToken[] } | null = null
let inflight: Promise<SpotlightToken[]> | null = null

function loadTop(windowDays: number): Promise<SpotlightToken[]> {
  if (cache && cache.windowDays === windowDays && Date.now() - cache.at < TTL) return Promise.resolve(cache.rows)
  if (inflight) return inflight
  inflight = fetchTopScanned(40, windowDays)
    .then(rows => { cache = { at: Date.now(), windowDays, rows }; return rows })
    .catch(() => cache?.rows ?? [])
    .finally(() => { inflight = null })
  return inflight
}

/** The merged spotlight: live pins first, then the most-scanned tokens. */
export function useSpotlight(): { tokens: SpotlightToken[]; loading: boolean } {
  const { spotlight, loading: cfgLoading } = useAppConfig()
  const [top, setTop] = useState<SpotlightToken[] | null>(cache?.rows ?? null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (cfgLoading || !spotlight.enabled) return
    let alive = true
    const load = () => loadTop(spotlight.windowDays).then(rows => { if (alive) setTop(rows) })
    const refresh = () => { cache = null; load() }
    load()
    window.addEventListener(SCAN_RECORDED, refresh)
    return () => { alive = false; window.removeEventListener(SCAN_RECORDED, refresh) }
  }, [cfgLoading, spotlight.enabled, spotlight.windowDays])

  // Pins expire on their own; re-evaluate while the page stays open.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  const tokens = useMemo(() => buildSpotlight(spotlight, top ?? [], now), [spotlight, top, now])
  return { tokens, loading: cfgLoading || (spotlight.enabled && top === null) }
}
