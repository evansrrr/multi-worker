import { createContext, useState, useEffect, ReactNode } from 'react'

interface AuthContextType {
  isAuthenticated: boolean
  needsSetup: boolean
  isLoading: boolean
  login: (password: string) => Promise<void>
  setup: (password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

/**
 * Parse a JSON response body without ever surfacing a raw parse error.
 *
 * Pages Functions sit behind Cloudflare's edge: when a request times out or a
 * Worker is interrupted, the browser receives an HTML error page (e.g. 524)
 * instead of JSON. Calling response.json() on that body throws
 * `Unexpected token '<'` — a syntax error that tells the user nothing. This
 * helper detects non-JSON payloads and throws an actionable Chinese message
 * instead, so transient edge failures read as "retry" rather than a bug.
 */
async function readJsonSafely(
  response: Response,
  fallbackMessage: string
): Promise<Record<string, unknown> | null> {
  const contentType = response.headers.get('content-type') || ''
  const text = await response.text()
  if (!contentType.includes('application/json')) {
    throw new Error(
      `服务端返回了非 JSON 响应（HTTP ${response.status}${text.trim() ? `：${text.slice(0, 80)}` : ''}）。可能是网络波动导致请求被中断，请稍后重试。`
    )
  }
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`${fallbackMessage}（响应内容无法解析）`)
  }
}

/** Extract the nested error message from an API error body. */
function errorMessageOf(data: Record<string, unknown> | null): string | undefined {
  const error = data?.error
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (typeof error === 'string' && error.trim()) return error
  return undefined
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/status')
      if (!response.ok) {
        setNeedsSetup(true)
        return
      }
      const data = await readJsonSafely(response, '登录状态检查失败')

      if (data?.success) {
        const payload = data.data as
          | { isAuthenticated?: boolean; needsSetup?: boolean }
          | undefined
        setIsAuthenticated(payload?.isAuthenticated ?? false)
        setNeedsSetup(payload?.needsSetup ?? false)
      } else {
        setNeedsSetup(true)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setNeedsSetup(true)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const login = async (password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    const data = await readJsonSafely(response, '登录失败')
    if (response.ok && data?.success) {
      setIsAuthenticated(true)
      return
    }
    throw new Error(errorMessageOf(data) || '登录失败，请检查密码后重试')
  }

  const setup = async (password: string) => {
    const response = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    const data = await readJsonSafely(response, '设置密码失败')
    if (response.ok && data?.success) {
      setIsAuthenticated(true)
      setNeedsSetup(false)
      return
    }
    throw new Error(errorMessageOf(data) || '设置密码失败，请重试')
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setIsAuthenticated(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        needsSetup,
        isLoading,
        login,
        setup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
