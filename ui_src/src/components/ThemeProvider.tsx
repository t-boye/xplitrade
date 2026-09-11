import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeCtx { theme: Theme; toggle: () => void }
const Ctx = createContext<ThemeCtx>({ theme: 'light', toggle: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('xp-theme') as Theme) || 'light'
  )

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('xp-theme', theme)
  }, [theme])

  const toggle = useCallback(() =>
    setTheme(t => (t === 'light' ? 'dark' : 'light')), [])

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>
}

export function useTheme() { return useContext(Ctx) }
