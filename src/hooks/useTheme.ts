import { useEffect, useState } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'

const KEY = 'fatdev-theme'

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch { return 'system' }
}

/**
 * Applies the choice to <html>.
 *
 * 'system' removes the attribute entirely rather than resolving it here — the
 * CSS already follows prefers-color-scheme via a media query, so leaving it
 * unset means the OS keeps control and a user who changes their system theme
 * sees it update live without a reload.
 */
function apply(choice: ThemeChoice) {
  const el = document.documentElement
  if (choice === 'system') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', choice)
}

/** Set the theme before React mounts, so there is no flash of the wrong palette. */
export function initTheme() {
  apply(read())
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read)

  useEffect(() => {
    apply(choice)
    try {
      if (choice === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, choice)
    } catch { /* storage unavailable */ }
  }, [choice])

  /** What is actually on screen right now, with 'system' resolved. */
  const resolved: 'light' | 'dark' =
    choice !== 'system'
      ? choice
      : (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark' : 'light')

  /** Cycle light → dark → system. */
  function cycle() {
    setChoice(c => (c === 'light' ? 'dark' : c === 'dark' ? 'system' : 'light'))
  }

  return { choice, setChoice, resolved, cycle }
}
