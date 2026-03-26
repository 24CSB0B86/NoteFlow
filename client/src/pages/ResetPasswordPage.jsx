import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../utils/supabaseClient'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card'
import { BookOpen, Loader2, ArrowLeft, CheckCircle2, Eye, EyeOff } from 'lucide-react'

// Step 1: Request reset link | Step 2: Set new password
export default function ResetPasswordPage() {
  const { resetPassword, updatePassword } = useAuth()
  const navigate = useNavigate()

  // Detect if we arrived via a reset link (Supabase sets the session automatically)
  const hash = window.location.hash
  const isResetMode = hash.includes('type=recovery') || hash.includes('access_token')

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [sent, setSent]             = useState(false)

  // ── Step 1: Request Reset Link ──────────────────────────────
  const handleRequestReset = async (e) => {
    e.preventDefault()
    if (!email) { setError('Please enter your email.'); return }
    setLoading(true)
    setError('')
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err) {
      setError(err.message || 'Failed to send reset email.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Update Password ─────────────────────────────────
  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPwd) { setError('Passwords do not match.'); return }
    setLoading(true)
    setError('')
    try {
      await updatePassword(password)
      // Sign out after password update so user logs in fresh
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to update password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="p-2 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/30">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">NoteFlow</span>
        </div>

        {/* Email sent confirmation */}
        {sent ? (
          <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl text-white">
            <CardContent className="pt-8 pb-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600/20 border border-indigo-500/30">
                <CheckCircle2 className="h-7 w-7 text-indigo-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Check your email</h2>
              <p className="text-slate-400 text-sm mb-6">
                We sent a password reset link to <strong className="text-white">{email}</strong>
              </p>
              <Link to="/login">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back to Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : isResetMode ? (
          /* Step 2: Set new password */
          <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl text-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl text-white">Set new password</CardTitle>
              <CardDescription className="text-slate-400">
                Enter your new password below
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleUpdatePassword}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-slate-300">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPwd ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => { setError(''); setPassword(e.target.value) }}
                      className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-slate-300">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Re-enter new password"
                    value={confirmPwd}
                    onChange={(e) => { setError(''); setConfirmPwd(e.target.value) }}
                    className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg"
                  disabled={loading}
                >
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…</> : 'Update Password'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        ) : (
          /* Step 1: Request reset link */
          <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl text-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl text-white">Forgot password?</CardTitle>
              <CardDescription className="text-slate-400">
                Enter your email and we&apos;ll send a reset link
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleRequestReset}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-slate-300">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@university.edu"
                    value={email}
                    onChange={(e) => { setError(''); setEmail(e.target.value) }}
                    className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg"
                  disabled={loading}
                >
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</> : 'Send Reset Link'}
                </Button>
                <Link to="/login" className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors mx-auto">
                  <ArrowLeft className="h-3 w-3" /> Back to Login
                </Link>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}
