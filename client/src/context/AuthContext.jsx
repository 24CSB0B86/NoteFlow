import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nf_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Verify stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('nf_access_token')
    if (!token) { setLoading(false); return }
    api.get('/api/auth/me')
      .then(res => setUser(res.data.user))
      .catch(() => { localStorage.removeItem('nf_access_token'); localStorage.removeItem('nf_user'); setUser(null) })
      .finally(() => setLoading(false))
  }, [])

  const signup = useCallback(async ({ email, password, full_name, role }) => {
    setError(null)
    const res = await api.post('/api/auth/signup', { email, password, full_name, role })
    return res.data
  }, [])

  const login = useCallback(async ({ email, password }) => {
    setError(null)
    const res = await api.post('/api/auth/login', { email, password })
    const { access_token, user: userData } = res.data
    localStorage.setItem('nf_access_token', access_token)
    localStorage.setItem('nf_user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }, [])

  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout') } catch {}
    localStorage.removeItem('nf_access_token')
    localStorage.removeItem('nf_user')
    setUser(null)
  }, [])

  const resetPassword = useCallback(async (email) => {
    await api.post('/api/auth/reset-password', { email })
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, error, signup, login, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
