import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Loader2, Save, Lock, LogOut, User } from 'lucide-react'
import api from '../utils/api'

export default function SettingsPage() {
  const { user, signOut, updatePassword, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [name, setName]           = useState(user?.full_name || '')
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg]     = useState('')

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw]   = useState(false)
  const [pwMsg, setPwMsg]         = useState('')

  const [loggingOut, setLoggingOut] = useState(false)

  // Update display name
  const handleSaveName = async (e) => {
    e.preventDefault()
    if (!name.trim()) return setNameMsg('Name cannot be empty.')
    setSavingName(true)
    setNameMsg('')
    try {
      await api.put('/api/auth/me', { full_name: name.trim() })
      await refreshProfile()
      setNameMsg('✓ Profile updated!')
    } catch (err) {
      setNameMsg(err.response?.data?.error || 'Failed to update profile.')
    } finally {
      setSavingName(false)
    }
  }

  // Change password
  const handleChangePw = async (e) => {
    e.preventDefault()
    if (newPw.length < 8) return setPwMsg('Password must be at least 8 characters.')
    if (newPw !== confirmPw) return setPwMsg('Passwords do not match.')
    setSavingPw(true)
    setPwMsg('')
    try {
      await updatePassword(newPw)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setPwMsg('✓ Password changed successfully!')
    } catch (err) {
      setPwMsg(err.message || 'Failed to change password.')
    } finally {
      setSavingPw(false)
    }
  }

  // Logout
  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      navigate('/login', { replace: true })
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto animate-fade-in space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 mt-1">Manage your account and preferences.</p>
        </div>

        {/* Profile info */}
        <Card className="border-white/10 bg-slate-900/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-indigo-400" />
              <CardTitle className="text-white text-base">Profile</CardTitle>
            </div>
            <CardDescription className="text-slate-500">Update your display name.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Static info */}
            <div className="flex items-center gap-3 mb-5 p-3 rounded-lg bg-slate-800/60 border border-white/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 text-lg font-bold flex-shrink-0">
                {user?.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-semibold text-white">{user?.full_name}</p>
                <p className="text-sm text-slate-400">{user?.email}</p>
                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 capitalize">
                  {user?.role}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveName} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-slate-300">Full Name</Label>
                <Input
                  id="fullName"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="bg-slate-800/60 border-white/10 text-white focus:border-indigo-500"
                />
              </div>
              {nameMsg && (
                <p className={`text-sm ${nameMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
                  {nameMsg}
                </p>
              )}
              <Button type="submit" disabled={savingName} size="sm"
                className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {savingName ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                Save Name
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card className="border-white/10 bg-slate-900/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-indigo-400" />
              <CardTitle className="text-white text-base">Change Password</CardTitle>
            </div>
            <CardDescription className="text-slate-500">Choose a strong password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePw} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="newPw" className="text-slate-300">New Password</Label>
                <Input
                  id="newPw"
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="bg-slate-800/60 border-white/10 text-white placeholder-slate-600 focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPw" className="text-slate-300">Confirm Password</Label>
                <Input
                  id="confirmPw"
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Re-enter new password"
                  className="bg-slate-800/60 border-white/10 text-white placeholder-slate-600 focus:border-indigo-500"
                />
              </div>
              {pwMsg && (
                <p className={`text-sm ${pwMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pwMsg}
                </p>
              )}
              <Button type="submit" disabled={savingPw} size="sm"
                className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {savingPw ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Lock className="h-4 w-4 mr-1.5" />}
                Change Password
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Danger zone — logout */}
        <Card className="border-red-500/20 bg-slate-900/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-red-400" />
              <CardTitle className="text-white text-base">Session</CardTitle>
            </div>
            <CardDescription className="text-slate-500">Log out from this account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleLogout}
              disabled={loggingOut}
              variant="outline"
              className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-400"
            >
              {loggingOut ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <LogOut className="h-4 w-4 mr-1.5" />}
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
