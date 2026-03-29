import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Layout from '@/components/Layout'
import BadgeShowcase from '@/components/karma/BadgeShowcase'
import LevelUpModal from '@/components/karma/LevelUpModal'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Upload, Trophy, Star, Zap, Calendar, BookOpen, Flame,
  TrendingUp, Award, ArrowLeft, Loader2, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const LEVEL_NAMES  = { 1: 'Novice', 2: 'Contributor', 3: 'Expert', 4: 'Master', 5: 'Legend' }
const LEVEL_ICONS  = { 1: '🌱', 2: '📚', 3: '⭐', 4: '🔥', 5: '👑' }
const LEVEL_COLORS = {
  1: 'from-zinc-500/20 to-zinc-600/10 border-zinc-500/30',
  2: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  3: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
  4: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  5: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
}

const ACTION_LABELS = {
  upload: { label: 'Uploaded resource', icon: Upload, color: 'text-blue-400' },
  upvote: { label: 'Resource upvoted', icon: TrendingUp, color: 'text-emerald-400' },
  downvote: { label: 'Resource downvoted', icon: TrendingUp, color: 'text-red-400' },
  bounty_fulfill: { label: 'Bounty fulfilled', icon: Trophy, color: 'text-purple-400' },
  discussion_helpful: { label: 'Helpful discussion', icon: BookOpen, color: 'text-sky-400' },
  login_streak: { label: 'Login streak bonus', icon: Flame, color: 'text-orange-400' },
  professor_verify: { label: 'Resource verified', icon: Award, color: 'text-amber-400' },
  spam_penalty: { label: 'Moderation penalty', icon: Zap, color: 'text-red-500' },
}

