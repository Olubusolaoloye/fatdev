/**
 * ChainIcon.tsx — a consistent mark for every supported network.
 *
 * Each chain renders its own logo geometry as inline SVG on a brand-coloured
 * disc. Inline rather than image assets so there is nothing to host, nothing to
 * 404, no layout shift, and the marks stay crisp at any size.
 *
 * Chains whose mark is too intricate to read at 16px, or that have no
 * established logo yet, fall back to a monogram on the same coloured disc — so
 * a row of icons still scans as one set.
 */
import { SUPPORTED_CHAINS } from '../../lib/wagmi'

/** Official brand colours — the disc behind each mark. */
export const CHAIN_COLOR: Record<number, string> = {
  1:     '#627EEA', // Ethereum
  56:    '#F0B90B', // BNB Chain
  97:    '#F0B90B', // BSC Testnet
  42161: '#213147', // Arbitrum (dark navy; mark carries the blue)
  8453:  '#0052FF', // Base
  137:   '#8247E5', // Polygon
  10:    '#FF0420', // Optimism
  43114: '#E84142', // Avalanche
  59144: '#121212', // Linea (mark carries the lime)
  999:   '#072723', // HyperEVM (mark carries the mint)
  146:   '#FE9A4C', // Sonic
  5000:  '#000000', // Mantle
  1329:  '#9C1C1C', // Sei
  100:   '#04795B', // Gnosis
  25:    '#002D74', // Cronos
  4663:  '#CCFF00', // Robinhood
  143:   '#836EF9', // Monad
  369:   '#00C3FF', // PulseChain
  9745:  '#00D18C', // Plasma
  988:   '#26A17B', // Stable
  15551: '#00B8D9', // LOOP
  501:   '#14103C', // Solana (mark carries the gradient)
  784:   '#4DA2FF', // Sui
}

/** Ink colour for marks drawn on top of the disc. */
function inkFor(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#0A1119' : '#FFFFFF'
}

/**
 * Logo geometry per chain, drawn inside a 24×24 viewBox on top of the disc.
 * `ink` is the contrast colour for that chain's disc.
 */
