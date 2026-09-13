/** Tax distribution split — five shares that must always total 100. */
export type DistKey = 'mktPct' | 'lpPct' | 'teamPct' | 'buybackPct' | 'burnPct'
export const DIST_KEYS: DistKey[] = ['mktPct', 'lpPct', 'teamPct', 'buybackPct', 'burnPct']

/**
 * Move one share and rebalance the others so the split always totals 100.
 * The remainder is spread in proportion to the other shares (evenly when they
 * are all zero), with largest-remainder rounding so it never drifts off 100.
 */
export function rebalance(cur: Record<DistKey, number>, key: DistKey, raw: number): Record<DistKey, number> {
  const v = Math.max(0, Math.min(100, Math.round(raw)))
  const others = DIST_KEYS.filter(k => k !== key)
  const left = 100 - v
  const sum = others.reduce((a, k) => a + Math.max(0, cur[k]), 0)
  const exact = others.map(k => (sum > 0 ? (Math.max(0, cur[k]) / sum) * left : left / others.length))
  const floors = exact.map(Math.floor)
  let rest = left - floors.reduce((a, b) => a + b, 0)
  const order = exact.map((e, i) => [e - floors[i], i] as const).sort((a, b) => b[0] - a[0])
  for (const [, i] of order) { if (rest <= 0) break; floors[i]++; rest-- }
  const out = { ...cur, [key]: v }
  others.forEach((k, i) => { out[k] = floors[i] })
  return out
}
