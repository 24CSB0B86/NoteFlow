import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../utils/supabaseClient'
import api from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)
  const [user, setUser]         = useState(null)
  const [loading, setLoading]   = useState(true)

  // Fetch user profile from our Express API
  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/api/auth/me')
      setUser(data.user)
      return data.user
    } catch {
      setUser(null)
      return null
    }
  }, [])

  useEffect(() => {
    let mounted = true

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      if (session) {
        await fetchProfile()
      }
      // Always resolve loading, even if profile fetch fails
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        setSession(session)

        if (event === 'SIGNED_IN' && session) {
          await fetchProfile()
          setLoading(false)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
        } else if (event === 'TOKEN_REFRESHED' && session) {
          await fetchProfile()
        } else if (event === 'PASSWORD_RECOVERY') {
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // ── Auth Actions ─────────────────────────────────────────────

  const signUp = async ({ email, password, fullName, role }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    })

    if (error) throw error

    // Sync profile to Neon DB
    if (data.user) {
      try {
        await api.post('/api/auth/signup', {
          auth_id:   data.user.id,
          email:     data.user.email,
          full_name: fullName,
          role,
        })
      } catch (syncErr) {
        // Non-fatal: profile sync may fail if email not confirmed yet
        console.warn('Profile sync skipped (email confirmation may be required):', syncErr.message)
      }
    }

    return data
  }

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    try {
      await api.post('/api/auth/logout')
    } catch {
      // Best-effort server logout
    }
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  const value = {
    session,
    user,
    loading,
    isAuthenticated: !!session,
    isProfessor: user?.role === 'professor',
    isStudent: user?.role === 'student',
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    refreshProfile: fetchProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

export default AuthContext
