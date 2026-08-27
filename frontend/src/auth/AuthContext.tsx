import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, tokenStore } from '../lib/api'
import type { AuthResponse, User } from '../lib/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, fullName: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore session on load if we have a token.
    if (!tokenStore.access) {
      setLoading(false)
      return
    }
    api
      .get<User>('/auth/me')
      .then((r) => setUser(r.data))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  const handleAuth = useCallback((data: AuthResponse) => {
    tokenStore.set(data)
    setUser(data.user)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
      handleAuth(data)
    },
    [handleAuth],
  )

  const register = useCallback(
    async (email: string, fullName: string, password: string) => {
      const { data } = await api.post<AuthResponse>('/auth/register', {
        email,
        full_name: fullName,
        password,
      })
      handleAuth(data)
    },
    [handleAuth],
  )

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
