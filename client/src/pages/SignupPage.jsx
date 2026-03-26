import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card'
import { BookOpen, Loader2, Eye, EyeOff, GraduationCap, Users } from 'lucide-react'
import { cn } from '../utils/cn'

const ROLES = [
  {
    value: 'professor',
    label: 'Professor',
    description: 'Create classrooms & manage resources',
    icon: GraduationCap,
  },
  {
    value: 'student',
    label: 'Student',
    description: 'Join classrooms & access materials',
    icon: Users,
  },
]

export default function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleChange = (e) => {
    setError('')
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const validate = () => {
    if (!form.fullName.trim()) return 'Full name is required.'
    if (!form.email) return 'Email is required.'
    if (form.password.length < 8) return 'Password must be at least 8 characters.'
    if (form.password !== form.confirmPassword) return 'Passwords do not match.'
    if (!form.role) return 'Please select your role.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)
    setError('')
    try {
      const data = await signUp({
        email:    form.email,
        password: form.password,
        fullName: form.fullName.trim(),
        role:     form.role,
      })

      if (data.user && !data.session) {
        // Email confirmation required
        setSuccess(true)
      } else if (data.session) {
        // Session immediately available — give auth state time to settle
        // then navigate (AuthContext will fetch profile in background)
        setTimeout(() => navigate('/dashboard', { replace: true }), 300)
      } else {
        // Fallback: no user and no session — shouldn't happen, go to login
        navigate('/login', { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
        <div className="text-center animate-fade-in max-w-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600/20 border border-indigo-500/30">
            <BookOpen className="h-8 w-8 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Check your email</h2>
          <p className="text-slate-400 mb-6">
            We&apos;ve sent a confirmation link to <strong className="text-white">{form.email}</strong>.
            Click the link to activate your account.
          </p>
          <Link to="/login">
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
              Back to Login
            </Button>
          </Link>
        </div>
      </div>
    )
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

        <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl text-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl text-white">Create an account</CardTitle>
            <CardDescription className="text-slate-400">
              Join NoteFlow to collaborate with your university
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                  {error}
                </div>
              )}

              {/* Role selection */}
              <div className="space-y-2">
                <Label className="text-slate-300">I am a…</Label>
                <div className="grid grid-cols-2 gap-3">
                  {ROLES.map(({ value, label, description, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setError(''); setForm((p) => ({ ...p, role: value })) }}
                      className={cn(
                        'flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-all duration-200',
                        form.role === value
                          ? 'border-indigo-500 bg-indigo-600/20 text-white'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:bg-white/10'
                      )}
                    >
                      <Icon className={cn('h-5 w-5', form.role === value ? 'text-indigo-400' : '')} />
                      <span className="text-sm font-medium text-white">{label}</span>
                      <span className="text-xs text-slate-500 leading-tight">{description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-300">Full Name</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  placeholder="Dr. Jane Smith"
                  value={form.fullName}
                  onChange={handleChange}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                  required
                />
              </div>

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
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-300">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                  required
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 pt-2">
              <Button
                type="submit"
                size="lg"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                disabled={loading}
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…</> : 'Create Account'}
              </Button>

              <p className="text-sm text-slate-400 text-center">
                Already have an account?{' '}
                <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
