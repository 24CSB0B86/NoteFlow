import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nf_user')) } catch { return null }
  })
  // ── CRITICAL FIX: expose session so components can use session?.access_token ──
  const [session, setSession] = useState(() => {
    const token = localStorage.getItem('nf_access_token')
    console.log('[AuthContext] Init – stored token present:', !!token)
    return token ? { access_token: token } : null
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Verify stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('nf_access_token')
    if (!token) {
      console.log('[AuthContext] No stored token – user is logged out')
      setLoading(false)
      return
    }
    console.log('[AuthContext] Found stored token – verifying with GET /api/auth/me')
    api.get('/api/auth/me')
      .then(res => {
        console.log('[AuthContext] ✅ /api/auth/me success, user:', res.data.user?.email)
        setUser(res.data.user)
        setSession({ access_token: token })
      })
      .catch(err => {
        console.warn('[AuthContext] ❌ /api/auth/me failed (status:', err.response?.status, ') – clearing session')
        localStorage.removeItem('nf_access_token')
        localStorage.removeItem('nf_user')
        setUser(null)
        setSession(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const signup = useCallback(async ({ email, password, full_name, role }) => {
    setError(null)
    console.log('[AuthContext] POST /api/auth/signup → email:', email, 'role:', role)
    const res = await api.post('/api/auth/signup', { email, password, full_name, role })
    console.log('[AuthContext] ✅ Signup success:', res.data)
    return res.data
  }, [])

  const login = useCallback(async ({ email, password }) => {
    setError(null)
    console.log('[AuthContext] POST /api/auth/login → email:', email)
    const res = await api.post('/api/auth/login', { email, password })
    const { access_token, user: userData } = res.data
    localStorage.setItem('nf_access_token', access_token)
    localStorage.setItem('nf_user', JSON.stringify(userData))
    setUser(userData)
    setSession({ access_token })
    console.log('[AuthContext] ✅ Login success – user:', userData?.email, '| role:', userData?.role)
    return userData
  }, [])

  const logout = useCallback(async () => {
    console.log('[AuthContext] POST /api/auth/logout')
    try { await api.post('/api/auth/logout') } catch (e) {
      console.warn('[AuthContext] Logout API call failed (non-fatal):', e.message)
    }
    localStorage.removeItem('nf_access_token')
    localStorage.removeItem('nf_user')
    setUser(null)
    setSession(null)
    console.log('[AuthContext] ✅ Logged out – session cleared')
  }, [])

  const resetPassword = useCallback(async (email) => {
    console.log('[AuthContext] POST /api/auth/reset-password → email:', email)
    await api.post('/api/auth/reset-password', { email })
    console.log('[AuthContext] ✅ Password reset email sent')
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, error, signup, login, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
