import { useQueryClient } from '@tanstack/react-query'
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'

import { ApiError, get, post, setUnauthorizedHandler } from './api'
import { startEvents, stopEvents } from './events'
import type { PanelUser } from './types'

interface AuthState {
  user: PanelUser | null
  loading: boolean
  setUser: (user: PanelUser | null) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, setUser: () => undefined, logout: async () => undefined })

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<PanelUser | null>(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    get<PanelUser>('/auth/me')
      .then(setUser)
      .catch((error) => {
        if (!(error instanceof ApiError) || error.status !== 401) console.error(error)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  // eventos em tempo real só com login
  useEffect(() => {
    if (user) startEvents()
    else stopEvents()
  }, [user])

  const logout = useCallback(async () => {
    await post('/auth/logout').catch(() => undefined)
    queryClient.clear()
    setUser(null)
  }, [queryClient])

  return <AuthContext.Provider value={{ user, loading, setUser, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
