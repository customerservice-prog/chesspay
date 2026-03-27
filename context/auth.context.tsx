'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { apiClient } from '@/lib/api/client'

export interface AuthUser {
  id: string
  email: string
  username: string
  eloRating: number
  kycStatus: string
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKEN_KEY = 'cp_access_token'
const USER_KEY = 'cp_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
    isAuthenticated: false,
  })

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    const userRaw = localStorage.getItem(USER_KEY)
    if (token && userRaw) {
      try {
        const user = JSON.parse(userRaw) as AuthUser
        setState({ user, accessToken: token, isLoading: false, isAuthenticated: true })
        apiClient.setToken(token)
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setState(s => ({ ...s, isLoading: false }))
      }
    } else {
      setState(s => ({ ...s, isLoading: false }))
    }
  }, [])

  const persistAuth = (user: AuthUser, token: string) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    apiClient.setToken(token)
    setState({ user, accessToken: token, isLoading: false, isAuthenticated: true })
  }

  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    apiClient.setToken(null)
    setState({ user: null, accessToken: null, isLoading: false, isAuthenticated: false })
  }

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post<{ data: { user: AuthUser; accessToken: string } }>(
      '/api/auth/login',
      { email, password }
    )
    persistAuth(res.data.user, res.data.accessToken)
  }, [])

  const register = useCallback(async (email: string, username: string, password: string) => {
    const res = await apiClient.post<{ data: { user: AuthUser; accessToken: string } }>(
      '/api/auth/register',
      { email, username, password }
    )
    persistAuth(res.data.user, res.data.accessToken)
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiClient.delete('/api/auth/refresh')
    } catch { /* ignore */ }
    clearAuth()
    window.location.href = '/login'
  }, [])

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const res = await apiClient.post<{ data: { accessToken: string } }>('/api/auth/refresh', {})
      const userRaw = localStorage.getItem(USER_KEY)
      if (userRaw) {
        const user = JSON.parse(userRaw) as AuthUser
        persistAuth(user, res.data.accessToken)
      }
      return true
    } catch {
      clearAuth()
      return false
    }
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
