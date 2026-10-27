import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPut } from '../lib/api'

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
      const data = await apiGet<{ mode?: AppearanceMode }>('/api/settings/appearance')
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
      await apiPut('/api/settings/appearance', { mode })
    } catch {
      // 保存失败：本地已生效；api 对非 GET 失败自动 toast 提示
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
