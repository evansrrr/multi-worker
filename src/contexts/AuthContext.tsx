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
      const data = await response.json()
      
      if (data.success) {
        setIsAuthenticated(data.data.isAuthenticated)
        setNeedsSetup(data.data.needsSetup)
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
    
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error?.message || 'Login failed')
    }
    
    const data = await response.json()
    if (data.success) {
      setIsAuthenticated(true)
    } else {
      throw new Error(data.error?.message || 'Login failed')
    }
  }

  const setup = async (password: string) => {
    const response = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error?.message || 'Setup failed')
    }
    
    const data = await response.json()
    if (data.success) {
      setIsAuthenticated(true)
      setNeedsSetup(false)
    } else {
      throw new Error(data.error?.message || 'Setup failed')
    }
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setIsAuthenticated(false)
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
