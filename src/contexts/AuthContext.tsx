import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getMe } from '../api/client'
import type { User } from '../api/types'

interface AuthCtx {
  user: User | null
  loading: boolean
  refresh: () => void
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, refresh: () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = () => {
    setLoading(true)
    getMe()
      .then((r) => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  return <Ctx.Provider value={{ user, loading, refresh }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
