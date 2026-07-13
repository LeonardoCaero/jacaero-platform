import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/axios'
import { tokenStorage } from '../lib/token-storage'

type User = {
  id: string
  email: string
  fullName: string
  jobTitle: string | null
  role: string | null
  permissions: string[]
}

type AuthContextValue = {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (key: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      if (!tokenStorage.getAccessToken()) {
        setIsLoading(false)
        return
      }
      try {
        const { data } = await api.get<User>('/auth/me')
        setUser(data)
      } catch {
        tokenStorage.clear()
      } finally {
        setIsLoading(false)
      }
    }
    loadUser()
  }, [])

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password })
    tokenStorage.setTokens(data.accessToken, data.refreshToken)
    setUser(data.user)
  }

  async function logout() {
    const refreshToken = tokenStorage.getRefreshToken()
    tokenStorage.clear()
    setUser(null)
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken }).catch(() => {})
    }
  }

  function hasPermission(key: string) {
    return user?.permissions.includes(key) ?? false
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
