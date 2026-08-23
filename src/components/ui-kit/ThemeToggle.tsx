import { useTheme, type ThemeChoice } from '../../hooks/useTheme'
import Icon, { type IconName } from './Icon'

const NEXT_LABEL: Record<ThemeChoice, string> = {
  light:  'Light theme — switch to dark',
  dark:   'Dark theme — switch to system',
  system: 'Following system — switch to light',
}

const ICON: Record<ThemeChoice, IconName> = {
  light:  'zap',
  dark:   'droplet',
  system: 'settings',
}

/**
 * Three-state theme control: light → dark → system.
 *
 * System is a real state rather than an implicit default, so a user who wants
 * the app to track their OS can say so after having picked manually.
 */
export default function ThemeToggle({ size = 34 }: { size?: number }) {
  const { choice, cycle, resolved } = useTheme()

  return (
    <button
      onClick={cycle}
      title={NEXT_LABEL[choice]}
      aria-label={NEXT_LABEL[choice]}
      style={{
        width: size, height: size, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: '1px solid var(--fd-border)',
        borderRadius: 'var(--fd-radius-sm)',
        color: 'var(--fd-ghost)',
        cursor: 'pointer',
        transition: 'color 180ms ease, border-color 180ms ease, background 180ms ease',
        position: 'relative',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.color = 'var(--fd-accent)'
        el.style.borderColor = 'var(--fd-border-accent)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.color = 'var(--fd-ghost)'
        el.style.borderColor = 'var(--fd-border)'
      }}
    >
      <Icon name={ICON[choice]} size={Math.round(size * 0.5)} />
      {choice === 'system' && (
        <span
          aria-hidden
          title=""
          style={{
            position: 'absolute', bottom: 3, right: 3,
            width: 5, height: 5, borderRadius: '50%',
            background: resolved === 'dark' ? 'var(--fd-accent)' : 'var(--fd-green)',
          }}
        />
      )}
    </button>
  )
}
