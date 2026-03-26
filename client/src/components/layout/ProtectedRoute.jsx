import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Loader2 } from 'lucide-react'

/**
 * Wraps routes that require authentication.
 * - Shows a spinner only during the initial auth check
 * - Redirects to /login if no session
 * - Optionally restricts to a specific role via `requiredRole`
 */
export default function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, loading, user, session } = useAuth()
  const location = useLocation()

  // Only block on loading if we have no session at all (initial load)
  // If session exists, let the page render — profile may still be fetching
  if (loading && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Role check — only block if user profile is loaded
  if (requiredRole && user && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
