import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { api, type AuthTokens } from '../api/client'

interface AuthCtx {
  isAuth: boolean
  login: (u: string, p: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuth, setIsAuth] = useState(api.isAuthenticated())

  const login = useCallback(async (u: string, p: string) => {
    await api.login(u, p)
    setIsAuth(true)
  }, [])

  const logout = useCallback(() => {
    api.logout()
    setIsAuth(false)
  }, [])

  return <Ctx.Provider value={{ isAuth, login, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
