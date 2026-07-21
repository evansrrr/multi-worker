import { useState, useEffect, useCallback } from 'react'

type AppearanceMode = 'light' | 'dark' | 'system'

function applyTheme(mode: AppearanceMode) {
  const root = document.documentElement

  if (mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export function useTheme() {
  const [appearance, setAppearance] = useState<AppearanceMode>('system')

  const loadAppearance = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/appearance')
      const data = await response.json()
      if (data.mode) {
        setAppearance(data.mode)
        applyTheme(data.mode)
      }
    } catch {
      applyTheme('system')
    }
  }, [])

  const updateAppearance = useCallback(async (mode: AppearanceMode) => {
    setAppearance(mode)
    applyTheme(mode)

    try {
      const response = await fetch('/api/settings/appearance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)
    } catch {
      // preference save failed, but local state is applied
    }
  }, [])

  useEffect(() => {
    loadAppearance()
  }, [loadAppearance])

  useEffect(() => {
    if (appearance !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [appearance])

  return { appearance, setAppearance: updateAppearance }
}
