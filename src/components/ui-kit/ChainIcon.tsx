/**
 * ChainIcon.tsx — a consistent mark for every supported network.
 *
 * Several of the newer chains (Robinhood, Monad, Plasma, Stable, LOOP, HyperEVM,
 * Sonic) have no icon in RainbowKit's bundled set, so they rendered as blank
 * circles or bare text while the majors showed logos — visually inconsistent and
 * hard to scan.
 *
 * Rather than ship 20 third-party brand logos (heavy, and trademark-sensitive to
 * redistribute), every chain gets the same treatment: its real brand colour with
 * a monogram. Dependency-free, always renders, and reads consistently in a row.
 */
import { SUPPORTED_CHAINS } from '../../lib/wagmi'

/** Official brand colours. */
export const CHAIN_COLOR: Record<number, string> = {
  1:     '#627EEA', // Ethereum
  56:    '#F0B90B', // BNB Chain
  97:    '#F0B90B', // BSC Testnet
  42161: '#28A0F0', // Arbitrum
  8453:  '#0052FF', // Base
  137:   '#8247E5', // Polygon
  10:    '#FF0420', // Optimism
  43114: '#E84142', // Avalanche
  59144: '#61DFFF', // Linea
  999:   '#97FCE4', // HyperEVM
  146:   '#FE9A4C', // Sonic
  5000:  '#65B3AE', // Mantle
  1329:  '#9C1C1C', // Sei
  100:   '#04795B', // Gnosis
  25:    '#002D74', // Cronos
  4663:  '#CCFF00', // Robinhood
  143:   '#836EF9', // Monad
  369:   '#00C3FF', // PulseChain
  9745:  '#00D18C', // Plasma
  988:   '#26A17B', // Stable
  15551: '#00B8D9', // LOOP
}

/** Short monogram — 1–2 characters that read cleanly at 16px. */
const MONOGRAM: Record<number, string> = {
  1: 'Ξ', 56: 'B', 97: 't', 42161: 'A', 8453: 'B', 137: 'P', 10: 'O',
  43114: 'A', 59144: 'L', 999: 'H', 146: 'S', 5000: 'M', 1329: 'S',
  100: 'G', 25: 'C', 4663: 'R', 143: 'M', 369: 'P', 9745: 'X', 988: 'S',
  15551: 'L',
}

/** Readable text colour for a given background. */
function inkFor(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  // Perceived luminance — light chains (Linea, HyperEVM, Robinhood) need dark ink
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#0A1119' : '#FFFFFF'
}

type Props = {
  chainId: number
  size?: number
  /** Render the chain's name alongside the badge */
  withLabel?: boolean
  /** Use the short ticker instead of the full name when labelled */
  short?: boolean
  style?: React.CSSProperties
}

export default function ChainIcon({ chainId, size = 18, withLabel, short, style }: Props) {
  const meta  = SUPPORTED_CHAINS.find(c => c.id === chainId)
  const color = CHAIN_COLOR[chainId] ?? '#5A6B8C'
  const mark  = MONOGRAM[chainId] ?? (meta?.short?.[0] ?? '?')
  const label = short ? (meta?.short ?? String(chainId)) : (meta?.label ?? `Chain ${chainId}`)

  const badge = (
    <span
      aria-hidden={withLabel ? true : undefined}
      role={withLabel ? undefined : 'img'}
      aria-label={withLabel ? undefined : label}
      title={withLabel ? undefined : label}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: color, color: inkFor(color),
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.52, fontWeight: 800, lineHeight: 1,
        fontFamily: 'var(--fd-font-display)',
        boxShadow: `0 0 0 1px rgba(255,255,255,0.10) inset`,
        userSelect: 'none',
      }}
    >
      {mark}
    </span>
  )

  if (!withLabel) return <span style={style}>{badge}</span>

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...style }}>
      {badge}
      <span>{label}</span>
    </span>
  )
}