const GLYPH: Record<number, (ink: string) => React.ReactNode> = {
  // Ethereum — the two stacked tetrahedra
  1: ink => (
    <g fill={ink}>
      <path d="M12 3.2 7.3 11.4 12 14.2l4.7-2.8L12 3.2Z" fillOpacity="0.62" />
      <path d="M12 3.2v11L16.7 11.4 12 3.2Z" />
      <path d="M12 15.2 7.3 12.4 12 20.8l4.7-8.4L12 15.2Z" fillOpacity="0.62" />
      <path d="M12 15.2v5.6l4.7-8.4L12 15.2Z" />
    </g>
  ),

  // BNB Chain — centre diamond with four satellites
  56: ink => (
    <g fill={ink}>
      <path d="m12 4.6 2.3 2.3L12 9.2 9.7 6.9 12 4.6Z" />
      <path d="m7.4 9.2 2.3 2.3-2.3 2.3-2.3-2.3 2.3-2.3Z" />
      <path d="m16.6 9.2 2.3 2.3-2.3 2.3-2.3-2.3 2.3-2.3Z" />
      <path d="m12 13.8 2.3 2.3L12 18.4l-2.3-2.3 2.3-2.3Z" />
      <path d="m12 9.2 2.3 2.3L12 13.8l-2.3-2.3L12 9.2Z" />
    </g>
  ),

  // Arbitrum — hexagon with the twin chevrons
  42161: () => (
    <g>
      <path d="M12 3.4 19.4 7.7v8.6L12 20.6 4.6 16.3V7.7L12 3.4Z"
        fill="none" stroke="#12AAFF" strokeWidth="1.3" />
      <path d="m10.4 16.4 1.6-4.5 1.7 4.5" fill="none" stroke="#12AAFF"
        strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m14.6 9.1 2.4 6.6" fill="none" stroke="#9DCCED"
        strokeWidth="1.3" strokeLinecap="round" />
    </g>
  ),

  // Base — circle with the signature flat left edge
  8453: ink => (
    <path d="M12 4.4a7.6 7.6 0 1 1 0 15.2 7.6 7.6 0 0 1-7.55-6.8h7.3v-1.6h-7.3A7.6 7.6 0 0 1 12 4.4Z"
      fill={ink} />
  ),

  // Polygon — the interlocking double-chevron mark
  137: ink => (
    <path
      d="M15.8 9.35a.9.9 0 0 0-.9 0l-2.1 1.22-1.43.8-2.07 1.22a.9.9 0 0 1-.9 0l-1.64-.96a.9.9 0 0 1-.45-.78V8.98a.86.86 0 0 1 .45-.78l1.62-.93a.9.9 0 0 1 .9 0l1.62.93c.28.16.45.46.45.78v1.22l1.43-.84V8.14a.86.86 0 0 0-.45-.78l-3.02-1.76a.9.9 0 0 0-.9 0L5.4 7.36a.86.86 0 0 0-.45.78v3.55c0 .32.17.62.45.78l3.05 1.76a.9.9 0 0 0 .9 0l2.07-1.19 1.43-.83 2.07-1.19a.9.9 0 0 1 .9 0l1.62.93c.28.16.45.46.45.78v1.87a.86.86 0 0 1-.45.78l-1.6.96a.9.9 0 0 1-.9 0l-1.63-.93a.9.9 0 0 1-.45-.78v-1.2l-1.43.84v1.22c0 .32.17.62.45.78l3.05 1.76a.9.9 0 0 0 .9 0l3.05-1.76a.9.9 0 0 0 .45-.78v-3.58a.86.86 0 0 0-.45-.78L15.8 9.35Z"
      fill={ink} />
  ),

  // Optimism — the OP roundels
  10: ink => (
    <g fill="none" stroke={ink} strokeWidth="1.7">
      <ellipse cx="8.9" cy="12" rx="2.7" ry="3.1" />
      <path d="M13.9 15.1V8.9h2.4a1.9 1.9 0 0 1 0 3.8h-2.4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),

  // Avalanche — the peak mark
  43114: ink => (
    <g fill={ink}>
      <path d="M13.6 7.6c.5-.85 1.3-.85 1.8 0l3.5 6.2c.5.85.1 1.55-.88 1.55h-7.05c-.97 0-1.37-.7-.88-1.55l3.5-6.2Z" />
      <path d="M9.05 10.9c.48-.86 1.26-.86 1.74 0l.72 1.3c.38.7.38 1.53 0 2.23l-.5.9c-.4.72-1.1 1.17-1.87 1.17H6.6c-.97 0-1.37-.7-.88-1.55l3.33-4.05Z" fillOpacity="0.75" />
    </g>
  ),

  // Gnosis — the concentric owl-eye mark
  100: ink => (
    <g fill="none" stroke={ink} strokeWidth="1.5">
      <circle cx="9.3" cy="10.4" r="2.5" />
      <circle cx="14.7" cy="10.4" r="2.5" />
      <path d="M5.6 14.6c1.4 2.6 3.7 4 6.4 4s5-1.4 6.4-4" strokeLinecap="round" />
    </g>
  ),

  // Cronos — hexagon with the inner uprights
  25: ink => (
    <g fill="none" stroke={ink} strokeWidth="1.35" strokeLinejoin="round">
      <path d="M12 3.6 19 7.6v8L12 19.6 5 15.6v-8l7-4Z" />
      <path d="M12 7.7 15.6 9.8v4.2L12 16.1 8.4 14V9.8L12 7.7Z" />
      <path d="M12 3.6v4.1M12 16.1v3.5" />
    </g>
  ),

  // PulseChain — the pulse trace
  369: ink => (
    <path d="M4.4 12.6h3.1l1.9-4.3 2.8 8.6 2.2-5.6 1.3 2.4h3.9"
      fill="none" stroke={ink} strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" />
  ),

  // Linea — the lime bar-and-node mark
  59144: () => (
    <g fill="#61DFFF">
      <rect x="6.3" y="5.6" width="4.4" height="4.4" rx="0.7" />
      <path d="M6.3 11.4h1.9v5.1h9.5v1.9H6.3v-7Z" />
    </g>
  ),

  // Mantle — ring with the notch
  5000: () => (
    <g fill="none" stroke="#FFFFFF" strokeWidth="1.6">
      <circle cx="12" cy="12" r="6.2" />
      <path d="M12 5.8v3.4M12 14.8v3.4M5.8 12h3.4M14.8 12h3.4" strokeLinecap="round" />
    </g>
  ),

  // HyperEVM — the mint hexagon
  999: () => (
    <path d="M12 4.2 18.8 8v8L12 19.8 5.2 16V8L12 4.2Z"
      fill="none" stroke="#97FCE4" strokeWidth="1.6" strokeLinejoin="round" />
  ),

  // Solana — the three slanted bars
  501: () => (
    <g>
      <defs>
        <linearGradient id="solg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9945FF" /><stop offset="100%" stopColor="#14F195" />
        </linearGradient>
      </defs>
      <g fill="url(#solg)">
        <path d="M7.4 8.1a.6.6 0 0 1 .43-.18h9.4c.27 0 .4.32.21.5l-1.84 1.77a.6.6 0 0 1-.43.18H5.77c-.27 0-.4-.32-.21-.5L7.4 8.1Z" />
        <path d="M7.4 14.1a.6.6 0 0 1 .43-.18h9.4c.27 0 .4.33.21.51l-1.84 1.77a.6.6 0 0 1-.43.18H5.77c-.27 0-.4-.32-.21-.5l1.84-1.78Z" />
        <path d="M15.4 11.1a.6.6 0 0 0-.43-.18h-9.4c-.27 0-.4.33-.21.51l1.84 1.77a.6.6 0 0 0 .43.18h9.4c.27 0 .4-.32.21-.5L15.4 11.1Z" />
      </g>
    </g>
  ),

  // Sui — the water drop
  784: ink => (
    <path d="M12 3.4c3.1 3.9 5.6 6.9 5.6 9.8a5.6 5.6 0 1 1-11.2 0c0-2.9 2.5-5.9 5.6-9.8Zm0 3.6c-1.9 2.4-3.4 4.3-3.4 6.2a3.4 3.4 0 1 0 6.8 0c0-1.9-1.5-3.8-3.4-6.2Z"
      fill={ink} />
  ),

  // Sonic — the speed chevrons
  146: ink => (
    <g fill="none" stroke={ink} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9.2 6.6 5.6 5.4-5.6 5.4" />
      <path d="M5.6 9.2 8.4 12l-2.8 2.8" strokeOpacity="0.6" />
    </g>
  ),
}

type Props = {
  chainId: number
  size?: number
  /** Render the chain's name alongside the mark */
  withLabel?: boolean
  /** Use the short ticker instead of the full name when labelled */
  short?: boolean
  style?: React.CSSProperties
}

export default function ChainIcon({ chainId, size = 18, withLabel, short, style }: Props) {
  const meta  = SUPPORTED_CHAINS.find(c => c.id === chainId)
  const color = CHAIN_COLOR[chainId] ?? '#5A6B8C'
  const ink   = inkFor(color)
  const label = short ? (meta?.short ?? String(chainId)) : (meta?.label ?? `Chain ${chainId}`)
  const glyph = GLYPH[chainId]

  const badge = (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      role={withLabel ? undefined : 'img'}
      aria-hidden={withLabel ? true : undefined}
      aria-label={withLabel ? undefined : label}
      style={{ flexShrink: 0, display: 'block' }}
    >
      {!withLabel && <title>{label}</title>}
      <circle cx="12" cy="12" r="12" fill={color} />
      {glyph
        ? glyph(ink)
        : (
          // No established mark for this chain yet — monogram on the same disc
          <text
            x="12" y="12" textAnchor="middle" dominantBaseline="central"
            fill={ink} fontSize="11" fontWeight="800"
            fontFamily="'Space Grotesk', system-ui, sans-serif"
          >
            {meta?.short?.slice(0, 2) ?? '?'}
          </text>
        )}
    </svg>
  )

  if (!withLabel) return <span style={style}>{badge}</span>

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...style }}>
      {badge}
      <span>{label}</span>
    </span>
  )
}
