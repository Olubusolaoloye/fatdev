/**
 * Icon.tsx — the app's single icon system.
 *
 * Emoji were previously used as UI icons, which is a known anti-pattern: they
 * render differently on every OS, cannot inherit colour or stroke weight, carry
 * no accessible name, and read as informal on a product that handles money.
 *
 * These are hand-drawn 24×24 stroke icons in the Lucide idiom — they inherit
 * `currentColor`, scale cleanly, and stay visually consistent everywhere.
 *
 * Usage:
 *   <Icon name="shield" />                       decorative (aria-hidden)
 *   <Icon name="shield" size={20} />             sized
 *   <Icon name="shield" title="Security scan" /> labelled for screen readers
 */

export type IconName =
  | 'scan' | 'shield' | 'megaphone' | 'chart' | 'send' | 'refresh' | 'bridge'
  | 'zap' | 'rocket' | 'coins' | 'lock' | 'settings' | 'wallet' | 'sliders'
  | 'file' | 'image' | 'check' | 'x' | 'alert' | 'info' | 'upload' | 'download'
  | 'copy' | 'vault' | 'flame' | 'recycle' | 'hexagon' | 'diamond' | 'users'
  | 'wrench' | 'construction' | 'search' | 'external' | 'arrowRight' | 'clock'
  | 'trending' | 'droplet' | 'eye' | 'plus' | 'trash' | 'link' | 'code'

type Props = {
  name: IconName
  size?: number
  /** Accessible name. Omit for decorative icons sitting next to a text label. */
  title?: string
  className?: string
  style?: React.CSSProperties
  strokeWidth?: number
}

// Each entry is the inner geometry of a 24×24 viewBox.
const PATHS: Record<IconName, React.ReactNode> = {
  scan: <>
    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
    <circle cx="11.5" cy="11.5" r="3.5" /><path d="m16 16 2.5 2.5" />
  </>,
  shield: <>
    <path d="M12 3 5 6v5.5c0 4 2.8 7.7 7 9.5 4.2-1.8 7-5.5 7-9.5V6l-7-3Z" />
    <path d="m9.2 12 2 2 3.6-3.8" />
  </>,
  megaphone: <>
    <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" />
    <path d="M16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </>,
  chart: <>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <rect x="7" y="12" width="3" height="5" rx=".5" />
    <rect x="12.5" y="8" width="3" height="9" rx=".5" />
    <rect x="18" y="5" width="3" height="12" rx=".5" />
  </>,
  send: <>
    <path d="M21.5 3.5 10.5 14.5" />
    <path d="M21.5 3.5 14.5 21.5l-4-7-7-4 18-7Z" />
  </>,
  refresh: <>
    <path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2" />
    <path d="M3 19v-5h5M21 5v5h-5" />
  </>,
  bridge: <>
    <path d="M3 8h18M4 8v11M20 8v11M12 8v11" />
    <path d="M4 14c2.7 0 4-2.7 4-6M20 14c-2.7 0-4-2.7-4-6" />
  </>,
  zap: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  rocket: <>
    <path d="M12 2c3.5 2.2 5.5 6 5.5 10L15 15H9l-2.5-3C6.5 8 8.5 4.2 12 2Z" />
    <circle cx="12" cy="9.5" r="1.8" />
    <path d="M9 15c-2 1-3 2.8-3 5 2.2 0 4-1 5-3M15 15c2 1 3 2.8 3 5-2.2 0-4-1-5-3" />
  </>,
  coins: <>
    <ellipse cx="9" cy="7" rx="6" ry="3" />
    <path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7" />
    <path d="M3 11v4c0 1.7 2.7 3 6 3 1 0 2-.1 2.8-.3" />
    <circle cx="16.5" cy="15.5" r="4.5" />
  </>,
  lock: <>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14.5v2.5" />
  </>,
  settings: <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
  </>,
  wallet: <>
    <path d="M3 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2" />
    <rect x="3" y="7" width="18" height="12" rx="2" />
    <circle cx="16.5" cy="13" r="1.3" />
  </>,
  sliders: <>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h9M17 18h3" />
    <circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="15" cy="18" r="2" />
  </>,
  file: <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </>,
  image: <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m3 17 5-4.5 4 3.5 3-2.5L21 19" />
  </>,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  alert: <>
    <path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4.5M12 17h.01" />
  </>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  upload: <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
  </>,
  download: <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M12 15V3M7.5 10.5 12 15l4.5-4.5" />
  </>,
  copy: <>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2" />
  </>,
  vault: <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="11" cy="12" r="4" /><path d="M11 9.5v5M8.5 12h5M18 8v8" />
  </>,
  flame: <>
    <path d="M12 22c3.9 0 6.5-2.6 6.5-6 0-4.5-4-6-5-11-2 2.5-3 4.5-3 6.5-1-.8-1.5-1.8-1.5-3C7 10 5.5 12.5 5.5 16c0 3.4 2.6 6 6.5 6Z" />
  </>,
  recycle: <>
    <path d="M8.5 4.5 12 2l3.5 2.5M12 2v7" />
    <path d="M20 13.5 21.5 17l-3.5 1.5M21.5 17l-6-3.5" />
    <path d="M4 13.5 2.5 17 6 18.5M2.5 17l6-3.5" />
  </>,
  hexagon: <path d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z" />,
  diamond: <path d="M12 2.5 21.5 12 12 21.5 2.5 12 12 2.5Z" />,
  users: <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 5.2a3.5 3.5 0 0 1 0 5.6M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
  </>,
  wrench: <>
    <path d="M15.5 3a5.5 5.5 0 0 0-5 7.7L3 18.2 5.8 21l7.5-7.5A5.5 5.5 0 0 0 20 4.3l-3 3-2.3-2.3 3-3A5.5 5.5 0 0 0 15.5 3Z" />
  </>,
  construction: <>
    <rect x="2.5" y="9" width="19" height="11" rx="2" />
    <path d="M7 9 3 15M13 9 6 20M19 9l-7 11M21.5 13.5 18 20" />
    <path d="M5 6h14" />
  </>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  external: <>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <path d="M15 3h6v6M21 3l-9 9" />
  </>,
  arrowRight: <path d="M4 12h15M13 6l6 6-6 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 2" /></>,
  trending: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  droplet: <path d="M12 2.5c3.5 4.2 6 7.4 6 10.3a6 6 0 0 1-12 0c0-2.9 2.5-6.1 6-10.3Z" />,
  eye: <><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7M10 11v6M14 11v6" />
  </>,
  link: <>
    <path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.3" />
    <path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />
  </>,
  code: <path d="m9 17-5-5 5-5M15 7l5 5-5 5" />,
}

export default function Icon({
  name, size = 18, title, className, style, strokeWidth = 1.75,
}: Props) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, display: 'block', ...style }}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  )
}
