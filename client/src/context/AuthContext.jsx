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
    } catch (err) {
      // PROFILE_NOT_FOUND means signup sync is still in progress – don't sign out
      const code = err.response?.data?.code
      if (code !== 'PROFILE_NOT_FOUND') {
        setUser(null)
      }
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

    // Sync profile to Neon DB immediately using the new session token.
    // This MUST happen before the SIGNED_IN event fires, which triggers
    // fetchProfile — otherwise the profile won't exist yet and auth fails.
    if (data.user) {
      try {
        // Use the access_token from the newly created session (if available)
        const token = data.session?.access_token
        await api.post(
          '/api/auth/signup',
          {
            auth_id:   data.user.id,
            email:     data.user.email,
            full_name: fullName,
            role,
          },
          token ? { headers: { Authorization: `Bearer ${token}` } } : {}
        )
      } catch (syncErr) {
        // If it's a 409 (already exists), that's fine — profile is already there
        if (syncErr.response?.status !== 409) {
          console.warn('Profile sync warning:', syncErr.response?.data?.error || syncErr.message)
        }
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
