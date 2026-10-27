import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { apiGet, apiPut } from '../lib/api'

export type AppearanceMode = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  appearance: AppearanceMode
  setAppearance: (mode: AppearanceMode) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'mw-appearance'

function applyTheme(mode: AppearanceMode) {
  const root = document.documentElement
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', dark)
}

function readStoredMode(): AppearanceMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // localStorage 不可用
  }
  return 'system'
}

/**
 * 全局主题上下文。挂载在 App 根部，任何组件通过 useTheme 读写主题。
 * 服务端偏好（/api/settings/appearance）为权威值，localStorage 仅作首屏
 * 防闪烁与降级缓存。
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearanceMode>(readStoredMode)

  useEffect(() => {
    applyTheme(appearance)
  }, [appearance])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiGet<{ mode?: AppearanceMode }>('/api/settings/appearance')
        if (!cancelled && data.mode && data.mode !== appearance) {
          setAppearanceState(data.mode)
          try { localStorage.setItem(STORAGE_KEY, data.mode) } catch { /* ignore */ }
        }
      } catch {
        // 拉取失败：沿用本地/系统偏好
      }
    })()
    return () => { cancelled = true }
    // 仅在挂载时以服务端值校准一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (appearance !== 'system') return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [appearance])

  const setAppearance = useCallback(async (mode: AppearanceMode) => {
    setAppearanceState(mode)
    applyTheme(mode)
    try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* ignore */ }
    try {
      await apiPut('/api/settings/appearance', { mode })
    } catch {
      // 保存失败：本地已生效；api 对非 GET 失败自动 toast 提示
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ appearance, setAppearance }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
