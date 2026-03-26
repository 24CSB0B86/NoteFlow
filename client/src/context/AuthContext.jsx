import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../utils/supabaseClient'
import api from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]     = useState(null)   // Supabase session
  const [user, setUser]           = useState(null)   // Neon DB profile
  const [loading, setLoading]     = useState(true)

  // Fetch user profile from our Express API
  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/api/auth/me')
      setUser(data.user)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchProfile().finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)

        if (event === 'SIGNED_IN' && session) {
          await fetchProfile()
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Re-fetch profile on token refresh to keep data fresh
          await fetchProfile()
        }
      }
    )

    return () => subscription.unsubscribe()
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

    // Sync profile to Neon DB regardless of email confirmation requirement
    if (data.user) {
      await api.post('/api/auth/signup', {
        auth_id:   data.user.id,
        email:     data.user.email,
        full_name: fullName,
        role,
      })
    }

    return data
  }

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
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
