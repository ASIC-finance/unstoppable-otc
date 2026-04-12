import { useCallback, useEffect, useRef, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'theme-preference'

function getStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return preference
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(getStoredPreference)
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(preference))
  const isInitialMount = useRef(true)

  const setPreference = useCallback((pref: ThemePreference) => {
    localStorage.setItem(STORAGE_KEY, pref)
    setPreferenceState(pref)
    setResolved(resolve(pref))
  }, [])

  // Sync .dark class on <html>
  useEffect(() => {
    const root = document.documentElement

    // Animate theme switch (skip on first mount to avoid flash)
    if (!isInitialMount.current) {
      root.classList.add('theme-transition')
      const timer = setTimeout(() => root.classList.remove('theme-transition'), 300)
      return () => clearTimeout(timer)
    }
    isInitialMount.current = false
  }, [resolved])

  useEffect(() => {
    const root = document.documentElement
    if (resolved === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [resolved])

  // Listen for OS preference changes when in system mode
  useEffect(() => {
    if (preference !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setResolved(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [preference])

  return { preference, resolved, setPreference }
}