function StatCard({ icon: Icon, label, value, color = 'text-primary' }) {
  return (
    <Card className="glass border-border/50">
      <CardContent className="flex items-center gap-3 pt-4 pb-4">
        <div className={cn('p-2 rounded-xl bg-muted/50', color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xl font-bold">{value ?? '—'}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function UserProfilePage() {
  const { userId } = useParams()
  const { user: currentUser, session } = useAuth()
  const [data, setData] = useState(null)
  const [allBadges, setAllBadges] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [levelUpModal, setLevelUpModal] = useState(null)

  const getAuthHeaders = () => {
    const token = session?.access_token || localStorage.getItem('nf_access_token')
    console.log('[UserProfile] Auth token present:', !!token)
    return { Authorization: `Bearer ${token}` }
  }

  const load = async () => {
    const token = session?.access_token || localStorage.getItem('nf_access_token')
    if (!token) {
      console.warn('[UserProfile] ⚠️ No auth token – cannot load profile')
      setLoading(false)
      setError('Not authenticated')
      return
    }
    if (!userId) {
      console.warn('[UserProfile] ⚠️ No userId in params')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const headers = { Authorization: `Bearer ${token}` }

    console.log(`[UserProfile] Loading profile for userId: ${userId}`)
    console.log(`[UserProfile] GET /api/karma/${userId}`)
    console.log(`[UserProfile] GET /api/karma/badges`)
    console.log(`[UserProfile] GET /api/karma/activity/${userId}`)

    try {
      const [profileRes, badgesRes, activityRes] = await Promise.all([
        axios.get(`${API}/api/karma/${userId}`, { headers }),
        axios.get(`${API}/api/karma/badges`, { headers }),
        axios.get(`${API}/api/karma/activity/${userId}`, { headers }),
      ])

      console.log('[UserProfile] ✅ Profile loaded:', profileRes.data?.user?.full_name)
      console.log('[UserProfile] ✅ Badges loaded:', badgesRes.data?.badges?.length, 'total')
      console.log('[UserProfile] ✅ Activity loaded:', activityRes.data?.transactions?.length, 'entries')

      setData(profileRes.data)
      setAllBadges(badgesRes.data.badges || [])
      setActivity(activityRes.data.transactions || [])
    } catch (e) {
      const msg = e.response?.data?.error || e.message
      console.error('[UserProfile] ❌ Load failed – status:', e.response?.status, '– error:', msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    console.log('[UserProfile] useEffect – userId:', userId, 'session present:', !!session, 'localStorage token:', !!localStorage.getItem('nf_access_token'))
    load()
  }, [userId, session])

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground text-sm">Loading profile…</span>
      </div>
    </Layout>
  )

  if (error) return (
    <Layout>
      <div className="p-8 text-center">
        <p className="text-destructive font-medium mb-2">Failed to load profile</p>
        <p className="text-muted-foreground text-sm mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </Button>
      </div>
    </Layout>
  )

  if (!data) return (
    <Layout>
      <div className="p-8 text-center text-muted-foreground">User not found</div>
    </Layout>
  )

  const { user, karma, stats, badges: earnedBadges } = data
  const level = karma?.level || 1
  const mergedBadges = allBadges.map(b => ({
    ...b,
    earned: earnedBadges?.some(e => e.id === b.id) || false,
    earned_at: earnedBadges?.find(e => e.id === b.id)?.earned_at,
  }))

  return (
    <Layout>
      <LevelUpModal
        open={!!levelUpModal}
        level={levelUpModal?.level}
        points={levelUpModal?.points}
        onClose={() => setLevelUpModal(null)}
      />

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Back */}
        <Link to="/classrooms" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        {/* Hero card */}
        <div className={cn('rounded-2xl border bg-gradient-to-br p-6', LEVEL_COLORS[level] || LEVEL_COLORS[1])}>
          <div className="flex items-start gap-5 flex-wrap">
            <Avatar className="w-20 h-20 shrink-0 ring-4 ring-background shadow-xl">
              <AvatarFallback className="text-2xl">{user?.full_name?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold">{user?.full_name}</h1>
              <p className="text-muted-foreground text-sm">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-2xl">{LEVEL_ICONS[level]}</span>
                <span className="font-semibold capitalize">{user?.role}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-semibold">{LEVEL_NAMES[level]}</span>
                <span className="px-2 py-0.5 rounded-full bg-background/50 text-xs font-bold border">Level {level}</span>
              </div>
            </div>

            {/* Points display */}
            <div className="text-center shrink-0">
              <div className="text-4xl font-black">{karma?.total_points ?? 0}</div>
              <div className="text-xs text-muted-foreground">karma points</div>
              {karma?.login_streak > 0 && (
                <div className="flex items-center gap-1 justify-center mt-1 text-orange-400 text-xs font-medium">
                  <Flame className="w-3 h-3" /> {karma.login_streak}-day streak
                </div>
              )}
            </div>
          </div>

          {/* Level progress bar */}
          {karma?.nextMin && (
            <div className="mt-5">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>{LEVEL_NAMES[level]}</span>
                <span>{karma.pointsToNext} pts to {LEVEL_NAMES[level + 1]}</span>
              </div>
              <Progress value={karma.progressPct} className="h-2" />
            </div>
          )}
          {level === 5 && (
            <div className="mt-4 text-center text-amber-400 font-bold text-sm">
              👑 Maximum level reached — you're a Legend!
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Upload} label="Resources Uploaded" value={stats?.upload_count} color="text-blue-400" />
          <StatCard icon={Trophy} label="Bounties Fulfilled" value={stats?.bounties_fulfilled} color="text-purple-400" />
          <StatCard icon={TrendingUp} label="Upvotes Received" value={stats?.upvotes_received} color="text-emerald-400" />
          <StatCard icon={BookOpen} label="Discussions" value={stats?.discussion_count} color="text-sky-400" />
        </div>

        {/* Tabs: Badges + Activity */}
        <Tabs defaultValue="badges">
          <TabsList className="w-full">
            <TabsTrigger value="badges" className="flex-1">
              🏅 Badges ({earnedBadges?.length || 0}/{allBadges.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1">
              ⚡ Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="badges" className="mt-4">
            <Card className="glass border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                  Badge Collection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BadgeShowcase badges={mergedBadges} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <Card className="glass border-border/50">
              <CardContent className="pt-4 space-y-0 divide-y divide-border/50">
                {activity.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">No activity yet</div>
                ) : activity.map(tx => {
                  const config = ACTION_LABELS[tx.action_type] || { label: tx.action_type, icon: Star, color: 'text-muted-foreground' }
                  const Icon = config.icon
                  return (
                    <div key={tx.id} className="flex items-center gap-3 py-3">
                      <div className={cn('p-1.5 rounded-lg bg-muted/50', config.color)}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{tx.description || config.label}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                      </div>
                      <span className={cn('font-bold text-sm shrink-0', tx.points >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {tx.points >= 0 ? '+' : ''}{tx.points}
                      </span>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
