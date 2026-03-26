import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card'
import { BookOpen, Loader2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setError('')
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('Please fill in all fields.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await signIn({ email: form.email, password: form.password })
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      {/* Background decorative circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="p-2 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/30">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">NoteFlow</span>
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl text-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-white">Welcome back</CardTitle>
            <CardDescription className="text-slate-400">
              Sign in to your NoteFlow account
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@university.edu"
                  value={form.email}
                  onChange={handleChange}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-300">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 pt-2">
              <Button
                type="submit"
                size="lg"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all duration-200"
                disabled={loading}
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : 'Sign In'}
              </Button>

              <p className="text-sm text-slate-400 text-center">
                Don&apos;t have an account?{' '}
                <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                  Create one
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
