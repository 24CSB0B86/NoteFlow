import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { Trophy, Crown } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '@/context/AuthContext'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const PERIOD_TABS = [
  { id: 'alltime', label: 'All Time' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'weekly',  label: 'Weekly' },
]

const RANK_COLORS = ['text-amber-400', 'text-zinc-300', 'text-amber-600']
const RANK_BG    = ['bg-amber-500/10 border-amber-500/20', 'bg-zinc-500/10 border-zinc-500/20', 'bg-amber-600/10 border-amber-600/20']

export default function Leaderboard({ classroomId }) {
  const { session, user } = useAuth()
  const [period, setPeriod] = useState('alltime')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const headers = { Authorization: `Bearer ${session?.access_token}` }

  useEffect(() => {
    const token = session?.access_token || localStorage.getItem('nf_access_token')
    if (!classroomId || !token) {
      console.warn('[Leaderboard] No classroomId or token – skipping fetch')
      setLoading(false)
      return
    }
    setLoading(true)
    const authHeaders = { Authorization: `Bearer ${token}` }
    console.log(`[Leaderboard] GET /api/karma/leaderboard/${classroomId}?period=${period}`)
    axios.get(`${API}/api/karma/leaderboard/${classroomId}?period=${period}`, { headers: authHeaders })
      .then(r => {
        console.log('[Leaderboard] ✅ Loaded', r.data?.leaderboard?.length, 'entries, myRank:', r.data?.myRank)
        setData(r.data)
      })
      .catch(err => {
        console.error('[Leaderboard] ❌ Failed:', err.response?.status, err.response?.data?.error)
      })
      .finally(() => setLoading(false))
  }, [classroomId, period, session])

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-400" /> Leaderboard</h3>
        <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
          {PERIOD_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setPeriod(t.id)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-md transition-all font-medium',
                period === t.id ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* My rank banner */}
      {data?.myRank && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2 text-sm">
          <span className="text-primary font-bold">#{data.myRank}</span>
          <span className="text-muted-foreground">Your rank</span>
        </div>
      )}

      {/* Board */}
      <div className="px-4 pb-5 space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />
          ))
        ) : data?.leaderboard?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No data yet</div>
        ) : data?.leaderboard?.map((entry, i) => {
          const isTop3 = i < 3
          const isMe = entry.id === user?.id
          return (
            <div
              key={entry.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all',
                isTop3 ? RANK_BG[i] : 'border-border/30 bg-muted/20',
                isMe && 'ring-1 ring-primary/40'
              )}
            >
              {/* Rank */}
              <div className={cn('w-7 text-center font-bold text-sm shrink-0', isTop3 ? RANK_COLORS[i] : 'text-muted-foreground')}>
                {i === 0 ? <Crown className="w-4 h-4 mx-auto text-amber-400" /> : `#${i + 1}`}
              </div>

              {/* Avatar */}
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarImage src={entry.avatar_url} />
                <AvatarFallback className="text-xs">{entry.full_name?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium truncate', isMe && 'text-primary')}>{entry.full_name} {isMe && '(you)'}</p>
                <p className="text-xs text-muted-foreground">{entry.uploads} uploads · Lv.{entry.level || 1}</p>
              </div>

              {/* Points */}
              <div className={cn('font-bold text-sm shrink-0', isTop3 ? RANK_COLORS[i] : 'text-foreground')}>
                {entry.points} <span className="font-normal text-xs">pts</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
