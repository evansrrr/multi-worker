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
      const data = await response.json()
      
      if (data.success) {
        setIsAuthenticated(data.data.isAuthenticated)
        setNeedsSetup(data.data.needsSetup)
      } else {
        setNeedsSetup(true)
      }
    } catch {
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
    
    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error?.message || 'Login failed')
    }
    
    setIsAuthenticated(true)
  }

  const setup = async (password: string) => {
    const response = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    
    const data = await response.json()
    if (!data.success) {
      throw new Error(data.error?.message || 'Setup failed')
    }
    
    setIsAuthenticated(true)
    setNeedsSetup(false)
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
