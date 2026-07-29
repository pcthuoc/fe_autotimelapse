import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type ThemeMode = 'dark' | 'light'

interface ThemeCtx {
  mode: ThemeMode
  toggle: () => void
}

const Ctx = createContext<ThemeCtx>({ mode: 'dark', toggle: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('bb-theme') as ThemeMode) || 'dark'
  })

  useEffect(() => {
    const html = document.documentElement
    if (mode === 'light') html.classList.add('light')
    else html.classList.remove('light')
    localStorage.setItem('bb-theme', mode)
  }, [mode])

  const toggle = () => setMode((m) => (m === 'dark' ? 'light' : 'dark'))

  return <Ctx.Provider value={{ mode, toggle }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
