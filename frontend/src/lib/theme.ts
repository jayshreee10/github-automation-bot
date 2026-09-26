import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'theme'
const listeners = new Set<() => void>()

// Storage can throw (private mode, blocked site data); the theme then just isn't remembered.
function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'light' ? v : null
  } catch {
    return null
  }
}

function current(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

// Saved choice first, else the OS preference. Called once before React renders to avoid a flash.
export function applyInitialTheme(): void {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  document.documentElement.classList.toggle('dark', (stored() ?? (prefersDark ? 'dark' : 'light')) === 'dark')
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Not remembered; the toggle still works for this page load.
  }
  listeners.forEach((l) => l())
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    current,
  )
  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme])
  return { theme, toggle }
}
